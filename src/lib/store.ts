import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { emitSession } from "./events";
import { joinCode, uid } from "./ids";
import { pickPartnerName } from "./names";
import { pickOfferedTask, randomPartnerType, randomStimulusMode } from "./selection";
import { detectEpiphany } from "./lsa";
import type {
  DraftSource,
  PartnerType,
  Role,
  Session,
  StimulusMode,
  StoreData,
  Study,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "dyad.json");

let memory: StoreData = { studies: {}, sessions: {} };
let loaded = false;
let writing: Promise<void> = Promise.resolve();

async function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    memory = JSON.parse(raw) as StoreData;
    memory.studies ??= {};
    memory.sessions ??= {};
  } catch {
    memory = { studies: {}, sessions: {} };
  }
}

function persist() {
  writing = writing.then(async () => {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(DATA_FILE, JSON.stringify(memory, null, 2), "utf8");
  });
  return writing;
}

export async function createStudy(displayName: string) {
  await load();
  const study: Study = {
    id: uid(),
    displayName: displayName.trim() || "Participant",
    createdAt: Date.now(),
    declinedTaskIds: [],
    sessionId: null,
  };
  memory.studies[study.id] = study;
  await persist();
  return study;
}

export async function getStudy(id: string) {
  await load();
  return memory.studies[id] ?? null;
}

export async function getSession(id: string) {
  await load();
  return memory.sessions[id] ?? null;
}

export async function getSessionByCode(code: string) {
  await load();
  const needle = code.trim().toUpperCase();
  return (
    Object.values(memory.sessions).find((session) => session.joinCode === needle) ??
    null
  );
}

export async function listHumanWaiting() {
  await load();
  return Object.values(memory.sessions).filter(
    (session) =>
      session.partnerType === "human" &&
      session.phase === "pairing" &&
      !session.lastHeartbeat.partner,
  );
}

export async function listPeerSessions(excludeStudyId?: string | null) {
  await load();
  return Object.values(memory.sessions)
    .filter(
      (session) =>
        session.partnerType === "human" &&
        Boolean(session.lockedSolo.trim()) &&
        (session.phase === "pairing" || session.phase === "connected") &&
        session.studyId !== excludeStudyId,
    )
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function listStudies() {
  await load();
  return Object.values(memory.studies).sort((a, b) => b.createdAt - a.createdAt);
}

export async function listSessions() {
  await load();
  return Object.values(memory.sessions).sort((a, b) => b.createdAt - a.createdAt);
}

export async function updateSession(
  id: string,
  patch: Partial<Session> | ((session: Session) => void),
  options: { silent?: boolean } = {},
) {
  await load();
  const session = memory.sessions[id];
  if (!session) return null;
  if (typeof patch === "function") patch(session);
  else Object.assign(session, patch);
  await persist();
  if (!options.silent) emitSession(session);
  return session;
}

export async function updateStudy(id: string, patch: Partial<Study>) {
  await load();
  const study = memory.studies[id];
  if (!study) return null;
  Object.assign(study, patch);
  await persist();
  return study;
}

export function pushDraft(session: Session, text: string, source: DraftSource) {
  const trimmed = text.trim();
  const last = session.drafts.at(-1);
  if (last && last.text === trimmed) return;
  session.drafts.push({
    id: uid(),
    text: trimmed,
    at: Date.now(),
    source,
  });
}

export async function offerSession(studyId: string) {
  await load();
  const study = memory.studies[studyId];
  if (!study) return null;
  if (study.sessionId) {
    const existing = memory.sessions[study.sessionId];
    if (existing) return existing;
  }

  const task = pickOfferedTask(study.declinedTaskIds);
  if (!task) return null;

  const partnerType: PartnerType = randomPartnerType();
  const stimulusMode: StimulusMode = randomStimulusMode();
  const session: Session = {
    id: uid(),
    studyId: study.id,
    taskId: task.id,
    stimulusMode,
    partnerType,
    joinCode: joinCode(),
    phase: "offer",
    partnerName: partnerType === "ai" ? pickPartnerName() : "Your partner",
    participantName: study.displayName,
    soloOriginal: "",
    grammarDraft: "",
    lockedSolo: "",
    document: "",
    pendingSuggestion: null,
    drafts: [],
    messages: [],
    soloQuality: null,
    soloExperience: null,
    relativeQuality: null,
    relativeExperience: null,
    epiphany: null,
    epiphanyTrace: null,
    createdAt: Date.now(),
    connectedAt: null,
    lastHeartbeat: { participant: Date.now(), partner: null },
  };
  memory.sessions[session.id] = session;
  study.sessionId = session.id;
  await persist();
  return session;
}

export async function acceptOffer(studyId: string) {
  await load();
  const study = memory.studies[studyId];
  if (!study?.sessionId) return null;
  const session = memory.sessions[study.sessionId];
  if (!session || session.phase !== "offer") return session;
  session.phase = "write";
  await persist();
  return session;
}

export async function declineOffer(studyId: string) {
  await load();
  const study = memory.studies[studyId];
  if (!study?.sessionId) return null;
  const session = memory.sessions[study.sessionId];
  if (!session || session.phase !== "offer") return session;
  study.declinedTaskIds.push(session.taskId);
  delete memory.sessions[session.id];
  study.sessionId = null;
  await persist();
  return offerSession(studyId);
}

export async function addMessage(id: string, sender: Role | "system", text: string) {
  const trimmed = text.trim();
  if (!trimmed) return getSession(id);
  return updateSession(id, (session) => {
    session.messages.push({
      id: uid(),
      sender,
      text: trimmed,
      at: Date.now(),
    });
  });
}

export async function heartbeat(id: string, role: Role) {
  await load();
  const session = memory.sessions[id];
  if (!session) return null;
  session.lastHeartbeat[role] = Date.now();
  return session;
}

function consecutiveUnique(texts: string[]) {
  const out: string[] = [];
  for (const text of texts) {
    const trimmed = text.trim();
    if (!trimmed) continue;
    if (out.at(-1) === trimmed) continue;
    out.push(trimmed);
  }
  return out;
}

export function finalizeEpiphany(session: Session) {
  const later = session.drafts
    .filter((draft) => draft.source === "participant" || draft.source === "suggestion-applied")
    .map((draft) => draft.text);
  const texts = consecutiveUnique([session.lockedSolo, ...later]);
  const result = detectEpiphany(texts);
  session.epiphany = result.epiphany;
  session.epiphanyTrace = result.distances;
}

export async function exportPayload() {
  await load();
  return memory;
}
