import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { COOKIE_LAB_ADMIN, config } from "./config";
import { cookieHeader, expireCookie, parseCookies } from "./auth";

function digestPassword(value: string) {
  return createHash("sha256").update(value).digest();
}

export function labPasswordConfigured() {
  return Boolean(config.labAdminPassword);
}

export function labPasswordsMatch(input: string) {
  if (!config.labAdminPassword) return false;
  return timingSafeEqual(digestPassword(input), digestPassword(config.labAdminPassword));
}

export function labAdminToken() {
  return createHmac("sha256", config.labAdminPassword).update("dyad-lab-admin").digest("hex");
}

export function isLabAdmin(request: Request) {
  if (!config.labAdminPassword) return false;
  const token = parseCookies(request.headers.get("cookie"))[COOKIE_LAB_ADMIN];
  if (!token) return false;
  const expected = labAdminToken();
  const left = Buffer.from(token);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function labLoginCookie() {
  return cookieHeader(COOKIE_LAB_ADMIN, labAdminToken());
}

export function labLogoutCookie() {
  return expireCookie(COOKIE_LAB_ADMIN);
}

export function requireLabAdmin(request: Request) {
  if (isLabAdmin(request)) return null;
  return new Response(null, {
    status: 303,
    headers: { Location: "/labs" },
  });
}
