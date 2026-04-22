import { NextRequest, NextResponse } from "next/server";
import { createAppService } from "@/lib/app-service";
import { withAuth } from "@/lib/auth/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Kill a job
 * POST /api/services/app-service/jobs/[id]/kill
 */
export const POST = withAuth<RouteParams>(
  async (request: NextRequest, { token, params }) => {
    const { id: jobId } = await params;

    if (!jobId) {
      return NextResponse.json(
        { error: "Job ID is required" },
        { status: 400 },
      );
    }

    // Create app service
    const appService = createAppService(token);

    // Kill the job
    const result = await appService.killJob({ job_id: jobId });

    return NextResponse.json(result);
  },
);
