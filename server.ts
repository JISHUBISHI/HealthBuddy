import express from "express";
import crypto from "node:crypto";
import http from "node:http";
import dns, { promises as dnsPromises } from "node:dns";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import Stripe from "stripe";
import dotenv from "dotenv";
import Groq from "groq-sdk";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envRoot = __dirname;

/** Trim and strip wrapping quotes (common in hand-edited .env on Windows). */
function stripEnvQuotes(value: string | undefined): string {
  if (value == null) return "";
  let s = String(value).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

/** True when both Google OAuth env vars are set (used for routes + startup log). */
function envGoogleOAuthConfigured(): boolean {
  return !!(stripEnvQuotes(process.env.GOOGLE_CLIENT_ID) && stripEnvQuotes(process.env.GOOGLE_CLIENT_SECRET));
}

/** Google rejects redirect URIs that differ by a trailing slash or stray whitespace. */
function normalizeGoogleRedirectUri(uri: string): string {
  let s = stripEnvQuotes(uri).trim();
  if (!s) return s;
  s = s.replace(/\/+$/, "");
  return s;
}

function jwtSecret(): string {
  return process.env.JWT_SECRET || "secret";
}

/** Read .env manually so BOM / odd paths still parse (dotenv.config alone can miss on some setups). */
function mergeEnvFromFile(filePath: string, override: boolean): boolean {
  try {
    if (!fs.existsSync(filePath)) return false;
    let raw = fs.readFileSync(filePath, "utf8");
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    const parsed = dotenv.parse(raw);
    for (const [key, value] of Object.entries(parsed)) {
      const cur = process.env[key];
      const missing = cur === undefined || cur === "";
      if (override || missing) {
        process.env[key] = value;
      }
    }
    return true;
  } catch {
    return false;
  }
}

// Helps Windows / some networks where SRV lookups fail with ECONNREFUSED
dns.setDefaultResultOrder("ipv4first");

const envPathBesideServer = path.resolve(envRoot, ".env");
const envLocalBesideServer = path.resolve(envRoot, ".env.local");
mergeEnvFromFile(envPathBesideServer, false);
mergeEnvFromFile(envLocalBesideServer, true);
// Always merge cwd .env too (many setups use the same folder; if cwd differs, still fill missing keys).
mergeEnvFromFile(path.resolve(process.cwd(), ".env"), false);
mergeEnvFromFile(path.resolve(process.cwd(), ".env.local"), true);

const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "" });

/** Append Atlas-style query params when missing (helps server selection + auth). */
function ensureMongoQueryParams(uri: string): string {
  if (!uri) return uri;
  const parts: string[] = [];
  if (!/retryWrites\s*=/.test(uri)) parts.push("retryWrites=true");
  if (!/[\?&]w=majority(?:&|$)/.test(uri)) parts.push("w=majority");
  if (/\.mongodb\.net/i.test(uri) && !/authSource=/.test(uri)) parts.push("authSource=admin");
  if (parts.length === 0) return uri;
  const glue = uri.includes("?") ? "&" : "?";
  return `${uri}${glue}${parts.join("&")}`;
}

/**
 * Single place MongoDB URL is resolved.
 * - MONGODB_DIRECT_URI (mongodb://… not mongodb+srv://) — use Atlas "standard connection string" if SRV/DNS fails (querySrv ECONNREFUSED).
 * - MONGODB_URI (mongodb+srv://…) with user:password@host.
 * - Or MONGODB_URI with user:@host + MONGODB_PASSWORD.
 * - Or MONGODB_USER + MONGODB_PASSWORD + MONGODB_CLUSTER only.
 */
function resolveMongoUri(): string {
  const direct = stripEnvQuotes(process.env.MONGODB_DIRECT_URI);
  if (direct) return ensureMongoQueryParams(direct);

  let uri = stripEnvQuotes(process.env.MONGODB_URI);
  const user = stripEnvQuotes(process.env.MONGODB_USER);
  const passRaw = process.env.MONGODB_PASSWORD;
  const password = passRaw !== undefined && passRaw !== null ? String(passRaw).trim() : "";
  const cluster = stripEnvQuotes(process.env.MONGODB_CLUSTER);

  if (!uri && user && password && cluster) {
    const host = cluster.replace(/^mongodb\+srv:\/\//i, "").split("/")[0].split("?")[0].trim();
    return ensureMongoQueryParams(
      `mongodb+srv://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}/`
    );
  }

  if (uri && /^mongodb\+srv:\/\/[^:@]+:@/i.test(uri) && password) {
    uri = uri.replace(
      /^mongodb\+srv:\/\/([^:@]+):@/i,
      (_m, u: string) =>
        `mongodb+srv://${encodeURIComponent(u)}:${encodeURIComponent(password)}@`
    );
  }

  return uri ? ensureMongoQueryParams(uri) : "";
}

const MONGODB_URI = resolveMongoUri();
const DB_NAME = stripEnvQuotes(process.env.DB_NAME) || "healthbuddy";

let lastDbError: string | null = null;

const connectDB = async () => {
  if (!MONGODB_URI) {
    console.warn("MongoDB URI is missing. Set MONGODB_URI or MONGODB_DIRECT_URI in .env next to server.ts.");
    return;
  }
  const usingDirect = /^mongodb:\/\//i.test(MONGODB_URI) && !/^mongodb\+srv:\/\//i.test(MONGODB_URI);
  const usingSrv = /^mongodb\+srv:\/\//i.test(MONGODB_URI);

  // Many Windows setups return querySrv ECONNREFUSED with the default resolver; public DNS fixes SRV for Atlas.
  if (usingSrv && stripEnvQuotes(process.env.MONGODB_USE_PUBLIC_DNS) !== "false") {
    try {
      dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
      console.log(
        "MongoDB: using public DNS for SRV lookup (8.8.8.8, 1.1.1.1). Set MONGODB_USE_PUBLIC_DNS=false if you must use corporate DNS only."
      );
    } catch (e) {
      console.warn("MongoDB: dns.setServers failed:", e);
    }
  }

  const maskedUri = MONGODB_URI.replace(/:([^@]+)@/, ":****@");
  console.log(
    `Connecting to MongoDB (db: ${DB_NAME})${usingDirect ? " [direct URI, no SRV]" : ""}: ${maskedUri}`
  );

  if (usingSrv) {
    const hostMatch = /^mongodb\+srv:\/\/[^@]+@([^/?:]+)/i.exec(MONGODB_URI);
    const srvHost = hostMatch?.[1];
    if (srvHost) {
      try {
        const recs = await dnsPromises.resolveSrv(`_mongodb._tcp.${srvHost}`);
        console.log(`MongoDB SRV preflight OK (${recs.length} endpoint(s)).`);
      } catch (e: any) {
        console.warn(`MongoDB SRV preflight failed: ${e?.code ?? ""} ${e?.message ?? e}`);
      }
    }
  }

  const opts = {
    dbName: DB_NAME,
    serverSelectionTimeoutMS: 45_000,
    family: 4 as const,
  };

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
      await mongoose.connect(MONGODB_URI, opts);
      console.log("Connected to MongoDB");
      lastDbError = null;
      return;
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.error(`MongoDB connection failed (attempt ${attempt}/3):`, msg);
      lastDbError = msg;
      if (attempt < 3 && /querySrv|ECONNREFUSED|ETIMEDOUT|ENOTFOUND/i.test(msg)) {
        await new Promise((r) => setTimeout(r, 2000 * attempt));
        continue;
      }
      if (/querySrv|ECONNREFUSED.*_mongodb\._tcp/i.test(msg)) {
        console.error(
          "Hint: SRV DNS lookup failed. In Atlas → Connect → Drivers, copy the non-SRV / standard connection string and set MONGODB_DIRECT_URI in .env, or fix DNS (e.g. use Google DNS 8.8.8.8 on Windows)."
        );
      }
      break;
    }
  }
};

// connectDB(); // Removed from here

// User Schema (MongoDB — replaces any prior Firestore user document shape)
const healthMetricsSchema = new mongoose.Schema(
  {
    height: Number,
    weight: Number,
    age: Number,
    gender: { type: String, enum: ["male", "female", "other"] },
    bmi: Number,
    bmiCategory: String,
  },
  { _id: false }
);

const subscriptionSchema = new mongoose.Schema(
  {
    id: String,
    status: { type: String, enum: ["active", "canceled", "past_due"] },
    currentPeriodEnd: Date,
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    /** Hashed password; omitted for Google-only accounts */
    password: { type: String, required: false },
    /** Google `sub` claim — links OAuth logins */
    googleId: { type: String, sparse: true, unique: true },
    /** How the account was created: email/password vs Google */
    authProvider: { type: String, enum: ["password", "google"], default: "password" },
    displayName: String,
    photoURL: String,
    role: { type: String, default: "user" }, // "user" | "pro" | "admin"
    onboardingCompleted: { type: Boolean, default: false },
    healthMetrics: healthMetricsSchema,
    subscription: subscriptionSchema,
    createdAt: { type: Date, default: Date.now },
  },
  { bufferCommands: false }
);

const User = mongoose.model("User", userSchema);

const PROFILE_PATCH_KEYS = new Set([
  "displayName",
  "photoURL",
  "onboardingCompleted",
  "healthMetrics",
  "subscription",
  "role",
]);

function toPublicUser(user: any) {
  if (!user) return null;
  const o = typeof user.toObject === "function" ? user.toObject() : { ...user };
  delete o.password;
  const id = o._id;
  const sub = o.subscription as { id?: string; status?: string; currentPeriodEnd?: Date } | undefined;
  return {
    uid: id != null ? String(id) : "",
    email: o.email,
    displayName: o.displayName ?? null,
    photoURL: o.photoURL ?? null,
    createdAt: o.createdAt,
    role: o.role === "pro" || o.role === "admin" ? o.role : "user",
    isPro: o.role === "pro",
    onboardingCompleted: o.onboardingCompleted ?? false,
    authProvider: o.authProvider === "google" ? "google" : "password",
    healthMetrics: o.healthMetrics,
    subscription: sub
      ? {
          id: sub.id,
          status: sub.status,
          currentPeriodEnd: sub.currentPeriodEnd,
        }
      : undefined,
  };
}

// Chat Schema
const chatSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, default: "New Conversation" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { bufferCommands: false });

const Chat = mongoose.model("Chat", chatSchema);

// Message Schema
const messageSchema = new mongoose.Schema({
  chatId: { type: mongoose.Schema.Types.ObjectId, ref: "Chat", required: true },
  role: { type: String, required: true }, // 'user' or 'model'
  content: { type: String, required: true },
  agentType: { type: String, default: "general" },
  fileUrl: String,
  fileType: String,
  options: [{ label: String, value: String }],
  timestamp: { type: Date, default: Date.now }
}, { bufferCommands: false });

const Message = mongoose.model("Message", messageSchema);

// Middleware to verify JWT
const authenticate = async (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const decoded = jwt.verify(token, jwtSecret()) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
};

async function startServer() {
  console.log("Starting server...");
  console.log(".env beside server.ts:", fs.existsSync(envPathBesideServer) ? "found" : "missing", `(${envPathBesideServer})`);
  console.log(".env in process.cwd():", fs.existsSync(path.resolve(process.cwd(), ".env")) ? "found" : "missing", `(${process.cwd()})`);
  console.log("MONGODB_URI configured:", !!MONGODB_URI);
  console.log("DB_NAME:", DB_NAME);
  await connectDB();
  const app = express();
  const httpServer = http.createServer(app);
  const preferredPort = parseInt(stripEnvQuotes(process.env.PORT) || "3000", 10);
  /** Set to the real listen port after bind (may differ if preferredPort was in use). */
  let oauthCallbackPort = preferredPort;

  if (stripEnvQuotes(process.env.TRUST_PROXY) === "true") {
    app.set("trust proxy", 1);
  }

  // CORS Middleware
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json({ limit: '50mb' }));

  /** Lets the SPA know if Google OAuth env vars are set (no DB required). */
  const authPathSkipsDb = (p: string) => p === "/api/auth/google/status";

  // Middleware to check DB connection
  app.use((req, res, next) => {
    if (authPathSkipsDb(req.path)) return next();
    if (mongoose.connection.readyState !== 1 && (req.path.startsWith('/api/auth') || req.path.startsWith('/api/chats'))) {
      const detail = !MONGODB_URI
        ? "Set MONGODB_URI in a .env file in the project root (same folder as server.ts), then restart the dev server."
        : lastDbError ||
          "Could not reach MongoDB. In Atlas: Network Access → allow your IP (or 0.0.0.0/0 for dev), verify user/password, and cluster is running.";
      return res.status(503).json({
        error: "Database not connected.",
        detail,
      });
    }
    next();
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    const uriOk = !!MONGODB_URI;
    res.json({
      status: "ok",
      database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
      uri_configured: uriOk,
      uri_present: uriOk,
      db_name: DB_NAME,
      last_error: lastDbError,
      env: process.env.NODE_ENV || "development",
      env_file_beside_server_ts: fs.existsSync(envPathBesideServer),
      env_file_in_cwd: fs.existsSync(path.resolve(process.cwd(), ".env")),
    });
  });

  function normalizeEmail(email: string): string {
    return String(email || "").trim().toLowerCase();
  }

  function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /** Prefer exact normalized email; fall back to case-insensitive match for legacy rows. */
  async function findUserByEmailNormalized(emailNorm: string) {
    let u = await User.findOne({ email: emailNorm });
    if (u) return u;
    return User.findOne({ email: { $regex: new RegExp(`^${escapeRegex(emailNorm)}$`, "i") } });
  }

  function getGoogleRedirectUri(req: express.Request): string {
    const fromEnv = normalizeGoogleRedirectUri(stripEnvQuotes(process.env.GOOGLE_OAUTH_REDIRECT_URI));
    if (fromEnv) return fromEnv;
    /**
     * In dev, default to a single canonical redirect (localhost + PORT) so Google Console only needs
     * one URI — avoids redirect_uri_mismatch when the app is opened as http://127.0.0.1:PORT.
     * Set GOOGLE_REDIRECT_USE_LOCALHOST=false to use the browser Host header instead.
     */
    const useCanonicalLocalhost =
      process.env.NODE_ENV !== "production" && stripEnvQuotes(process.env.GOOGLE_REDIRECT_USE_LOCALHOST) !== "false";
    if (useCanonicalLocalhost) {
      return normalizeGoogleRedirectUri(
        `http://localhost:${oauthCallbackPort}/api/auth/google/callback`
      );
    }
    const xfProto = req.get("x-forwarded-proto");
    const proto = (xfProto ? xfProto.split(",")[0] : req.protocol || "http").trim() || "http";
    const host = req.get("host")?.trim();
    if (!host) {
      return normalizeGoogleRedirectUri(
        `http://localhost:${oauthCallbackPort}/api/auth/google/callback`
      );
    }
    return normalizeGoogleRedirectUri(`${proto}://${host}/api/auth/google/callback`);
  }

  function appPublicOrigin(req: express.Request): string {
    const fixed = normalizeGoogleRedirectUri(stripEnvQuotes(process.env.APP_ORIGIN));
    if (fixed) return fixed;
    const xfProto = req.get("x-forwarded-proto");
    const proto = (xfProto ? xfProto.split(",")[0] : req.protocol || "http").trim() || "http";
    const host = req.get("host") || `localhost:${oauthCallbackPort}`;
    return `${proto}://${host}`;
  }

  const GOOGLE_OAUTH_SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ].join(" ");

  app.get("/api/auth/google/status", (req, res) => {
    const enabled = envGoogleOAuthConfigured();
    const body: Record<string, unknown> = { googleOAuthEnabled: enabled };
    if (enabled && process.env.NODE_ENV !== "production") {
      body.redirectUriThisHostWouldUse = getGoogleRedirectUri(req);
      body.hint =
        "Add that exact URL under Google Cloud Console → OAuth client → Authorized redirect URIs. Also add http://127.0.0.1:PORT/... if you open the app via 127.0.0.1.";
    }
    res.json(body);
  });

  app.get("/api/auth/google", (req, res) => {
    if (!envGoogleOAuthConfigured()) {
      return res.status(503).json({
        error: "Google sign-in is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.",
      });
    }
    // Signed state (no cookie): works the same whether you use localhost or 127.0.0.1 — avoids CSRF without host mismatch.
    const state = jwt.sign(
      { purpose: "google_oauth", nonce: crypto.randomBytes(24).toString("hex") },
      jwtSecret(),
      { expiresIn: "10m" }
    );
    const redirectUri = getGoogleRedirectUri(req);
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[Google OAuth] redirect_uri sent to Google (must match Console exactly):\n  ${redirectUri}`
      );
    }
    const clientId = stripEnvQuotes(process.env.GOOGLE_CLIENT_ID);
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", clientId!);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", GOOGLE_OAUTH_SCOPES);
    url.searchParams.set("state", state);
    url.searchParams.set("access_type", "online");
    url.searchParams.set("prompt", "select_account");
    res.redirect(302, url.toString());
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    const base = appPublicOrigin(req);
    const failRedirect = (msg: string) =>
      res.redirect(302, `${base}/?oauth_error=${encodeURIComponent(msg)}`);

    const qErr = req.query.error;
    if (qErr) {
      const desc = typeof req.query.error_description === "string" ? req.query.error_description : String(qErr);
      return failRedirect(desc || "Google OAuth error");
    }

    const code = req.query.code;
    if (!code || typeof code !== "string") {
      return failRedirect("Missing authorization code");
    }

    const stateParam = req.query.state;
    if (!stateParam || typeof stateParam !== "string") {
      return failRedirect("Missing OAuth state. Please start sign-in again.");
    }
    try {
      const decoded = jwt.verify(stateParam, jwtSecret()) as { purpose?: string };
      if (decoded.purpose !== "google_oauth") {
        return failRedirect("Invalid OAuth state. Please try signing in again.");
      }
    } catch {
      return failRedirect("OAuth state expired or invalid. Please try signing in again.");
    }

    if (!envGoogleOAuthConfigured()) {
      return failRedirect("Google sign-in is not configured on the server.");
    }

    const redirectUri = getGoogleRedirectUri(req);
    const clientId = stripEnvQuotes(process.env.GOOGLE_CLIENT_ID);
    const clientSecret = stripEnvQuotes(process.env.GOOGLE_CLIENT_SECRET);

    try {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId!,
          client_secret: clientSecret!,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        console.error("Google token exchange failed:", errText);
        return failRedirect("Could not complete Google sign-in. Check GOOGLE_OAUTH_REDIRECT_URI matches Google Cloud Console.");
      }

      const tokens = (await tokenRes.json()) as { access_token?: string };
      const accessToken = tokens.access_token;
      if (!accessToken) {
        return failRedirect("Google did not return an access token.");
      }

      const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!userRes.ok) {
        return failRedirect("Could not load your Google profile.");
      }

      const profile = (await userRes.json()) as {
        sub: string;
        email?: string;
        name?: string;
        picture?: string;
      };

      if (!profile.email) {
        return failRedirect("Google did not return an email address.");
      }

      const emailNorm = normalizeEmail(profile.email);

      let user = await User.findOne({ googleId: profile.sub });
      if (!user) {
        user = await findUserByEmailNormalized(emailNorm);
        if (user) {
          user.googleId = profile.sub;
          user.email = emailNorm;
          if (profile.picture) user.photoURL = profile.picture;
          if (profile.name && !user.displayName) user.displayName = profile.name;
          await user.save();
        } else {
          user = new User({
            email: emailNorm,
            googleId: profile.sub,
            authProvider: "google",
            displayName: profile.name || emailNorm.split("@")[0],
            photoURL:
              profile.picture ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || "U")}&background=random`,
          });
          await user.save();
        }
      } else {
        if (profile.picture) user.photoURL = profile.picture;
        if (profile.name) user.displayName = profile.name;
        await user.save();
      }

      const token = jwt.sign({ userId: user._id }, jwtSecret(), { expiresIn: "7d" });
      res.redirect(302, `${base}/?oauth_token=${encodeURIComponent(token)}`);
    } catch (e: any) {
      console.error("Google callback error:", e);
      return failRedirect(e?.message || "Google sign-in failed");
    }
  });

  // Auth Routes
  app.post("/api/auth/signup", async (req, res) => {
    const { email, password, displayName } = req.body;
    try {
      const emailNorm = normalizeEmail(email);
      const existingUser = await findUserByEmailNormalized(emailNorm);
      if (existingUser) return res.status(400).json({ error: "User already exists" });

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = new User({
        email: emailNorm,
        password: hashedPassword,
        displayName,
        photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName || 'U')}&background=random`
      });

      await user.save();
      
      const token = jwt.sign({ userId: user._id }, jwtSecret(), { expiresIn: "7d" });
      res.json({ token, user: toPublicUser(user) });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    try {
      const emailNorm = normalizeEmail(email);
      const user = await findUserByEmailNormalized(emailNorm);
      if (!user) return res.status(400).json({ error: "Invalid credentials" });

      if (!user.password) {
        return res.status(400).json({
          error: "This account uses Google sign-in. Use “Continue with Google” instead.",
        });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

      const token = jwt.sign({ userId: user._id }, jwtSecret(), { expiresIn: "7d" });
      res.json({ token, user: toPublicUser(user) });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token" });

    try {
      const decoded = jwt.verify(token, jwtSecret()) as { userId: string };
      const user = await User.findById(decoded.userId).select("-password");
      if (!user) return res.status(404).json({ error: "User not found" });

      res.json(toPublicUser(user));
    } catch (error) {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  app.patch("/api/auth/profile", authenticate, async (req: any, res) => {
    try {
      const updates: Record<string, unknown> = {};
      for (const key of PROFILE_PATCH_KEYS) {
        if (key in req.body) updates[key] = req.body[key];
      }
      const user = await User.findByIdAndUpdate(req.userId, { $set: updates }, { new: true }).select("-password");
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(toPublicUser(user));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Chat Routes
  app.get("/api/chats", authenticate, async (req: any, res) => {
    try {
      const chats = await Chat.find({ userId: req.userId }).sort({ updatedAt: -1 });
      res.json(chats.map(c => ({ id: c._id, ...c.toObject() })));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/chats", authenticate, async (req: any, res) => {
    try {
      const chat = new Chat({ userId: req.userId, title: req.body.title });
      await chat.save();
      res.json({ id: chat._id, ...chat.toObject() });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/chats/:id", authenticate, async (req: any, res) => {
    try {
      await Chat.findOneAndDelete({ _id: req.params.id, userId: req.userId });
      await Message.deleteMany({ chatId: req.params.id });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/chats/:id/messages", authenticate, async (req: any, res) => {
    try {
      const messages = await Message.find({ chatId: req.params.id }).sort({ timestamp: 1 });
      res.json(messages.map(m => ({ id: m._id, ...m.toObject() })));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/chats/:id/messages", authenticate, async (req: any, res) => {
    try {
      const message = new Message({
        chatId: req.params.id,
        ...req.body
      });
      await message.save();
      await Chat.findByIdAndUpdate(req.params.id, { updatedAt: Date.now() });
      res.json({ id: message._id, ...message.toObject() });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Groq Chat Completion
  app.post("/api/ai/chat", async (req, res) => {
    const { messages, model, temperature, top_p, stream } = req.body;
    
    if (!process.env.GROQ_API_KEY) {
      console.error("GROQ_API_KEY is missing in environment variables.");
      return res.status(500).json({ error: "GROQ_API_KEY is missing. Please add it to the project secrets in the AI Studio settings." });
    }

    try {
      const completion = await groq.chat.completions.create({
        messages,
        model: model || "llama-3.3-70b-versatile",
        temperature: temperature ?? 0.7,
        top_p: top_p ?? 0.95,
        stream: stream ?? false,
      });

      res.json(completion);
    } catch (error: any) {
      console.error("Groq Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Gemini 2.5 Flash (used for uploaded medical files/images)
  app.post("/api/ai/gemini", async (req, res) => {
    const { model, systemInstruction, contents, generationConfig } = req.body ?? {};
    const apiKey = stripEnvQuotes(process.env.GEMINI_API_KEY);

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is missing. Add it to your .env to enable medical file/image analysis.",
      });
    }
    if (!Array.isArray(contents) || contents.length === 0) {
      return res.status(400).json({ error: "contents is required and must be a non-empty array." });
    }

    try {
      const endpointModel = String(model || "gemini-2.5-flash");
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(endpointModel)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents,
            systemInstruction: systemInstruction
              ? { parts: [{ text: String(systemInstruction) }] }
              : undefined,
            generationConfig: {
              temperature: generationConfig?.temperature ?? 0.55,
              topP: generationConfig?.topP ?? 0.9,
              maxOutputTokens: generationConfig?.maxOutputTokens ?? 2048,
            },
          }),
        }
      );

      const raw = await response.text();
      let data: any = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { error: { message: raw || "Invalid response from Gemini API" } };
      }
      if (!response.ok) {
        return res.status(response.status).json({
          error: data?.error?.message || "Gemini request failed",
          raw: data,
        });
      }

      return res.json(data);
    } catch (error: any) {
      console.error("Gemini Error:", error);
      return res.status(500).json({ error: error?.message || "Gemini request failed" });
    }
  });

  // Tavily Search
  app.post("/api/ai/search", async (req, res) => {
    const { query, max_results } = req.body;
    
    if (!process.env.TAVILY_API_KEY) {
      console.error("TAVILY_API_KEY is missing in environment variables.");
      return res.status(500).json({ error: "TAVILY_API_KEY is missing. Please add it to the project secrets in the AI Studio settings." });
    }

    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: process.env.TAVILY_API_KEY,
          query,
          search_depth: "basic",
          max_results: max_results || 2,
        }),
      });

      const raw = await response.text();
      let data: any = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { detail: raw || "Invalid response from Tavily API" };
      }

      if (!response.ok) {
        throw new Error(data.detail || data.error?.message || "Failed to call Tavily API");
      }

      res.json(data);
    } catch (error: any) {
      console.error("Tavily Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Stripe Checkout Session
  app.post("/api/create-checkout-session", async (req, res) => {
    const { userId, email } = req.body;

    if (!userId || !email) {
      return res.status(400).json({ error: "Missing userId or email" });
    }

    if (!stripe) {
      return res.status(503).json({ error: "Stripe is not configured. Set STRIPE_SECRET_KEY in .env." });
    }

    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "inr",
              product_data: {
                name: "HealthBuddy Pro Membership",
                description: "Monthly subscription for Pro features",
              },
              unit_amount: 5000, // 50.00 INR
              recurring: {
                interval: "month",
              },
            },
            quantity: 1,
          },
        ],
        mode: "subscription",
        success_url: `${req.headers.origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.headers.origin}/pricing`,
        customer_email: email,
        metadata: {
          userId,
        },
      });

      res.json({ id: session.id });
    } catch (error: any) {
      console.error("Stripe Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Stripe webhook — upgrade user in MongoDB (verify Stripe signature in production).
  app.post("/api/webhook", async (req, res) => {
    const event = req.body;

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data?.object;
          const userId = session?.metadata?.userId;
          if (userId && mongoose.connection.readyState === 1) {
            const subId = session.subscription != null ? String(session.subscription) : String(session.id);
            await User.findByIdAndUpdate(userId, {
              $set: {
                role: "pro",
                subscription: {
                  id: subId,
                  status: "active",
                  currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                },
              },
            });
            console.log("MongoDB: Pro subscription recorded for user", userId);
          }
          break;
        }
        default:
          console.log(`Unhandled Stripe event type ${event.type}`);
      }
    } catch (e) {
      console.error("Webhook handler error:", e);
    }

    res.json({ received: true });
  });

  // Vite middleware for development (HMR on same HTTP server avoids extra WebSocket port, e.g. 24678)
  if (process.env.NODE_ENV !== "production") {
    const hmrOff = process.env.DISABLE_HMR === "true";
    const vite = await createViteServer({
      root: envRoot,
      envDir: envRoot,
      configFile: path.resolve(envRoot, "vite.config.ts"),
      server: {
        middlewareMode: true,
        ...(hmrOff ? { hmr: false } : { hmr: { server: httpServer } }),
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const tryListen = (port: number) =>
    new Promise<void>((resolve, reject) => {
      const onErr = (err: NodeJS.ErrnoException) => {
        httpServer.off("error", onErr);
        reject(err);
      };
      httpServer.once("error", onErr);
      httpServer.listen(port, "0.0.0.0", () => {
        httpServer.off("error", onErr);
        resolve();
      });
    });

  const closeServer = () =>
    new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });

  let boundPort = preferredPort;
  try {
    await tryListen(preferredPort);
  } catch (first: any) {
    if (first?.code !== "EADDRINUSE") throw first;
    await closeServer().catch(() => {});
    let ok = false;
    for (let p = preferredPort + 1; p <= preferredPort + 20; p++) {
      try {
        await tryListen(p);
        boundPort = p;
        ok = true;
        if (p !== preferredPort) {
          console.warn(`Port ${preferredPort} was busy; using ${p} instead. Set PORT=${p} in .env to keep this port.`);
        }
        break;
      } catch (e: any) {
        if (e?.code !== "EADDRINUSE") throw e;
        await closeServer().catch(() => {});
      }
    }
    if (!ok) {
      console.error(
        `No free port from ${preferredPort} to ${preferredPort + 20}. Stop other servers or set PORT in .env.`
      );
      process.exit(1);
    }
  }

  oauthCallbackPort = boundPort;

  console.log(`Server running on http://localhost:${boundPort}`);
  if (envGoogleOAuthConfigured()) {
    const fromEnv = normalizeGoogleRedirectUri(stripEnvQuotes(process.env.GOOGLE_OAUTH_REDIRECT_URI));
    const canonicalDev =
      process.env.NODE_ENV !== "production" && stripEnvQuotes(process.env.GOOGLE_REDIRECT_USE_LOCALHOST) !== "false";
    if (fromEnv) {
      console.log(
        "Google OAuth: enabled. Google Cloud Console → Authorized redirect URIs — add exactly:\n  " + fromEnv
      );
    } else if (canonicalDev) {
      const one = normalizeGoogleRedirectUri(`http://localhost:${boundPort}/api/auth/google/callback`);
      console.log(
        "Google OAuth: enabled (dev: single canonical redirect). Add this exact URI in Google Cloud Console:\n  " +
          one +
          "\n  After Google sign-in you land on localhost (not 127.0.0.1). Or set GOOGLE_REDIRECT_USE_LOCALHOST=false and add both localhost + 127.0.0.1 URIs."
      );
    } else {
      const loc = normalizeGoogleRedirectUri(`http://localhost:${boundPort}/api/auth/google/callback`);
      const ip = loc.replace(/\/\/localhost(?=:)/, "//127.0.0.1");
      console.log(
        "Google OAuth: enabled. Add BOTH redirect URIs in Google Cloud Console:\n  " + loc + "\n  " + ip
      );
    }
  } else {
    console.log(
      "Google OAuth: disabled — add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env (then restart)."
    );
  }
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
});
