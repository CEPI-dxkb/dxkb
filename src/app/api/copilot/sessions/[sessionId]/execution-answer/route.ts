import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth/server/route";
import { answerCopilot, copilotBadRequest } from "@/lib/copilot/route-errors";
import { declineCopilotExecution, isCopilotId } from "@/lib/copilot/server";

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

const bodySchema = z.object({
  actions: z
    .array(z.looseObject({ tool: z.string().min(1).max(100) }))
    .min(1)
    .max(50),
});

/**
 * "No" on an execution card (`{actions}`, the card's prepared actions):
 * records the answer on the stored card. Nothing runs. Yes and Other are chat
 * turns (`/api/copilot/chat` with `replayActions` / `preparedActions`).
 */
export const POST = withAuth<RouteParams>(
  async (request: NextRequest, { token, params }) => {
    const { sessionId } = await params;
    if (!isCopilotId(sessionId)) return copilotBadRequest("Invalid session id.");
    const body = bodySchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return copilotBadRequest("The prepared actions are required.");
    return answerCopilot(async () => {
      await declineCopilotExecution(token, sessionId, body.data.actions);
      return new NextResponse(null, { status: 204 });
    });
  },
);
