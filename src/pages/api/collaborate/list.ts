import type { APIRoute } from "astro";
import { currentStudy } from "../../../lib/auth";
import { toPeerRow } from "../../../lib/peers";
import { heartbeat, listPeerSessions } from "../../../lib/store";

export const GET: APIRoute = async ({ request }) => {
  const study = await currentStudy(request);
  if (study?.sessionId) {
    await heartbeat(study.sessionId, "participant");
  }
  const rows = (await listPeerSessions(study?.id)).map(toPeerRow);
  return new Response(JSON.stringify({ rows }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
};
