import type { Session } from "./types";
import { getTask, wordCount } from "./tasks";

export function anovaRow(session: Session) {
  const task = getTask(session.taskId);
  return {
    session_id: session.id,
    study_id: session.studyId,
    participant: session.participantName,
    task_id: session.taskId,
    task_title: task?.title ?? "",
    stimulus: session.stimulusMode,
    collaborator: session.partnerType,
    epiphany: session.epiphany ? 1 : 0,
    x_quality: session.soloQuality,
    x_prime_experience: session.soloExperience,
    y_relative_quality: session.relativeQuality,
    z_relative_experience: session.relativeExperience,
    drafts: session.drafts.length,
    solo_words: wordCount(session.lockedSolo),
    final_words: wordCount(session.document),
    cell: `${session.stimulusMode}×${session.partnerType}×${session.epiphany ? "epiphany" : "none"}`,
  };
}

export function toCsv(rows: ReturnType<typeof anovaRow>[]) {
  if (rows.length === 0) {
    return "session_id,study_id,participant,task_id,task_title,stimulus,collaborator,epiphany,x_quality,x_prime_experience,y_relative_quality,z_relative_experience,drafts,solo_words,final_words,cell\n";
  }
  const keys = Object.keys(rows[0]) as (keyof (typeof rows)[0])[];
  const header = keys.join(",");
  const body = rows
    .map((row) =>
      keys
        .map((key) => {
          const value = row[key];
          const text = value == null ? "" : String(value);
          return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
        })
        .join(","),
    )
    .join("\n");
  return `${header}\n${body}\n`;
}
