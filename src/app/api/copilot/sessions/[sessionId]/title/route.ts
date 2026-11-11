import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/auth/server/route";
import {
  answerCopilot,
  copilotBadRequest,
  readCopilotJsonBody,
} from "@/lib/copilot/route-errors";
import {
  isCopilotId,
  maxCopilotQueryLength,
  titleCopilotSession,
} from "@/lib/copilot/server";

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

const maxBodyBytes = 1024 * 1024;

const titleSchema = z.object({
  model: z.string().trim().min(1).max(200),
  question: z.string().trim().min(1).max(maxCopilotQueryLength),
});

/** Answers `{title}`, null when the gateway gave none. */
export const POST = withAuth<RouteParams>(
  async (request: NextRequest, { token, params }) => {
    const { sessionId } = await params;
    if (!isCopilotId(sessionId)) return copilotBadRequest("Invalid session id.");
    const parsed = await readCopilotJsonBody(request, maxBodyBytes);
    if ("error" in parsed) return parsed.error;
    const body = titleSchema.safeParse(parsed.value);
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
