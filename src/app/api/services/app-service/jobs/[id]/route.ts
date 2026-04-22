import { NextRequest, NextResponse } from "next/server";
import { createAppService } from "@/lib/app-service";
import { withAuth } from "@/lib/auth/server/instance";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Get job details
 * GET /api/services/app-service/jobs/[id]
 */
export const GET = withAuth<RouteParams>(
  async (request: NextRequest, { token, params }) => {
    const { id: jobId } = await params;

    if (!jobId) {
      return NextResponse.json(
        { error: "Job ID is required" },
        { status: 400 },
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const includeLogs = searchParams.get("include_logs") === "true";

    // Create app service
    const appService = createAppService(token);

    // Get job details
    const jobDetails = await appService.queryJobDetails({
      job_id: jobId,
      include_logs: includeLogs,
    });

    return NextResponse.json(jobDetails);
  },
);
