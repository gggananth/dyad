import type { APIRoute } from "astro";
import { authorizeSession } from "../../../../lib/auth";
import { heartbeat } from "../../../../lib/store";

export const POST: APIRoute = async ({ params, request }) => {
  const id = params.id;
  if (!id) return new Response("Missing session", { status: 400 });
  const { session, role } = await authorizeSession(request, id);
  if (!session || !role) return new Response("Unauthorized", { status: 401 });
  await heartbeat(id, role);
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
};
