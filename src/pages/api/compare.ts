import type { APIRoute } from "astro";
import { currentStudy } from "../../lib/auth";
import { getSession, updateSession } from "../../lib/store";

function relative(form: FormData, name: string) {
  const value = Number(form.get(name));
  return Number.isInteger(value) && value >= -3 && value <= 3 ? value : null;
}

export const POST: APIRoute = async ({ request }) => {
  const study = await currentStudy(request);
  if (!study?.sessionId) {
    return new Response(null, { status: 303, headers: { Location: "/" } });
  }

  const session = await getSession(study.sessionId);
  if (!session || session.phase !== "compare") {
    return new Response(null, { status: 303, headers: { Location: "/study/compare" } });
  }

  const form = await request.formData();
  const quality = relative(form, "quality");
  const experience = relative(form, "experience");
  if (quality == null || experience == null) {
    return new Response("Please rate both scales.", { status: 400 });
  }

  await updateSession(session.id, {
    relativeQuality: quality,
    relativeExperience: experience,
    phase: "ended",
  });

  return new Response(null, {
    status: 303,
    headers: { Location: "/study/done" },
  });
};
