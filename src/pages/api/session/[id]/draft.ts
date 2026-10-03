import type { APIRoute } from "astro";
import { authorizeSession } from "../../../../lib/auth";
import { saveParticipantDraft } from "../../../../lib/runtime";

export const POST: APIRoute = async ({ params, request }) => {
  const id = params.id;
  if (!id) return new Response("Missing session", { status: 400 });
  const { session, role } = await authorizeSession(request, id);
  if (!session || role !== "participant") {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const text = String((body as { text?: string }).text ?? "");
  await saveParticipantDraft(id, text);
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
};
