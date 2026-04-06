import { AgentType } from "../types";

/** Makes replies feel like a real conversation, not a template or textbook. */
const REALISTIC_VOICE = `
Conversation style (critical):
- Sound like a thoughtful clinician talking to one person, not a brochure or lecture. Use natural rhythm: mix short sentences with a few longer ones; avoid repeating the same opening ("It is important to note…", "In summary…") every time.
- Briefly acknowledge their situation in plain words before diving in (e.g. that sounds uncomfortable, thanks for the detail, I hear you). Match a calm, human tone—warm when reassuring, direct when safety is involved.
- Prefer short paragraphs over bullets unless steps or a list genuinely helps. Don't bold every other line; use **bold** only for warnings or key takeaways.
- One light reminder that this is education—not a formal diagnosis or replacement for an in-person visit—is enough per reply; don't stack multiple legal disclaimers.
- When something is uncertain, say it naturally ("From what you've shared…", "I can't examine you, so…") instead of a formal limitations list.
- Ask at most one or two focused follow-up questions when it would change the advice (timing, severity, meds, allergies).
`.trim();

/** Appended to every agent so off-topic chat stays health-scoped without an extra API call. */
const HEALTH_SCOPE_GUARD = `
OFF-TOPIC RULE (mandatory): You are Dr. HealthBuddy—a health-focused AI assistant, not a general chatbot.
- If the user's message is clearly NOT about health, medicine, symptoms, wellness, nutrition, exercise, sleep, stress, mental wellbeing (general coping only), medications, vaccines, lab or imaging reports, injuries, or the human body, do NOT answer their actual request (no code, homework, recipes unrelated to diet health, politics, sports scores, jokes-only, etc.).
- Instead reply in 2–5 short sentences: politely say you are a doctor-style health assistant and you only help with health-related topics; your information is educational and not a substitute for an in-person clinician; invite them to ask a health question.
- If the message mixes health and non-health, address only the health part or briefly steer back to health.
- Match the user's language when possible (e.g. Hindi if they wrote in Hindi).
`.trim();

const SYSTEM_INSTRUCTIONS: Record<AgentType, string> = {
  general:
    "You are Dr. HealthBuddy—an experienced, approachable doctor in a chat. Give clear, evidence-based guidance in a warm, conversational voice (not stiff or encyclopedic). Be honest about limits of chat advice. If something could be serious, say so plainly and suggest appropriate care.",
  symptom:
    "You are Dr. HealthBuddy helping someone think through symptoms. Listen to their story, ask sensible follow-ups about timing, severity, and context, and explain possible explanations in everyday language—not a cold checklist. These are possibilities, not diagnoses. If anything sounds like an emergency, tell them to seek urgent or emergency care immediately.",
  medication:
    "You are Dr. HealthBuddy discussing medications in plain language: what drugs are generally used for, typical cautions, and interactions at a high level. Never tell them to start, stop, or change a dose. Encourage their prescriber or pharmacist for personal decisions. Avoid pushing specific brands or doses.",
  lifestyle:
    "You are Dr. HealthBuddy as a lifestyle coach: practical, realistic suggestions for food, movement, sleep, and stress that fit real life. Encourage small steps, not perfection. Stay encouraging and specific.",
  remedy:
    "You are Dr. HealthBuddy suggesting safe, evidence-informed self-care for minor, self-limiting issues. Be clear what usually gets better with time and what symptoms mean they should see a clinician.",
};

function systemPromptForAgent(agentType: AgentType): string {
  return `${SYSTEM_INSTRUCTIONS[agentType]}\n\n${REALISTIC_VOICE}\n\n${HEALTH_SCOPE_GUARD}`;
}

export interface FileData {
  mimeType: string;
  data: string; // base64
}

const PRIMARY_TEXT_MODEL = "moonshotai/kimi-k2-instruct-0905";
const SECONDARY_TEXT_MODEL = "mixtral-8x7b-32768";
const TEXT_MODELS = [PRIMARY_TEXT_MODEL, SECONDARY_TEXT_MODEL];
const VISION_MODELS = ["llama-3.2-90b-vision-preview"];
const GEMINI_FILE_MODEL = "gemini-2.5-flash";
const MEDICAL_VISION_SYSTEM = `
You are a medical-image analysis assistant for educational support.
The attached image/PDF is available in this request.
Do not say you cannot view the image unless the file is truly unreadable.

Use the YELLOW framework:
Y — Yield key visible findings (what is clearly seen)
E — Evaluate likely clinical meaning (with uncertainty)
L — List urgent red flags that need emergency care
L — Lay out practical next steps and what to ask a doctor
O — Outline limitations (not a formal diagnosis)
W — Write in clear, simple language
`.trim();

async function callGroq(
  messages: any[],
  model: string = PRIMARY_TEXT_MODEL,
  sampling?: { temperature?: number; top_p?: number }
) {
  const response = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages,
      model,
      temperature: sampling?.temperature ?? 0.78,
      top_p: sampling?.top_p ?? 0.9,
    }),
  });

  const raw = await response.text();
  let data: any = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { error: raw || "Invalid response from Groq API" };
  }

  if (!response.ok) {
    throw new Error(data?.error || data?.message || "Failed to call Groq API");
  }

  return data;
}

async function callGemini(
  contents: any[],
  systemInstruction: string,
  sampling?: { temperature?: number; top_p?: number }
) {
  const response = await fetch("/api/ai/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GEMINI_FILE_MODEL,
      systemInstruction,
      contents,
      generationConfig: {
        temperature: sampling?.temperature ?? 0.6,
        topP: sampling?.top_p ?? 0.9,
      },
    }),
  });

  const raw = await response.text();
  let data: any = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { error: raw || "Invalid response from Gemini API" };
  }
  if (!response.ok) {
    throw new Error(data?.error || data?.message || "Failed to call Gemini API");
  }
  return data;
}

function extractGeminiText(result: any): string {
  const parts = result?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((p: any) => (typeof p?.text === "string" ? p.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

function isGeminiFileSupported(mimeType?: string): boolean {
  if (!mimeType) return false;
  const m = mimeType.toLowerCase();
  return m.startsWith("image/") || m === "application/pdf";
}

function looksLikeCannotViewResponse(text?: string): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  return (
    (t.includes("can't see") || t.includes("cannot see") || t.includes("not able to") || t.includes("can't open") || t.includes("cannot open")) &&
    (t.includes("image") || t.includes("file") || t.includes("report"))
  );
}

function isRecoverableModelError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    msg.includes("decommissioned") ||
    msg.includes("model_decommissioned") ||
    msg.includes("model_not_found") ||
    msg.includes("does not exist")
  );
}

async function callGroqWithModelFallback(
  messages: any[],
  preferredModels: string[],
  sampling?: { temperature?: number; top_p?: number }
) {
  let lastError: unknown;
  for (const model of preferredModels) {
    try {
      return await callGroq(messages, model, sampling);
    } catch (error) {
      lastError = error;
      // Retry only when the model itself is unavailable/decommissioned/not found.
      if (!isRecoverableModelError(error)) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("No available model could process this request.");
}

async function searchTavily(query: string, maxResults: number = 2): Promise<string> {
  try {
    const response = await fetch("/api/ai/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, max_results: maxResults }),
    });

    if (!response.ok) {
      return "No verified information found.";
    }

    const raw = await response.text();
    let data: any = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      return "No verified information found.";
    }
    if (data.results && data.results.length > 0) {
      return data.results.map((r: any) => `**${r.title}**\n${r.content.slice(0, 500)}...\nSource: ${r.url}`).join("\n\n");
    }
    return "No verified information found.";
  } catch (error) {
    console.error("Tavily Search Error:", error);
    return "No verified information found.";
  }
}

export async function generateHealthResponse(
  prompt: string,
  agentType: AgentType = 'general',
  history: { role: 'user' | 'model', content: string }[] = [],
  isSearchEnabled: boolean = false,
  isReasonEnabled: boolean = false,
  fileData?: FileData,
  /** Saved profile vitals — injected into system prompt so the model can personalize without polluting chat text. */
  healthContextForSystem?: string
): Promise<string> {
  let finalPrompt = prompt;
  if (isSearchEnabled) {
    const searchResults = await searchTavily(prompt);
    finalPrompt = `[Verified Medical Information from Web Search]:\n${searchResults}\n\n[User Query]: ${prompt}`;
  }

  let systemContent = systemPromptForAgent(agentType);
  const ctx = healthContextForSystem?.trim();
  if (ctx) {
    systemContent += `\n\nPatient baseline (saved profile — use for personalized, evidence-based guidance when relevant; BMI is informational only, not a diagnosis): ${ctx}`;
  }
  if (isSearchEnabled) {
    systemContent += `\n\nWeb search snippets may appear above the user's message. Weave that information into a natural reply—don't paste raw blocks or sound like a search engine summary. Mention sources in passing when helpful (e.g. "guidelines often suggest…").`;
  }
  if (isReasonEnabled) {
    systemContent += `\n\nReason mode: think step-by-step briefly, but still answer in conversational prose—no numbered "Step 1 / Step 2" unless the user asked for steps.`;
  }
  if (fileData) {
    systemContent += `\n\nImage/report analysis mode: The user may upload medical images (prescription photos, lab report photos, X-ray, ECG, MRI, or other clinical pictures) or PDF reports. The attachment is available to you in this request. Carefully describe findings visible in the file, mention uncertainty clearly, avoid definitive diagnosis from image alone, and suggest appropriate next clinical steps. Do not say you cannot view the image/file unless the attachment is actually unreadable.`;
  }

  const messages: any[] = [
    { role: "system", content: systemContent },
    ...history.map(h => ({
      role: h.role === 'model' ? 'assistant' : 'user',
      content: h.content
    }))
  ];

  if (fileData) {
    if (!isGeminiFileSupported(fileData.mimeType)) {
      return "I can analyze medical images and PDF reports right now. Please upload a clear image (jpg/png/webp) or a PDF report, and I will review it in detail.";
    }
    const recentUserContext = history
      .filter((h) => h.role === "user")
      .slice(-2)
      .map((h) => h.content.trim())
      .filter(Boolean)
      .join("\n");

    const geminiContents: any[] = [
      {
        role: "user",
        parts: [
          {
            text:
              `${recentUserContext ? `Recent user context:\n${recentUserContext}\n\n` : ""}` +
              `Current request: ${finalPrompt}\n\n` +
              `Please analyze the attached medical file in this same request.\n` +
              `Focus on extracting visible findings/numbers/text and explain likely medical meaning in simple terms.\n` +
              `Do not ask the user to describe the image unless the attachment is truly unreadable.`
          },
          { inlineData: { mimeType: fileData.mimeType, data: fileData.data } }
        ]
      }
    ];
    try {
      const result = await callGemini(geminiContents, MEDICAL_VISION_SYSTEM, {
        temperature: isReasonEnabled ? 0.68 : 0.8,
        top_p: isReasonEnabled ? 0.88 : 0.92,
      });
      let text = extractGeminiText(result);
      if (looksLikeCannotViewResponse(text)) {
        const retryContents = [
          {
            role: "user",
            parts: [
              {
                text:
                  `Analyze this attached medical file now. Extract as much visible content as possible (labels, values, medicines, impressions).\n` +
                  `If partially readable, still provide a best-effort interpretation and clearly mark uncertain parts.\n` +
                  `Only say IMAGE_READ_ERROR if the attachment is genuinely corrupted/unreadable.`
              },
              { inlineData: { mimeType: fileData.mimeType, data: fileData.data } }
            ]
          }
        ];
        const retry = await callGemini(retryContents, MEDICAL_VISION_SYSTEM, {
          temperature: 0.55,
          top_p: 0.9,
        });
        text = extractGeminiText(retry);
      }
      if (text) return text;
    } catch (error) {
      console.error("Gemini API Error (file analysis fallback to text):", error);
    }
    messages.push({
      role: "user",
      content:
        `${finalPrompt}\n\n[Note: uploaded file could not be analyzed directly right now. Provide best possible medical guidance from available text.]`,
    });
  } else {
    messages.push({ role: "user", content: finalPrompt });
  }

  try {
    // Slightly higher temperature for natural phrasing; a bit lower when "Reason" is on for steadier logic.
    const temperature = isReasonEnabled ? 0.68 : 0.8;
    const top_p = isReasonEnabled ? 0.88 : 0.92;
    const preferredModels = TEXT_MODELS;
    const result = await callGroqWithModelFallback(messages, preferredModels, { temperature, top_p });
    return result.choices[0].message.content || "I'm sorry, I couldn't generate a response at this time.";
  } catch (error) {
    console.error("Groq API Error:", error);
    throw error;
  }
}

// Helper functions for fallback logic (from Python reference)
const COMMON_SYMPTOM_STOPWORDS = new Set([
  "and", "with", "for", "the", "have", "has", "had", "from", "that", "this",
  "after", "before", "been", "over", "under", "into", "your", "about", "feel",
  "feeling", "days", "day", "weeks", "week", "hours", "hour",
]);

function extractSymptoms(input: string): string[] {
  const chunks = input.toLowerCase().split(/,|\||;|\band\b|\bwith\b/);
  const symptoms: string[] = [];
  for (const chunk of chunks) {
    let cleaned = chunk.replace(/[^a-z0-9']/g, ' ').replace(/\b\d+\b/g, '').trim();
    if (!cleaned) continue;
    const words = cleaned.split(/\s+/).filter(word => !COMMON_SYMPTOM_STOPWORDS.has(word));
    const phrase = words.join(' ').trim();
    if (phrase && !symptoms.includes(phrase)) {
      symptoms.push(phrase);
    }
  }
  return symptoms.length > 0 ? symptoms.slice(0, 4) : ["general illness symptoms"];
}

function hasRedFlags(input: string): boolean {
  const redFlags = [
    "chest pain", "shortness of breath", "breathing trouble", "confusion",
    "seizure", "fainting", "severe dehydration", "blue lips", "stroke",
    "pregnant bleeding", "unconscious", "severe abdominal pain",
  ];
  const lowered = input.toLowerCase();
  return redFlags.some(flag => lowered.includes(flag));
}

function likelyConditionRows(symptoms: string[]): string {
  const first = symptoms[0];
  let rows = [
    `| Viral illness | ${first}, fatigue, recent onset | Moderate |`,
    `| Upper respiratory infection | fever, cough, sore throat, congestion | Moderate |`,
    `| Seasonal allergy or irritation | mild symptoms without high fever | Low |`,
  ];
  
  const input = symptoms.join(' ');
  if (/stomach|vomit|diarr/.test(input)) {
    rows[1] = `| Stomach infection | nausea, diarrhea, abdominal cramps | Moderate |`;
  }
  if (/headache/.test(input)) {
    rows.push(`| Tension or migraine pattern | headache, light sensitivity, stress triggers | Low-Moderate |`);
  }
  return rows.slice(0, 4).join('\n');
}

function getFallbackSymptomAnalysis(input: string) {
  return {
    title: "Symptom Analysis",
    headers: ["Condition", "Key Indicators", "Likelihood"],
    rows: [
      ["Common Cold", "Runny nose, mild fever", "High"],
      ["Influenza", "High fever, body aches", "Moderate"],
      ["Allergies", "Itchy eyes, sneezing", "Moderate"]
    ]
  };
}

function getFallbackMedicationAdvice(input: string) {
  return {
    title: "Medication Advice",
    headers: ["Medication", "Consumption", "Dose", "Precautions", "Link"],
    rows: [
      ["Paracetamol / Crocin", "After food or with water", "500 to 650 mg", "Avoid exceeding daily label maximum", "https://www.amazon.com/s?k=paracetamol"],
      ["Ibuprofen / Advil", "Take with food", "200 to 400 mg", "Avoid in ulcers, kidney disease", "https://www.amazon.com/s?k=ibuprofen"]
    ]
  };
}

function getFallbackHomeRemedies(input: string) {
  return {
    title: "Home Remedies",
    headers: ["Remedy", "How to Use", "Why It Helps", "Caution"],
    rows: [
      ["Water or oral fluids", "Small frequent sips", "Prevents dehydration", "Seek care if unable to keep fluids down"],
      ["Warm soups", "Eat simple foods", "Supports energy", "Avoid greasy or very spicy meals"]
    ]
  };
}

function getFallbackDietLifestyle(input: string) {
  return {
    title: "Diet & Lifestyle",
    headers: ["Meal Time", "What to Eat", "Why It Helps", "Portion Tips"],
    rows: [
      ["Breakfast", "Oats, toast, fruit, warm tea", "Gentle energy and hydration", "Keep portions light"],
      ["Lunch", "Rice, dal, soup, cooked vegetables", "Easy digestion", "Eat slowly"],
      ["Dinner", "Khichdi, broth, soft protein", "Maintains calories", "Choose smaller servings"]
    ]
  };
}

function getFallbackDoctorRecommendations(input: string) {
  return {
    title: "Doctor Referral",
    headers: ["Doctor / Facility", "Specialty", "Location", "How to Book"],
    rows: [
      ["Nearby primary care clinic", "General medicine", "Local area", "Call reception"],
      ["Multispecialty hospital OPD", "Internal medicine", "Nearest city hub", "Hospital desk or app"]
    ]
  };
}

function getFallbackNearbyDoctors() {
  return [
    {
      name: "Nearby Primary Care Clinic",
      address: "Local Medical Center, Main St",
      phone: "555-0123",
      rating: 4.5,
      url: "https://www.google.com/maps/search/doctors+near+me"
    },
    {
      name: "City General Hospital",
      address: "Health Plaza, Downtown",
      phone: "555-9876",
      rating: 4.2,
      url: "https://www.google.com/maps/search/hospitals+near+me"
    }
  ];
}

export async function generateAgenticAnalysis(
  prompt: string,
  location?: { lat: number, lng: number },
  fileData?: FileData
): Promise<any> {
  // 1. Symptom Analysis Agent
  const symptomSearch = await searchTavily(`medical symptoms analysis ${prompt}`);
  
  // 2. Medication Agent
  const medSearch = await searchTavily(`best medications and buying links for ${prompt} online pharmacy india amazon healthkart`);

  // 3. Diet & Lifestyle Advisor
  const dietSearch = await searchTavily(`diet nutrition lifestyle recommendations ${prompt} meal plan`);

  // 4. Doctor Recommendation Agent
  const docSearch = await searchTavily(`top 3 best doctors specialists near ${location ? `${location.lat}, ${location.lng}` : 'me'} for ${prompt} with profile links`);

  const orchestratorSystem = `You are the Agentic HealthBuddy Orchestrator. 
        Your task is to coordinate specialized medical sub-agents to provide a comprehensive health report.
        
        Format your response as a valid JSON object inside a code block starting with \`\`\`json.
        The JSON structure MUST be:
        {
          "symptomAnalysis": {
            "title": "Symptom Analysis",
            "headers": ["Condition", "Key Indicators", "Likelihood"],
            "rows": [ ["string", "string", "string"], ... ]
          },
          "medicationAdvice": {
            "title": "Medication Advice",
            "headers": ["Medication", "Consumption", "Dose", "Precautions", "Link"],
            "rows": [ ["string", "string", "string", "string", "string"], ... ]
          },
          "dietLifestyle": {
            "title": "Diet & Lifestyle",
            "headers": ["Meal/Activity", "Recommendation", "Benefit"],
            "rows": [ ["string", "string", "string"], ... ]
          },
          "doctorRecommendations": {
            "title": "Doctor Referral",
            "headers": ["Doctor Name", "Specialty", "Location", "Profile Link"],
            "rows": [ ["string", "string", "string", "string"], ... ]
          },
          "nearbyDoctors": [
            {
              "name": "string",
              "address": "string",
              "phone": "string",
              "rating": number,
              "url": "string"
            },
            ...
          ]
        }
        
        Always ensure the data is clinically accurate based on the provided search context.
        
        If the user's request is clearly NOT health-related (no symptoms, no medical context, no wellness question), do NOT produce the full JSON report. Instead output a single JSON object:
        {"offTopic": true, "message": "<2-5 sentence polite reply that you are Dr. HealthBuddy, a health-only AI, and ask for a health-related question>"}
        Use the same language as the user when possible for "message".`;

  const messages: any[] = [
    { role: "system", content: `${orchestratorSystem}\n\n${HEALTH_SCOPE_GUARD}` },
    { role: "user", content: `
      AGENTIC ANALYSIS REQUEST:
      USER SYMPTOMS: ${prompt}
      USER LOCATION: ${location ? `Lat: ${location.lat}, Lng: ${location.lng}` : 'Unknown'}
      
      [CONTEXT - SYMPTOMS]: ${symptomSearch}
      [CONTEXT - MEDICATION]: ${medSearch}
      [CONTEXT - DIET]: ${dietSearch}
      [CONTEXT - DOCTORS]: ${docSearch}
      
      Generate the full report as structured JSON for tables.
    ` }
  ];

  if (fileData?.mimeType?.startsWith("image/")) {
    const geminiContents = [
      {
        role: "user",
        parts: [
          {
            text:
              `AGENTIC ANALYSIS REQUEST:
USER SYMPTOMS: ${prompt}
USER LOCATION: ${location ? `Lat: ${location.lat}, Lng: ${location.lng}` : 'Unknown'}

[CONTEXT - SYMPTOMS]: ${symptomSearch}
[CONTEXT - MEDICATION]: ${medSearch}
[CONTEXT - DIET]: ${dietSearch}
[CONTEXT - DOCTORS]: ${docSearch}

Uploaded medical image attached. Analyze it as part of this report (prescription/report photo/X-ray/ECG/MRI/clinical image). Generate the full report as structured JSON for tables.`
          },
          { inlineData: { mimeType: fileData.mimeType, data: fileData.data } }
        ]
      }
    ];

    try {
      const geminiResult = await callGemini(
        geminiContents,
        `${MEDICAL_VISION_SYSTEM}\n\n${orchestratorSystem}\n\n${HEALTH_SCOPE_GUARD}`,
        { temperature: 0.5, top_p: 0.9 }
      );
      const text = extractGeminiText(geminiResult);
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/{[\s\S]*}/);
      let analysisResult: Record<string, unknown> = {};
      try {
        const raw = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : "";
        if (raw) analysisResult = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        analysisResult = {};
      }

      if (analysisResult.offTopic === true && typeof analysisResult.message === "string") {
        return { offTopic: true as const, message: analysisResult.message };
      }
      if (!analysisResult.symptomAnalysis) analysisResult.symptomAnalysis = getFallbackSymptomAnalysis(prompt);
      if (!analysisResult.medicationAdvice) analysisResult.medicationAdvice = getFallbackMedicationAdvice(prompt);
      if (!analysisResult.dietLifestyle) analysisResult.dietLifestyle = getFallbackDietLifestyle(prompt);
      if (!analysisResult.doctorRecommendations) analysisResult.doctorRecommendations = getFallbackDoctorRecommendations(prompt);
      if (!analysisResult.nearbyDoctors) analysisResult.nearbyDoctors = getFallbackNearbyDoctors();
      return analysisResult;
    } catch (error) {
      console.error("Gemini Agentic Error (image fallback to text):", error);
    }
  } else if (fileData) {
    const geminiContents = [
      {
        role: "user",
        parts: [
          {
            text:
              `AGENTIC ANALYSIS REQUEST:
USER SYMPTOMS: ${prompt}
USER LOCATION: ${location ? `Lat: ${location.lat}, Lng: ${location.lng}` : 'Unknown'}

[CONTEXT - SYMPTOMS]: ${symptomSearch}
[CONTEXT - MEDICATION]: ${medSearch}
[CONTEXT - DIET]: ${dietSearch}
[CONTEXT - DOCTORS]: ${docSearch}

An uploaded medical file is attached (mime type: ${fileData.mimeType}). Analyze this file content and generate the full report as structured JSON for tables.`
          },
          { inlineData: { mimeType: fileData.mimeType, data: fileData.data } }
        ]
      }
    ];

    try {
      const geminiResult = await callGemini(
        geminiContents,
        `${MEDICAL_VISION_SYSTEM}\n\n${orchestratorSystem}\n\n${HEALTH_SCOPE_GUARD}`,
        { temperature: 0.5, top_p: 0.9 }
      );
      const text = extractGeminiText(geminiResult);
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/{[\s\S]*}/);
      let analysisResult: Record<string, unknown> = {};
      try {
        const raw = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : "";
        if (raw) analysisResult = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        analysisResult = {};
      }

      if (analysisResult.offTopic === true && typeof analysisResult.message === "string") {
        return { offTopic: true as const, message: analysisResult.message };
      }
      if (!analysisResult.symptomAnalysis) analysisResult.symptomAnalysis = getFallbackSymptomAnalysis(prompt);
      if (!analysisResult.medicationAdvice) analysisResult.medicationAdvice = getFallbackMedicationAdvice(prompt);
      if (!analysisResult.dietLifestyle) analysisResult.dietLifestyle = getFallbackDietLifestyle(prompt);
      if (!analysisResult.doctorRecommendations) analysisResult.doctorRecommendations = getFallbackDoctorRecommendations(prompt);
      if (!analysisResult.nearbyDoctors) analysisResult.nearbyDoctors = getFallbackNearbyDoctors();
      return analysisResult;
    } catch (error) {
      console.error("Gemini Agentic Error (file fallback to text):", error);
    }
  }

  try {
    // Lower temperature for valid JSON tables; main chat uses warmer sampling for natural prose.
    const preferredModels = TEXT_MODELS;
    const result = await callGroqWithModelFallback(messages, preferredModels, { temperature: 0.5, top_p: 0.9 });
    const text = result.choices[0].message.content || '';
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/{[\s\S]*}/);
    let analysisResult: Record<string, unknown> = {};
    try {
      const raw = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : "";
      if (raw) analysisResult = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      analysisResult = {};
    }

    if (analysisResult.offTopic === true && typeof analysisResult.message === "string") {
      return { offTopic: true as const, message: analysisResult.message };
    }

    // Fallback if any section is missing
    if (!analysisResult.symptomAnalysis) analysisResult.symptomAnalysis = getFallbackSymptomAnalysis(prompt);
    if (!analysisResult.medicationAdvice) analysisResult.medicationAdvice = getFallbackMedicationAdvice(prompt);
    if (!analysisResult.dietLifestyle) analysisResult.dietLifestyle = getFallbackDietLifestyle(prompt);
    if (!analysisResult.doctorRecommendations) analysisResult.doctorRecommendations = getFallbackDoctorRecommendations(prompt);
    if (!analysisResult.nearbyDoctors) analysisResult.nearbyDoctors = getFallbackNearbyDoctors();

    return analysisResult;
  } catch (error) {
    console.error("Agentic Analysis Error:", error);
    return {
      symptomAnalysis: getFallbackSymptomAnalysis(prompt),
      medicationAdvice: getFallbackMedicationAdvice(prompt),
      dietLifestyle: getFallbackDietLifestyle(prompt),
      doctorRecommendations: getFallbackDoctorRecommendations(prompt),
      nearbyDoctors: getFallbackNearbyDoctors()
    };
  }
}
