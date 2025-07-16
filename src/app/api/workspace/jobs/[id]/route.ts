import { NextRequest, NextResponse } from "next/server";
import { createWorkspaceService } from "../../../../../lib/workspace-service";
import { cookies } from "next/headers";
import { safeDecodeURIComponent } from "../../../../../lib/auth-utils";

interface RouteParams {
  params: { id: string };
}

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

    const jobId = params.id;

    if (!jobId) {
      return NextResponse.json(
        { error: "Job ID is required" },
        { status: 400 },
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const includeLogs = searchParams.get("include_logs") === "true";

    // Create workspace service
    const workspaceService = createWorkspaceService(token);

    // Get job details
    const jobDetails = await workspaceService.queryJobDetails({
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
