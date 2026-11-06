import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth/server/route";
import {
  answerCopilot,
  copilotBadRequest,
  readCopilotJsonBody,
} from "@/lib/copilot/route-errors";
import {
  copilotActionsSchema,
  declineCopilotExecution,
  isCopilotId,
} from "@/lib/copilot/server";

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

const maxBodyBytes = 1024 * 1024;

const bodySchema = z.object({ actions: copilotActionsSchema });

/**
 * "No" on an execution card (`{actions}`, the card's prepared actions):
 * records the answer on the stored card. Nothing runs. Yes and Other are chat
 * turns (`/api/copilot/chat` with `replayActions` / `preparedActions`).
 */
export const POST = withAuth<RouteParams>(
  async (request: NextRequest, { token, params }) => {
    const { sessionId } = await params;
    if (!isCopilotId(sessionId)) return copilotBadRequest("Invalid session id.");
    const parsed = await readCopilotJsonBody(request, maxBodyBytes);
    if ("error" in parsed) return parsed.error;
    const body = bodySchema.safeParse(parsed.value);
    if (!body.success) return copilotBadRequest("The prepared actions are required.");
    return answerCopilot(async () => {
      await declineCopilotExecution(token, sessionId, body.data.actions);
      return new NextResponse(null, { status: 204 });
    });
  },
);
