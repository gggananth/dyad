import type { PartnerType, StimulusMode, Task } from "./types";
import { TASKS } from "./tasks";

function pick<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

export function randomStimulusMode(): StimulusMode {
  return Math.random() < 0.5 ? "text" : "image";
}

export function randomPartnerType(): PartnerType {
  return Math.random() < 0.5 ? "human" : "ai";
}

export function pickOfferedTask(declinedTaskIds: string[]): Task | null {
  const remaining = TASKS.filter((task) => !declinedTaskIds.includes(task.id));
  if (remaining.length === 0) return null;
  return pick(remaining);
}
