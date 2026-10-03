import type { APIRoute } from "astro";
import { currentStudy } from "../../lib/auth";
import { getSession, updateSession } from "../../lib/store";

export const POST: APIRoute = async ({ request }) => {
  const study = await currentStudy(request);
  if (!study?.sessionId) {
    return new Response(null, { status: 303, headers: { Location: "/" } });
  }

  const session = await getSession(study.sessionId);
  if (!session || session.phase !== "grammar") {
    return new Response(null, { status: 303, headers: { Location: "/study/lock" } });
  }

  const form = await request.formData();
  if (String(form.get("action") ?? "") === "edit") {
    await updateSession(session.id, { phase: "write" });
    return new Response(null, {
      status: 303,
      headers: { Location: "/study/write" },
    });
  }

  const choice = String(form.get("choice") ?? "grammar");
  const locked = choice === "original" ? session.soloOriginal : session.grammarDraft;

  await updateSession(session.id, {
    lockedSolo: locked,
    document: locked,
    phase: "solo_rate",
  });

  return new Response(null, {
    status: 303,
    headers: { Location: "/study/solo-rate" },
  });
};
