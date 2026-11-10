import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/server/route";
import {
  defaultCopilotSessionPage,
  maxCopilotSessionPage,
  readCopilotSessions,
} from "@/lib/copilot/server";
import type { CopilotSessionsResponse } from "@/lib/copilot/types";
import { answerCopilot, copilotNoStore } from "@/lib/copilot/route-errors";

function pageValue(raw: string | null, fallback: number): number {
  if (raw === null || !/^\d+$/.test(raw)) return fallback;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : Number.MAX_SAFE_INTEGER;
}

export const GET = withAuth(async (request, { token }) => {
  const params = request.nextUrl.searchParams;
  const limit = Math.min(
    Math.max(pageValue(params.get("limit"), defaultCopilotSessionPage), 1),
    maxCopilotSessionPage,
  );
  const offset = pageValue(params.get("offset"), 0);

  return answerCopilot(async () =>
    NextResponse.json<CopilotSessionsResponse>(
      await readCopilotSessions(token, { limit, offset }, request.signal),
      { headers: copilotNoStore },
    ),
  );
});
