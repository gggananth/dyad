import type { APIRoute } from "astro";
import { authorizeSession } from "../../../../lib/auth";
import { publicSession } from "../../../../lib/events";

export const GET: APIRoute = async ({ params, request }) => {
  const id = params.id;
  if (!id) return new Response("Missing session", { status: 400 });
  const { session, role } = await authorizeSession(request, id);
  if (!session || !role) return new Response("Unauthorized", { status: 401 });
  return new Response(JSON.stringify(publicSession(session)), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
};
