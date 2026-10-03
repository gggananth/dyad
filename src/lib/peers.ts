import { IMAGE_INSTRUCTION } from "./config";
import { isPresent } from "./presence";
import { getTask } from "./tasks";
import type { Session } from "./types";

export function hasOpenSeat(session: Session) {
  return (
    session.partnerType === "human" &&
    session.phase === "pairing" &&
    Boolean(session.lockedSolo.trim()) &&
    !isPresent(session.lastHeartbeat.partner)
  );
}

export function isOnPeerBoard(session: Session) {
  return (
    session.partnerType === "human" &&
    Boolean(session.lockedSolo.trim()) &&
    (session.phase === "pairing" || session.phase === "connected")
  );
}

export function peerTitle(session: Session) {
  if (session.stimulusMode === "image") return "Image prompt";
  return getTask(session.taskId)?.title ?? "Text prompt";
}

export function peerPrompt(session: Session) {
  if (session.stimulusMode === "image") return IMAGE_INSTRUCTION;
  return getTask(session.taskId)?.prompt ?? "";
}

export function peerImage(session: Session) {
  if (session.stimulusMode !== "image") return "";
  return getTask(session.taskId)?.image ?? "";
}

export function excerpt(text: string, limit = 160) {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, limit).trim()}…`;
}

export function toPeerRow(session: Session) {
  const live = isPresent(session.lastHeartbeat.participant);
  const open = hasOpenSeat(session);
  return {
    id: session.id,
    title: peerTitle(session),
    stimulusMode: session.stimulusMode,
    excerpt: excerpt(session.lockedSolo),
    live,
    open,
    status: live ? "Live" : "Away",
    seat: open ? "Open" : "In session",
  };
}
