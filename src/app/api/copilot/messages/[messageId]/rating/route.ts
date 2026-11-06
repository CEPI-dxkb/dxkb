import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth/server/route";
import { answerCopilot, copilotBadRequest } from "@/lib/copilot/route-errors";
import { isCopilotId, rateCopilotMessage } from "@/lib/copilot/server";

interface RouteParams {
  params: Promise<{ messageId: string }>;
}

const ratingSchema = z.object({
  rating: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
});

/** Rates a saved answer: `{rating: -1 | 0 | 1}` (0 clears it). */
export const POST = withAuth<RouteParams>(
  async (request: NextRequest, { token, params }) => {
    const { messageId } = await params;
    if (!isCopilotId(messageId)) return copilotBadRequest("Invalid message id.");
    const body = ratingSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return copilotBadRequest("Rating must be -1, 0 or 1.");
    return answerCopilot(async () => {
      await rateCopilotMessage(token, messageId, body.data.rating);
      return new NextResponse(null, { status: 204 });
    });
  },
);
