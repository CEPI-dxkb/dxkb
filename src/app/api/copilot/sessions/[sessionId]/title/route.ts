import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth/server/route";
import { answerCopilot, copilotBadRequest } from "@/lib/copilot/route-errors";
import { isCopilotId, titleCopilotSession } from "@/lib/copilot/server";

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

const titleSchema = z.object({
  model: z.string().trim().min(1).max(200),
  question: z.string().trim().min(1),
});

/**
 * Titles a session from its first question (`{model, question}`) and saves
 * the title. Answers `{title}`, null when the gateway gave none.
 */
export const POST = withAuth<RouteParams>(
  async (request: NextRequest, { token, params }) => {
    const { sessionId } = await params;
    if (!isCopilotId(sessionId)) return copilotBadRequest("Invalid session id.");
    const body = titleSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return copilotBadRequest("A model and question are required.");
    return answerCopilot(async () =>
      NextResponse.json({
        title: await titleCopilotSession(
          token,
          sessionId,
          body.data.model,
          body.data.question,
        ),
      }),
    );
  },
);
