export type StimulusMode = "text" | "image";
export type PartnerType = "human" | "ai";
export type Role = "participant" | "partner";
export type SessionPhase =
  | "offer"
  | "write"
  | "grammar"
  | "solo_rate"
  | "invite"
  | "pairing"
  | "connected"
  | "compare"
  | "ended";

export type DraftSource =
  | "solo"
  | "grammar"
  | "participant"
  | "suggestion-applied";

export interface Task {
  id: string;
  number: number;
  title: string;
  prompt: string;
  image: string;
}

export interface ChatMessage {
  id: string;
  sender: Role | "system";
  text: string;
  at: number;
}

export interface DraftSnapshot {
  id: string;
  text: string;
  at: number;
  source: DraftSource;
}

export interface Session {
  id: string;
  studyId: string;
  taskId: string;
  stimulusMode: StimulusMode;
  partnerType: PartnerType;
  joinCode: string;
  phase: SessionPhase;
  partnerName: string;
  participantName: string;
  soloOriginal: string;
  grammarDraft: string;
  lockedSolo: string;
  document: string;
  pendingSuggestion: string | null;
  drafts: DraftSnapshot[];
  messages: ChatMessage[];
  soloQuality: number | null;
  soloExperience: number | null;
  relativeQuality: number | null;
  relativeExperience: number | null;
  epiphany: boolean | null;
  epiphanyTrace: number[] | null;
  createdAt: number;
  connectedAt: number | null;
  lastHeartbeat: {
    participant: number | null;
    partner: number | null;
  };
}

export interface Study {
  id: string;
  displayName: string;
  createdAt: number;
  declinedTaskIds: string[];
  sessionId: string | null;
}

export interface StoreData {
  studies: Record<string, Study>;
  sessions: Record<string, Session>;
}
