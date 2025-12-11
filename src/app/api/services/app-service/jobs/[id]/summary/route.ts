import { NextRequest, NextResponse } from "next/server";
import { createAppService } from "@/lib/app-service";
import { cookies } from "next/headers";
import { safeDecodeURIComponent } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Get job summary
 * GET /api/services/app-service/jobs/[id]/summary
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Get authentication token from cookies
    const cookieStore = await cookies();
    const rawToken = cookieStore.get("token")?.value;
    const token = rawToken ? safeDecodeURIComponent(rawToken) : undefined;

    if (!token) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const { id: jobId } = await params;

    if (!jobId) {
      return NextResponse.json(
        { error: "Job ID is required" },
        { status: 400 },
      );
    }

    // Create app service
    const appService = createAppService(token);

    // Get job summary
    const summary = await appService.queryJobSummary({ job_id: jobId });

    return NextResponse.json(summary);
  } catch (error) {
    console.error("Error getting job summary:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

