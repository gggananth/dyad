import type { Session } from "./types";

type Handler = (event: string, data: unknown) => void;

const listeners = new Map<string, Set<Handler>>();

export function subscribe(sessionId: string, handler: Handler) {
  let set = listeners.get(sessionId);
  if (!set) {
    set = new Set();
    listeners.set(sessionId, set);
  }
  set.add(handler);
  return () => {
    set?.delete(handler);
    if (set && set.size === 0) listeners.delete(sessionId);
  };
}

export function emit(sessionId: string, event: string, data: unknown) {
  const set = listeners.get(sessionId);
  if (!set) return;
  for (const handler of set) {
    try {
      handler(event, data);
    } catch (error) {
      console.error("[sse]", error);
    }
  }
}

export function emitSession(session: Session) {
  emit(session.id, "session", publicSession(session));
}

export function publicSession(session: Session) {
  return {
    id: session.id,
    studyId: session.studyId,
    taskId: session.taskId,
    stimulusMode: session.stimulusMode,
    phase: session.phase,
    partnerName: session.partnerName,
    participantName: session.participantName,
    document: session.document,
    pendingSuggestion: session.pendingSuggestion,
    messages: session.messages,
    lockedSolo: session.lockedSolo,
    createdAt: session.createdAt,
    connectedAt: session.connectedAt,
  };
}
