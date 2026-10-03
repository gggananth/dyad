import type { APIRoute } from "astro";
import { currentStudy } from "../../lib/auth";
import { acceptOffer, declineOffer } from "../../lib/store";

export const POST: APIRoute = async ({ request }) => {
  const study = await currentStudy(request);
  if (!study) {
    return new Response(null, { status: 303, headers: { Location: "/" } });
  }

  const form = await request.formData();
  const action = String(form.get("action") ?? "");
  if (action === "decline") {
    const next = await declineOffer(study.id);
    if (!next) {
      return new Response(null, {
        status: 303,
        headers: { Location: "/study/offer?exhausted=1" },
      });
    }
    return new Response(null, {
      status: 303,
      headers: { Location: "/study/offer" },
    });
  }

  await acceptOffer(study.id);
  return new Response(null, {
    status: 303,
    headers: { Location: "/study/write" },
  });
};
