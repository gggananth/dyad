import type { APIRoute } from "astro";
import { labLoginCookie, labPasswordConfigured, labPasswordsMatch } from "../../../lib/lab-auth";

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");

  if (!labPasswordConfigured() || !labPasswordsMatch(password)) {
    return new Response(null, {
      status: 303,
      headers: { Location: "/labs?error=1" },
    });
  }

  return new Response(null, {
    status: 303,
    headers: {
      Location: "/labs",
      "Set-Cookie": labLoginCookie(),
    },
  });
};
