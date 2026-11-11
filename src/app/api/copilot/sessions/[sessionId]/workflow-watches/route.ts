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

/** The client polls this to know when to reload the gateway's completion message. */
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
