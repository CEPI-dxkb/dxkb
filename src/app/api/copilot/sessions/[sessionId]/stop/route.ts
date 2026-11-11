import { NextResponse, type NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/server/route";
import { answerCopilot, copilotBadRequest } from "@/lib/copilot/route-errors";
import { isCopilotId, stopCopilotSession } from "@/lib/copilot/server";
import type { CopilotErrorBody } from "@/lib/copilot/types";

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

/** 404 `NO_TURN` when nothing is running yet (the request may not have reached the gateway; the client retries once). */
export const POST = withAuth<RouteParams>(
  async (_request: NextRequest, { token, params }) => {
    const { sessionId } = await params;
    if (!isCopilotId(sessionId)) return copilotBadRequest("Invalid session id.");
    return answerCopilot(async () => {
      const stopped = await stopCopilotSession(token, sessionId);
      if (!stopped) {
        return NextResponse.json<CopilotErrorBody>(
          {
            error: "No turn is running in this chat.",
            code: "not_found",
            copilotCode: "NO_TURN",
          },
          { status: 404 },
        );
      }
      return NextResponse.json(stopped, { status: 202 });
    });
  },
);
