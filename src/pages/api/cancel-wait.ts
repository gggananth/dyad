import type { APIRoute } from "astro";
import { currentStudy } from "../../lib/auth";
import { getSession } from "../../lib/store";
import { cancelWait } from "../../lib/runtime";

export const POST: APIRoute = async ({ request }) => {
  const study = await currentStudy(request);
  if (!study?.sessionId) {
    return new Response(null, { status: 303, headers: { Location: "/" } });
  }

  const session = await getSession(study.sessionId);
  if (!session || session.phase !== "pairing") {
    return new Response(null, {
      status: 303,
      headers: { Location: `/study/session/${study.sessionId}` },
    });
  }

  await cancelWait(session.id);
  return new Response(null, {
    status: 303,
    headers: { Location: `/study/session/${session.id}` },
  });
};
