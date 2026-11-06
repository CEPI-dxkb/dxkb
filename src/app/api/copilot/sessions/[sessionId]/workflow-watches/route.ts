import { NextResponse, type NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/server/route";
import {
  answerCopilot,
  copilotBadRequest,
  copilotNoStore,
} from "@/lib/copilot/route-errors";
import {
  isCopilotId,
  readCopilotWorkflowWatches,
} from "@/lib/copilot/server";
import type { CopilotWorkflowWatchesResponse } from "@/lib/copilot/types";

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

/**
 * The jobs the gateway watches for this chat. When one ends, the gateway
 * writes a completion message into the chat; the client polls this to know
 * when to reload it.
 */
export const GET = withAuth<RouteParams>(
  async (request: NextRequest, { token, params }) => {
    const { sessionId } = await params;
    if (!isCopilotId(sessionId)) return copilotBadRequest("Invalid session id.");
    return answerCopilot(async () =>
      NextResponse.json<CopilotWorkflowWatchesResponse>(
        {
          watches: await readCopilotWorkflowWatches(
            token,
            sessionId,
            request.signal,
          ),
        },
        { headers: copilotNoStore },
      ),
    );
  },
);
