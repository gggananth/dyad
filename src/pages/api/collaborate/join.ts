import type { APIRoute } from "astro";
import { COOKIE_PARTNER } from "../../../lib/config";
import { cookieHeader, currentStudy } from "../../../lib/auth";
import { getSession } from "../../../lib/store";
import { joinHumanSession } from "../../../lib/runtime";

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const sessionId = String(form.get("sessionId") ?? "").trim();
  const name = String(form.get("name") ?? "").trim();
  if (!sessionId || !name) {
    return new Response("A nickname is required.", { status: 400 });
  }

  const session = await getSession(sessionId);
  if (!session) return new Response("That draft is gone.", { status: 404 });

  const study = await currentStudy(request);
  if (study && study.id === session.studyId) {
    return new Response("You cannot join your own piece.", { status: 403 });
  }

  const result = await joinHumanSession(sessionId, name);
  if (!result.ok) {
    return new Response(result.error, { status: result.status });
  }

  return new Response(null, {
    status: 303,
    headers: {
      Location: `/study/session/${sessionId}`,
      "Set-Cookie": cookieHeader(COOKIE_PARTNER, sessionId),
    },
  });
};
