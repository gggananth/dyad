import type { APIRoute } from "astro";
import { anovaRow, toCsv } from "../../../lib/anova";
import { requireLabAdmin } from "../../../lib/lab-auth";
import { exportPayload, listSessions } from "../../../lib/store";

export const GET: APIRoute = async ({ request, url }) => {
  const denied = requireLabAdmin(request);
  if (denied) return denied;
  if (url.searchParams.get("format") === "csv") {
    const sessions = await listSessions();
    const rows = sessions
      .filter((session) => session.relativeQuality != null && session.relativeExperience != null)
      .map(anovaRow);
    return new Response(toCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=dyad-anova.csv",
      },
    });
  }

  const payload = await exportPayload();
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": "attachment; filename=dyad-export.json",
    },
  });
};
