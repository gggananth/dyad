import type { APIRoute } from "astro";
import { authorizeSession } from "../../../../lib/auth";
import { addMessage } from "../../../../lib/store";
import { scheduleAiTurn } from "../../../../lib/runtime";

export const POST: APIRoute = async ({ params, request }) => {
  const id = params.id;
  if (!id) return new Response("Missing session", { status: 400 });
  const { session, role } = await authorizeSession(request, id);
  if (!session || !role) return new Response("Unauthorized", { status: 401 });
  if (session.phase !== "connected") {
    return new Response(JSON.stringify({ error: "Not connected" }), { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const text = String((body as { text?: string }).text ?? "");
  await addMessage(id, role, text);
  if (session.partnerType === "ai" && role === "participant") {
    scheduleAiTurn(id, "user_message", 1600 + Math.random() * 2400);
  }
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
};
