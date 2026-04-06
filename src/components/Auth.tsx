import React, { useState, useEffect, useRef } from 'react';
import {
  Mail,
  Lock,
  User,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

type AuthMode = 'login' | 'signup';

function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function XGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const pillInput =
  'h-[52px] w-full rounded-full border border-white/[0.1] bg-zinc-900/70 pl-4 text-[15px] text-white placeholder:text-zinc-600 outline-none transition focus:border-emerald-500/35 focus:bg-zinc-900/90';

export default function Auth({ onAuthSuccess }: { onAuthSuccess: (user: any) => void }) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  /** Server returned 200 and googleOAuthEnabled === false */
  const [googleSignInBlocked, setGoogleSignInBlocked] = useState(false);
  const [googleProbeComplete, setGoogleProbeComplete] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const displayNameRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('oauth_error');
    if (stored) {
      setError(stored);
      sessionStorage.removeItem('oauth_error');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const probe = () => {
      fetch('/api/auth/google/status')
        .then((r) => {
          if (!r.ok) throw new Error(String(r.status));
          return r.json() as Promise<{ googleOAuthEnabled?: boolean }>;
        })
        .then((data) => {
          if (!cancelled) setGoogleSignInBlocked(!data.googleOAuthEnabled);
        })
        .catch(() => {
          // Network / non-JSON: do not block the button — server may still have OAuth configured.
          if (!cancelled) setGoogleSignInBlocked(false);
        })
        .finally(() => {
          if (!cancelled) setGoogleProbeComplete(true);
        });
    };
    probe();
    const onVis = () => {
      if (document.visibilityState === 'visible') probe();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const passwordsMatch = mode === 'signup' && password.length > 0 && password === confirmPassword;

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      const endpoint = mode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName }),
      });

      const contentType = response.headers.get('content-type');
      let data;
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.error('Non-JSON response received:', text);
        throw new Error('Server returned an unexpected response. Please check if the backend is running correctly.');
      }

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      localStorage.setItem('token', data.token);
      onAuthSuccess(data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const startGoogleAuth = () => {
    setError(null);
    window.location.href = '/api/auth/google';
  };

  /** Reference UI: arrow in email row — step through fields or submit when ready. */
  const handleEmailRowArrow = () => {
    setError(null);
    if (mode === 'signup') {
      if (!displayName.trim()) {
        displayNameRef.current?.focus();
        return;
      }
      if (!email.trim()) {
        emailInputRef.current?.focus();
        return;
      }
      if (!password) {
        passwordRef.current?.focus();
        return;
      }
      if (!confirmPassword) {
        confirmRef.current?.focus();
        return;
      }
      formRef.current?.requestSubmit();
      return;
    }
    if (!email.trim()) {
      emailInputRef.current?.focus();
      return;
    }
    if (!password) {
      passwordRef.current?.focus();
      return;
    }
    formRef.current?.requestSubmit();
  };

  const headline = mode === 'login' ? 'Welcome back' : 'Create your account';
  const subline =
    mode === 'login' ? 'Sign in to your account' : 'Sign up to start with HealthBuddy';

  return (
    <div className="auth-glass-page relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-black" />

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-[360px]"
        style={{
          aspectRatio: '4 / 5',
          maxHeight: 'min(90vh, 640px)',
        }}
      >
        <div
          className={cn(
            'relative flex h-full min-h-[100%] min-w-0 flex-col overflow-hidden rounded-[2.5rem]',
            'border border-white/10 bg-black/60 shadow-2xl shadow-black/60',
            'backdrop-blur-[20px]'
          )}
        >
          {/* Glass accents: mint corner glow + diagonal sheen */}
          <div
            className="pointer-events-none absolute inset-0 rounded-[2.5rem]"
            style={{
              background:
                'radial-gradient(ellipse 85% 70% at 0% 0%, rgb(52 211 153 / 0.22), transparent 52%), linear-gradient(118deg, transparent 35%, rgb(255 255 255 / 0.05) 48%, transparent 62%)',
            }}
          />
          <div className="pointer-events-none absolute inset-0 rounded-[2.5rem] ring-1 ring-inset ring-white/[0.07]" />

          <div className="relative flex h-full min-h-0 flex-1 flex-col px-7 pb-8 pt-9 sm:px-8 sm:pt-10">
            <header className="mb-6 shrink-0 text-center sm:mb-8">
              <h1 className="text-[1.65rem] font-bold tracking-tight text-white sm:text-[1.75rem]">
                {headline}
              </h1>
              <p className="mt-2 text-sm text-zinc-500">{subline}</p>
            </header>

            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4 shrink-0 rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-200"
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto sm:gap-7">
            <form
              ref={formRef}
              onSubmit={handleEmailAuth}
              className="relative flex flex-col gap-5 sm:gap-6"
            >
              {mode === 'signup' && (
                <div>
                  <label className="mb-2 block text-xs font-medium text-zinc-500">Name</label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-zinc-500" />
                    <input
                      ref={displayNameRef}
                      type="text"
                      required
                      autoComplete="name"
                      placeholder="Your name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className={cn(pillInput, 'pl-11')}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="mb-2 block text-xs font-medium text-zinc-500">Email</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 z-[1] h-[18px] w-[18px] -translate-y-1/2 text-zinc-500" />
                  <input
                    ref={emailInputRef}
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={cn(pillInput, 'pl-11 pr-[52px]')}
                  />
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={handleEmailRowArrow}
                    className={cn(
                      'absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full',
                      'bg-gradient-to-br from-cyan-400 via-teal-400 to-emerald-500 text-white shadow-lg shadow-emerald-500/25',
                      'transition hover:brightness-110 active:scale-95 disabled:opacity-50'
                    )}
                    aria-label="Continue"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label className="text-xs font-medium text-zinc-500">Password</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      className="text-xs text-zinc-500 transition hover:text-zinc-300"
                      onClick={() =>
                        setError('Password reset is not available yet. Contact support if you need help.')
                      }
                    >
                      Forgot?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-zinc-500" />
                  <input
                    ref={passwordRef}
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={cn(pillInput, 'pl-11 pr-12')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 transition hover:text-zinc-300"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {mode === 'signup' && (
                <div>
                  <label className="mb-2 block text-xs font-medium text-zinc-500">Confirm password</label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-zinc-500" />
                    <input
                      ref={confirmRef}
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={cn(
                        pillInput,
                        'pl-11 pr-12',
                        passwordsMatch && 'border-emerald-500/40'
                      )}
                    />
                  </div>
                  <AnimatePresence>
                    {passwordsMatch && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="mt-2 flex items-center gap-2 px-1 text-xs font-medium text-emerald-400"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Passwords match
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              <button type="submit" hidden tabIndex={-1} aria-hidden>
                Submit
              </button>
            </form>

            <div className="relative shrink-0 py-1 sm:py-0">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/[0.08]" />
              </div>
              <div className="relative flex justify-center text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">
                <span className="bg-black/80 px-3 backdrop-blur-sm">or</span>
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-3">
              <button
                type="button"
                disabled={googleProbeComplete && googleSignInBlocked}
                onClick={startGoogleAuth}
                className={cn(
                  'flex h-[52px] w-full items-center gap-3 rounded-full border border-white/[0.08] px-4 text-[15px] font-medium text-white transition',
                  'bg-zinc-800/70 hover:border-white/15 hover:bg-zinc-800/90',
                  googleProbeComplete && googleSignInBlocked && 'cursor-not-allowed opacity-55'
                )}
              >
                <GoogleGlyph className="h-5 w-5 shrink-0" />
                <span className="flex-1 text-left">Continue with Google</span>
                <ArrowRight className="h-4 w-4 shrink-0 text-zinc-500" />
              </button>

              <button
                type="button"
                disabled
                title="X sign-in is not connected yet"
                className="flex h-[52px] w-full cursor-not-allowed items-center gap-3 rounded-full border border-white/[0.06] px-4 text-[15px] font-medium text-zinc-500 opacity-60"
              >
                <XGlyph className="h-4 w-4 shrink-0 text-white" />
                <span className="flex-1 text-left">Continue with X</span>
                <ArrowRight className="h-4 w-4 shrink-0 text-zinc-600" />
              </button>
            </div>

            {googleProbeComplete && googleSignInBlocked && (
              <p className="shrink-0 text-center text-[11px] leading-snug text-zinc-600">
                Server reports Google OAuth is off. Add{' '}
                <span className="font-mono text-zinc-500">GOOGLE_CLIENT_ID</span> &{' '}
                <span className="font-mono text-zinc-500">GOOGLE_CLIENT_SECRET</span> to{' '}
                <span className="font-mono text-zinc-500">.env</span> next to{' '}
                <span className="font-mono text-zinc-500">server.ts</span>, then restart{' '}
                <span className="font-mono text-zinc-500">npm run dev</span>.
              </p>
            )}
              </div>

              <p className="shrink-0 pt-5 text-center text-sm text-zinc-500 sm:pt-6">
                {mode === 'login' ? (
                  <>
                    Don&apos;t have an account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('signup');
                        setError(null);
                      }}
                      className="font-semibold text-emerald-400 transition hover:text-emerald-300"
                    >
                      Sign up
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('login');
                        setError(null);
                      }}
                      className="font-semibold text-emerald-400 transition hover:text-emerald-300"
                    >
                      Sign in
                    </button>
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-zinc-600">
          HealthBuddy is for education only and is not a substitute for professional medical advice.
        </p>
      </motion.div>
    </div>
  );
}
