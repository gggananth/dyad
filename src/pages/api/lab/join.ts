import type { APIRoute } from "astro";
import { COOKIE_PARTNER } from "../../../lib/config";
import { cookieHeader } from "../../../lib/auth";
import { requireLabAdmin } from "../../../lib/lab-auth";
import { getSessionByCode } from "../../../lib/store";
import { joinHumanSession } from "../../../lib/runtime";

export const POST: APIRoute = async ({ request }) => {
  const denied = requireLabAdmin(request);
  if (denied) return denied;
  const form = await request.formData();
  const code = String(form.get("code") ?? "").trim();
  const name = String(form.get("name") ?? "").trim();
  if (!code || !name) {
    return new Response("Name and code are required.", { status: 400 });
  }

  const session = await getSessionByCode(code);
  if (!session) return new Response("No session uses that code.", { status: 404 });

  const result = await joinHumanSession(session.id, name, { allowInvite: true });
  if (!result.ok) {
    return new Response(result.error, { status: result.status });
  }

  return new Response(null, {
    status: 303,
    headers: {
      Location: `/study/session/${session.id}`,
      "Set-Cookie": cookieHeader(COOKIE_PARTNER, session.id),
    },
  });
};
