import type { APIRoute } from "astro";
import { currentStudy } from "../../lib/auth";
import { getSession, updateSession } from "../../lib/store";

function rating(form: FormData, name: string) {
  const value = Number(form.get(name));
  return Number.isInteger(value) && value >= 1 && value <= 5 ? value : null;
}

export const POST: APIRoute = async ({ request }) => {
  const study = await currentStudy(request);
  if (!study?.sessionId) {
    return new Response(null, { status: 303, headers: { Location: "/" } });
  }

  const session = await getSession(study.sessionId);
  if (!session || session.phase !== "solo_rate") {
    return new Response(null, { status: 303, headers: { Location: "/study/solo-rate" } });
  }

  const form = await request.formData();
  const quality = rating(form, "quality");
  const experience = rating(form, "experience");
  if (quality == null || experience == null) {
    return new Response("Please rate both scales.", { status: 400 });
  }

  await updateSession(session.id, {
    soloQuality: quality,
    soloExperience: experience,
    phase: "invite",
  });

  return new Response(null, {
    status: 303,
    headers: { Location: `/study/session/${session.id}` },
  });
};
