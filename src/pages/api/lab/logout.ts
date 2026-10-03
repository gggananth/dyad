import type { APIRoute } from "astro";
import { labLogoutCookie } from "../../../lib/lab-auth";

export const POST: APIRoute = async () => {
  return new Response(null, {
    status: 303,
    headers: {
      Location: "/labs",
      "Set-Cookie": labLogoutCookie(),
    },
  });
};
