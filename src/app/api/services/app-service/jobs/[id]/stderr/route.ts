import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/server/instance";
import { createAppService } from "@/lib/app-service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Get job stderr
 * GET /api/services/app-service/jobs/[id]/stderr
 */
export const GET = withAuth<RouteParams>(
  async (_request: NextRequest, { token, params }) => {
    const { id: jobId } = await params;

    const appService = createAppService(token);
    const output = await appService.fetchJobOutput({
      job_id: jobId,
      output_type: "stderr",
    });

    return new NextResponse(output, {
      headers: {
        "Content-Type": "text/plain",
      },
    });
  },
);
