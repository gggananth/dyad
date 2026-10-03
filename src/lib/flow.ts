import { getSession, getStudy, offerSession } from "./store";
import type { Study } from "./types";

export async function nextStudyPath(study: Study) {
  if (!study.sessionId) return "/study/offer";
  const session = await getSession(study.sessionId);
  if (!session) return "/study/offer";

  switch (session.phase) {
    case "offer":
      return "/study/offer";
    case "write":
      return "/study/write";
    case "grammar":
      return "/study/lock";
    case "solo_rate":
      return "/study/solo-rate";
    case "invite":
    case "pairing":
    case "connected":
      return `/study/session/${session.id}`;
    case "compare":
      return "/study/compare";
    case "ended":
      return "/study/done";
    default:
      return "/study/offer";
  }
}

export async function pathForStudy(studyId: string) {
  const study = await getStudy(studyId);
  if (!study) return "/";
  return nextStudyPath(study);
}

export async function ensureOffer(studyId: string) {
  const study = await getStudy(studyId);
  if (!study) return null;
  if (study.sessionId) {
    const existing = await getSession(study.sessionId);
    if (existing) return existing;
  }
  return offerSession(studyId);
}
