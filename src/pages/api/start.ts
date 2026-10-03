import type { APIRoute } from "astro";
import { COOKIE_STUDY } from "../../lib/config";
import { cookieHeader } from "../../lib/auth";
import { createStudy, offerSession } from "../../lib/store";

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  if (!name) {
    return new Response("A name is required.", { status: 400 });
  }
  const study = await createStudy(name);
  await offerSession(study.id);
  return new Response(null, {
    status: 303,
    headers: {
      Location: "/study/offer",
      "Set-Cookie": cookieHeader(COOKIE_STUDY, study.id),
    },
  });
};
