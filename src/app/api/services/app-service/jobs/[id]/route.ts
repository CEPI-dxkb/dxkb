import { NextRequest, NextResponse } from "next/server";
import { createAppService } from "@/lib/app-service";
import { requireAuthToken } from "@/lib/auth/session";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Get job details
 * GET /api/services/app-service/jobs/[id]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const token = await requireAuthToken();
    if (token instanceof NextResponse) return token;

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
  } catch (error) {
    console.error("Error getting job details:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

