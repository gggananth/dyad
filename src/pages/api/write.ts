import type { APIRoute } from "astro";
import { config } from "../../lib/config";
import { currentStudy } from "../../lib/auth";
import { grammarEdit } from "../../lib/gemini";
import { clipToWordLimit, wordCount } from "../../lib/tasks";
import { getSession, pushDraft, updateSession } from "../../lib/store";

export const POST: APIRoute = async ({ request }) => {
  const study = await currentStudy(request);
  if (!study?.sessionId) {
    return new Response(null, { status: 303, headers: { Location: "/" } });
  }

  const session = await getSession(study.sessionId);
  if (!session || session.phase !== "write") {
    return new Response(null, { status: 303, headers: { Location: "/study/write" } });
  }

  const form = await request.formData();
  const raw = String(form.get("draft") ?? "");
  const draft = clipToWordLimit(raw, config.wordLimit);
  if (wordCount(draft) === 0) {
    return new Response("Please write something first.", { status: 400 });
  }

  const grammar = clipToWordLimit(await grammarEdit(draft), config.wordLimit);
  await updateSession(session.id, (current) => {
    current.soloOriginal = draft;
    current.grammarDraft = grammar;
    current.phase = "grammar";
    pushDraft(current, draft, "solo");
    if (grammar !== draft) pushDraft(current, grammar, "grammar");
  });

  return new Response(null, {
    status: 303,
    headers: { Location: "/study/lock" },
  });
};
