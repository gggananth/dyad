import type { APIRoute } from "astro";
import { authorizeSession } from "../../../../lib/auth";
import { proposeSuggestion } from "../../../../lib/runtime";

export const POST: APIRoute = async ({ params, request }) => {
  const id = params.id;
  if (!id) return new Response("Missing session", { status: 400 });
  const { session, role } = await authorizeSession(request, id);
  if (!session || role !== "partner") {
    return new Response("Unauthorized", { status: 401 });
  }
  if (session.phase !== "connected") {
    return new Response(JSON.stringify({ error: "Not connected" }), { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const text = String((body as { text?: string }).text ?? "");
  await proposeSuggestion(id, text);
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
};
