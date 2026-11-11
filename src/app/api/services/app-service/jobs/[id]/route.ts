import { NextRequest, NextResponse } from "next/server";
import { createAppService } from "@/lib/app-service";
import { withAuth } from "@/lib/auth/server/route";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const GET = withAuth<RouteParams>(
  async (request: NextRequest, { token, params }) => {
    const { id: jobId } = await params;

    if (!jobId) {
      return NextResponse.json(
        { error: "Job ID is required" },
        { status: 400 },
      );
    }

    const { searchParams } = new URL(request.url);
    const includeLogs = searchParams.get("include_logs") === "true";

    const appService = createAppService(token);

    const jobDetails = await appService.queryJobDetails({
      job_id: jobId,
      include_logs: includeLogs,
    });

    return NextResponse.json(jobDetails);
  },
);
