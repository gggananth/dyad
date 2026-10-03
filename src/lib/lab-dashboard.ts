import { isPresent } from "./presence";
import { getTask, wordCount } from "./tasks";
import type { Session, SessionPhase, StimulusMode, PartnerType } from "./types";

export const LAB_PAGE_SIZE = 10;

const RELATIVE: Record<number, string> = {
  [-3]: "x---",
  [-2]: "x--",
  [-1]: "x-",
  0: "x",
  1: "x+",
  2: "x++",
  3: "x+++",
};

export function relativeLabel(value: number | null) {
  if (value == null) return "—";
  return RELATIVE[value] ?? String(value);
}

export function scoreLabel(value: number | null) {
  return value == null ? "—" : String(value);
}

function mean(values: Array<number | null>) {
  const xs = values.filter((value): value is number => value != null);
  if (xs.length === 0) return null;
  return Math.round((xs.reduce((sum, value) => sum + value, 0) / xs.length) * 100) / 100;
}

export function usageStats(sessions: Session[], studyCount: number) {
  const withDraft = sessions.filter((session) => Boolean(session.lockedSolo.trim()));
  const completed = sessions.filter((session) => session.phase === "ended");
  const inProgress = sessions.filter(
    (session) => session.phase !== "ended" && session.phase !== "offer",
  );
  const waiting = sessions.filter(
    (session) =>
      session.partnerType === "human" &&
      session.phase === "pairing" &&
      !session.lastHeartbeat.partner,
  );
  const live = sessions.filter((session) => isPresent(session.lastHeartbeat.participant));
  const connected = sessions.filter((session) => Boolean(session.connectedAt));
  const applied = sessions.reduce(
    (sum, session) =>
      sum + session.drafts.filter((draft) => draft.source === "suggestion-applied").length,
    0,
  );
  const epiphanyYes = sessions.filter((session) => session.epiphany === true).length;
  const epiphanyNo = sessions.filter((session) => session.epiphany === false).length;

  return {
    studies: studyCount,
    sessions: sessions.length,
    withDraft: withDraft.length,
    completed: completed.length,
    inProgress: inProgress.length,
    waiting: waiting.length,
    live: live.length,
    connected: connected.length,
    text: sessions.filter((session) => session.stimulusMode === "text").length,
    image: sessions.filter((session) => session.stimulusMode === "image").length,
    human: sessions.filter((session) => session.partnerType === "human").length,
    ai: sessions.filter((session) => session.partnerType === "ai").length,
    epiphanyYes,
    epiphanyNo,
    applied,
    meanX: mean(sessions.map((session) => session.soloQuality)),
    meanXp: mean(sessions.map((session) => session.soloExperience)),
    meanY: mean(sessions.map((session) => session.relativeQuality)),
    meanZ: mean(sessions.map((session) => session.relativeExperience)),
    cells: {
      "text × human": sessions.filter((s) => s.stimulusMode === "text" && s.partnerType === "human")
        .length,
      "text × ai": sessions.filter((s) => s.stimulusMode === "text" && s.partnerType === "ai")
        .length,
      "image × human": sessions.filter(
        (s) => s.stimulusMode === "image" && s.partnerType === "human",
      ).length,
      "image × ai": sessions.filter((s) => s.stimulusMode === "image" && s.partnerType === "ai")
        .length,
    },
  };
}

export interface LabQuery {
  q: string;
  phase: string;
  stimulus: string;
  collaborator: string;
  epiphany: string;
  page: number;
  pageSize: number;
}

export function parseLabQuery(url: URL): LabQuery {
  const page = Number(url.searchParams.get("page") ?? "1");
  return {
    q: (url.searchParams.get("q") ?? "").trim(),
    phase: url.searchParams.get("phase") ?? "all",
    stimulus: url.searchParams.get("stimulus") ?? "all",
    collaborator: url.searchParams.get("collaborator") ?? "all",
    epiphany: url.searchParams.get("epiphany") ?? "all",
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: LAB_PAGE_SIZE,
  };
}

function matchesQuery(session: Session, query: LabQuery) {
  if (query.phase !== "all" && session.phase !== query.phase) return false;
  if (query.stimulus !== "all" && session.stimulusMode !== query.stimulus) return false;
  if (query.collaborator !== "all" && session.partnerType !== query.collaborator) return false;
  if (query.epiphany === "yes" && session.epiphany !== true) return false;
  if (query.epiphany === "no" && session.epiphany !== false) return false;
  if (query.epiphany === "pending" && session.epiphany != null) return false;
  if (!query.q) return true;

  const task = getTask(session.taskId);
  const haystack = [
    session.participantName,
    session.partnerName,
    session.joinCode,
    session.phase,
    session.stimulusMode,
    session.partnerType,
    session.taskId,
    task?.title ?? "",
    session.lockedSolo,
    session.document,
    session.soloOriginal,
    ...session.messages.map((message) => message.text),
  ]
    .join("\n")
    .toLowerCase();
  return haystack.includes(query.q.toLowerCase());
}

export function paginateSubmissions(sessions: Session[], query: LabQuery) {
  const matched = sessions.filter((session) => matchesQuery(session, query));
  const pages = Math.max(1, Math.ceil(matched.length / query.pageSize));
  const page = Math.min(query.page, pages);
  const start = (page - 1) * query.pageSize;
  return {
    rows: matched.slice(start, start + query.pageSize).map(toSubmissionRow),
    total: matched.length,
    page,
    pages,
    pageSize: query.pageSize,
  };
}

export function toSubmissionRow(session: Session) {
  const task = getTask(session.taskId);
  const applied = session.drafts.filter((draft) => draft.source === "suggestion-applied").length;
  const partnerMessages = session.messages.filter((message) => message.sender === "partner").length;
  return {
    id: session.id,
    participant: session.participantName,
    partner: session.partnerType === "ai" || session.connectedAt ? session.partnerName : "—",
    task: task?.title ?? session.taskId,
    stimulus: session.stimulusMode,
    collaborator: session.partnerType,
    phase: session.phase,
    x: session.soloQuality,
    xp: session.soloExperience,
    y: session.relativeQuality,
    z: session.relativeExperience,
    yLabel: relativeLabel(session.relativeQuality),
    zLabel: relativeLabel(session.relativeExperience),
    epiphany:
      session.epiphany == null ? "—" : session.epiphany ? "Yes" : "No",
    drafts: session.drafts.length,
    applied,
    messages: session.messages.length,
    partnerMessages,
    words: wordCount(session.document || session.lockedSolo),
    code: session.joinCode,
    createdAt: session.createdAt,
  };
}

export function queryHref(query: LabQuery, page: number) {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.phase !== "all") params.set("phase", query.phase);
  if (query.stimulus !== "all") params.set("stimulus", query.stimulus);
  if (query.collaborator !== "all") params.set("collaborator", query.collaborator);
  if (query.epiphany !== "all") params.set("epiphany", query.epiphany);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/labs?${qs}` : "/labs";
}

export const PHASES: SessionPhase[] = [
  "offer",
  "write",
  "grammar",
  "solo_rate",
  "invite",
  "pairing",
  "connected",
  "compare",
  "ended",
];

export const STIMULI: StimulusMode[] = ["text", "image"];
export const COLLABORATORS: PartnerType[] = ["human", "ai"];
