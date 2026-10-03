import type { APIRoute } from "astro";
import { authorizeSession } from "../../../../lib/auth";
import { finishSession } from "../../../../lib/runtime";

export const POST: APIRoute = async ({ params, request }) => {
  const id = params.id;
  if (!id) return new Response("Missing session", { status: 400 });
  const { session, role } = await authorizeSession(request, id);
  if (!session || role !== "participant") {
    return new Response("Unauthorized", { status: 401 });
  }
  await finishSession(id);
  return new Response(null, {
    status: 303,
    headers: { Location: "/study/compare" },
  });
};
