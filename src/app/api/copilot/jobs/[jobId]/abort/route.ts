import { NextResponse, type NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/server/route";
import { answerCopilot, copilotBadRequest } from "@/lib/copilot/route-errors";
import { abortCopilotJob, isCopilotId } from "@/lib/copilot/server";

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

/** Stops a running turn by the job id its `started` event named. */
export const POST = withAuth<RouteParams>(
  async (_request: NextRequest, { token, params }) => {
    const { jobId } = await params;
    if (!isCopilotId(jobId)) return copilotBadRequest("Invalid job id.");
    return answerCopilot(async () => {
      await abortCopilotJob(token, jobId);
      return new NextResponse(null, { status: 202 });
    });
  },
);
