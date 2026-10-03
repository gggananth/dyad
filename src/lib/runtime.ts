import { config } from "./config";
import { fallbackTurn, partnerSystemPrompt, partnerUserPayload } from "./prompts";
import { generatePartnerTurn } from "./gemini";
import { clipToWordLimit } from "./tasks";
import { isPresent } from "./presence";
import {
  addMessage,
  finalizeEpiphany,
  getSession,
  pushDraft,
  updateSession,
} from "./store";
import type { Role, Session } from "./types";

const phaseTimers = new Map<string, ReturnType<typeof setTimeout>>();
const aiTimers = new Map<string, ReturnType<typeof setTimeout>>();
const aiBusy = new Set<string>();

function clearTimer(map: Map<string, ReturnType<typeof setTimeout>>, id: string) {
  const timer = map.get(id);
  if (timer) clearTimeout(timer);
  map.delete(id);
}

function later(
  map: Map<string, ReturnType<typeof setTimeout>>,
  id: string,
  ms: number,
  fn: () => void,
) {
  clearTimer(map, id);
  map.set(id, setTimeout(fn, ms));
}

function clearSessionTimers(sessionId: string) {
  for (const key of [...phaseTimers.keys()]) {
    if (key === sessionId || key.startsWith(`${sessionId}-`)) {
      clearTimer(phaseTimers, key);
    }
  }
  clearTimer(aiTimers, sessionId);
}

export async function beginPairing(sessionId: string) {
  const session = await getSession(sessionId);
  if (!session) return session;
  if (session.phase !== "invite" && session.phase !== "pairing") return session;

  if (session.phase === "invite") {
    await updateSession(sessionId, { phase: "pairing" });
  }

  const current = await getSession(sessionId);
  if (!current || current.phase !== "pairing") return current;

  if (current.partnerType === "ai") {
    const span = Math.max(0, config.pairingMaxMs - config.pairingMinMs);
    const wait = config.pairingMinMs + Math.floor(Math.random() * (span + 1));
    later(phaseTimers, `${sessionId}-pair`, wait, () => {
      void connectSession(sessionId);
    });
  }
  return current;
}

export async function cancelWait(sessionId: string) {
  clearSessionTimers(sessionId);
  return updateSession(sessionId, (current) => {
    if (current.phase !== "pairing") return;
    current.phase = "invite";
    current.lastHeartbeat = { ...current.lastHeartbeat, partner: null };
  });
}

export async function joinHumanSession(
  sessionId: string,
  name: string,
  options: { allowInvite?: boolean } = {},
) {
  const session = await getSession(sessionId);
  if (!session) return { ok: false as const, status: 404, error: "No session uses that id." };
  if (session.partnerType !== "human") {
    return { ok: false as const, status: 409, error: "That piece is not open to a peer." };
  }
  if (session.phase === "ended" || session.phase === "compare") {
    return { ok: false as const, status: 409, error: "That session has already ended." };
  }

  const allowed =
    session.phase === "pairing" ||
    (Boolean(options.allowInvite) && session.phase === "invite");
  if (!allowed) {
    return {
      ok: false as const,
      status: 409,
      error: "That writer is not waiting for a collaborator.",
    };
  }
  if (isPresent(session.lastHeartbeat.partner)) {
    return { ok: false as const, status: 409, error: "Someone already joined this piece." };
  }

  await updateSession(sessionId, {
    partnerName: name,
    lastHeartbeat: { ...session.lastHeartbeat, partner: Date.now() },
  });
  const connected = await connectSession(sessionId);
  return { ok: true as const, session: connected };
}

export async function connectSession(sessionId: string) {
  const session = await getSession(sessionId);
  if (!session || session.phase === "connected" || session.phase === "compare" || session.phase === "ended") {
    return session;
  }

  const updated = await updateSession(sessionId, (current) => {
    current.phase = "connected";
    current.connectedAt = Date.now();
    if (!current.messages.some((message) => message.sender === "system")) {
      current.messages.push({
        id: crypto.randomUUID(),
        sender: "system",
        text: `${current.partnerName} joined. They can suggest wording and shape — you keep the draft, and the theme stays yours.`,
        at: Date.now(),
      });
    }
  });

  if (updated?.partnerType === "ai") {
    scheduleAiTurn(sessionId, "connect", 1600 + Math.random() * 1800);
  }
  return updated;
}

export async function finishSession(sessionId: string) {
  clearSessionTimers(sessionId);
  const session = await getSession(sessionId);
  if (!session || session.phase === "compare" || session.phase === "ended") return session;
  return updateSession(sessionId, (current) => {
    if (current.document.trim()) {
      pushDraft(current, current.document, "participant");
    }
    finalizeEpiphany(current);
    current.phase = "compare";
    current.pendingSuggestion = null;
    current.messages.push({
      id: crypto.randomUUID(),
      sender: "system",
      text: "Collaboration stopped. Compare this version with the one you locked earlier.",
      at: Date.now(),
    });
  });
}

export async function saveParticipantDraft(sessionId: string, text: string) {
  const clipped = clipToWordLimit(text, config.wordLimit);
  return updateSession(sessionId, (current) => {
    if (current.phase !== "connected") return;
    current.document = clipped;
    pushDraft(current, clipped, "participant");
  });
}

export async function proposeSuggestion(sessionId: string, text: string) {
  const clipped = clipToWordLimit(text, config.wordLimit);
  if (!clipped) return getSession(sessionId);
  return updateSession(sessionId, (current) => {
    if (current.phase !== "connected") return;
    current.pendingSuggestion = clipped;
  });
}

export async function applySuggestion(sessionId: string) {
  return updateSession(sessionId, (current) => {
    if (current.phase !== "connected" || !current.pendingSuggestion) return;
    current.document = current.pendingSuggestion;
    pushDraft(current, current.pendingSuggestion, "suggestion-applied");
    current.pendingSuggestion = null;
  });
}

export async function dismissSuggestion(sessionId: string) {
  return updateSession(sessionId, (current) => {
    if (current.phase !== "connected") return;
    current.pendingSuggestion = null;
  });
}

export function scheduleAiTurn(sessionId: string, trigger: string, delayMs = 2400) {
  later(aiTimers, sessionId, delayMs, () => {
    void runAiTurn(sessionId, trigger);
  });
}

async function runAiTurn(sessionId: string, trigger: string) {
  if (aiBusy.has(sessionId)) return;
  const session = await getSession(sessionId);
  if (!session || session.partnerType !== "ai" || session.phase !== "connected") {
    return;
  }

  aiBusy.add(sessionId);
  try {
    const turn =
      (await generatePartnerTurn(
        partnerSystemPrompt(session),
        partnerUserPayload(session, trigger),
      )) ?? fallbackTurn(session, trigger);

    if (turn.chat_message) {
      await addMessage(sessionId, "partner", turn.chat_message);
    }

    if (turn.suggested_text && !session.pendingSuggestion) {
      await proposeSuggestion(sessionId, turn.suggested_text);
    }

    scheduleAiTurn(sessionId, "idle", (turn.follow_up_in_seconds ?? 12) * 1000);
  } catch (error) {
    console.error("[ai-turn]", error);
    scheduleAiTurn(sessionId, "idle", 12000);
  } finally {
    aiBusy.delete(sessionId);
  }
}

export function clientConfig() {
  return {
    wordLimit: config.wordLimit,
    noticeEveryMs: config.noticeEveryMs,
  };
}

export function otherName(session: Session, role: Role) {
  return role === "participant" ? session.partnerName : session.participantName;
}
