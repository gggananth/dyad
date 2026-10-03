import { config } from "./config";
import type { PartnerTurn } from "./prompts";

interface GeminiPart {
  text?: string;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
  }>;
  error?: { message?: string };
}

function extractText(payload: GeminiResponse) {
  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  return parts.map((part) => part.text ?? "").join("").trim();
}

function parseJsonObject(raw: string) {
  const stripped = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(stripped.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function generate(systemPrompt: string, userPrompt: string, json = false) {
  if (!config.geminiApiKey) return null;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "x-goog-api-key": config.geminiApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: json ? 1.05 : 0.2,
        ...(json ? { responseMimeType: "application/json" } : {}),
      },
    }),
  });
  const payload = (await response.json()) as GeminiResponse;
  if (!response.ok) {
    console.error("[gemini]", payload.error?.message ?? response.statusText);
    return null;
  }
  return extractText(payload);
}

export async function generatePartnerTurn(
  systemPrompt: string,
  userPrompt: string,
): Promise<PartnerTurn | null> {
  const raw = await generate(systemPrompt, userPrompt, true);
  if (!raw) return null;
  const parsed = parseJsonObject(raw);
  if (!parsed) return null;
  const follow = Number(parsed.follow_up_in_seconds);
  return {
    chat_message:
      typeof parsed.chat_message === "string" && parsed.chat_message.trim()
        ? parsed.chat_message.trim()
        : null,
    suggested_text:
      typeof parsed.suggested_text === "string" && parsed.suggested_text.trim()
        ? parsed.suggested_text.trim()
        : null,
    follow_up_in_seconds: Number.isFinite(follow)
      ? Math.min(30, Math.max(5, follow))
      : 12,
  };
}

export async function grammarEdit(text: string) {
  const raw = await generate(
    "You correct grammar, spelling, and punctuation only. Do not change meaning, imagery, metaphors, or the author's vocabulary except where a word is misspelled. Keep the same number of sentences if possible. Stay under 75 words. Return only the corrected text, with no preface.",
    text,
    false,
  );
  return raw?.trim() || text;
}
