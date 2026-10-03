import { COOKIE_PARTNER, COOKIE_STUDY } from "./config";
import { getSession, getStudy } from "./store";
import type { Role, Session, Study } from "./types";

export function parseCookies(header: string | null) {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join("=") ?? "");
  }
  return out;
}

export function cookieHeader(name: string, value: string, maxAge = 60 * 60 * 24 * 7) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

export function expireCookie(name: string) {
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function studyIdFrom(request: Request) {
  return parseCookies(request.headers.get("cookie"))[COOKIE_STUDY] ?? null;
}

export function partnerSessionIdFrom(request: Request) {
  return parseCookies(request.headers.get("cookie"))[COOKIE_PARTNER] ?? null;
}

export async function currentStudy(request: Request) {
  const id = studyIdFrom(request);
  if (!id) return null;
  return getStudy(id);
}

export async function authorizeSession(request: Request, sessionId: string) {
  const session = await getSession(sessionId);
  if (!session) return { session: null, role: null as Role | null, study: null as Study | null };

  const studyCookie = studyIdFrom(request);
  if (studyCookie && studyCookie === session.studyId) {
    const study = await getStudy(session.studyId);
    return { session, role: "participant" as const, study };
  }

  const partnerCookie = partnerSessionIdFrom(request);
  if (partnerCookie === session.id) {
    return { session, role: "partner" as const, study: await getStudy(session.studyId) };
  }

  return { session: null, role: null, study: null };
}

export function requireJsonSession(session: Session | null) {
  if (session) return null;
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
