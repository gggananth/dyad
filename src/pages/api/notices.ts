import type { APIRoute } from "astro";
import { currentStudy } from "../../lib/auth";
import { getSession, heartbeat } from "../../lib/store";

export const GET: APIRoute = async ({ request }) => {
  const study = await currentStudy(request);
  if (!study?.sessionId) {
    return new Response(JSON.stringify({ pendingSuggestion: false, sessionId: null }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  await heartbeat(study.sessionId, "participant");
  const session = await getSession(study.sessionId);
  return new Response(
    JSON.stringify({
      pendingSuggestion: Boolean(session?.pendingSuggestion),
      partnerJoined: session?.phase === "connected",
      sessionId: session?.id ?? null,
      phase: session?.phase ?? null,
    }),
    {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    },
  );
};
