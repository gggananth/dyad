import type { APIRoute } from "astro";
import { authorizeSession } from "../../../../lib/auth";
import { publicSession, subscribe } from "../../../../lib/events";

export const GET: APIRoute = async ({ params, request }) => {
  const sessionId = params.id;
  if (!sessionId) return new Response("Missing session", { status: 400 });

  const { session, role } = await authorizeSession(request, sessionId);
  if (!session || !role) return new Response("Unauthorized", { status: 401 });

  const encoder = new TextEncoder();
  let ping: ReturnType<typeof setInterval> | undefined;
  let unsubscribe = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          /* stream closed */
        }
      };
      send("session", publicSession(session));
      unsubscribe = subscribe(session.id, send);
      ping = setInterval(() => send("ping", { t: Date.now() }), 15000);
      request.signal.addEventListener("abort", () => {
        if (ping) clearInterval(ping);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      if (ping) clearInterval(ping);
      unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
};
