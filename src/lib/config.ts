function stringEnv(value: string | undefined, fallback = "") {
  if (!value) return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function numberEnv(name: string, fallback: number) {
  const raw = process.env[name] ?? (import.meta.env as Record<string, string | undefined>)[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export const config = {
  geminiApiKey: stringEnv(process.env.GEMINI_API_KEY ?? import.meta.env.GEMINI_API_KEY),
  geminiModel: stringEnv(
    process.env.GEMINI_MODEL ?? import.meta.env.GEMINI_MODEL,
    "gemini-3.8-flash",
  ),
  wordLimit: numberEnv("WORD_LIMIT", 75),
  pairingMinMs: numberEnv("PAIRING_MIN_MS", 4000),
  pairingMaxMs: numberEnv("PAIRING_MAX_MS", 12000),
  liveWithinMs: numberEnv("LIVE_WITHIN_MS", 150000),
  noticeEveryMs: numberEnv("NOTICE_EVERY_MS", 60000),
  labAdminPassword: stringEnv(
    process.env.LAB_ADMIN_PASSWORD ?? import.meta.env.LAB_ADMIN_PASSWORD,
  ),
};

export const COOKIE_STUDY = "dyad_study";
export const COOKIE_PARTNER = "dyad_partner";
export const COOKIE_LAB_ADMIN = "dyad_lab_admin";

export const IMAGE_INSTRUCTION =
  "Look at the image. Express in words what it evokes — the scene, a feeling, or a brief story. Your written text must reflect your creative expression to the fullest. Max word count: 75.";
