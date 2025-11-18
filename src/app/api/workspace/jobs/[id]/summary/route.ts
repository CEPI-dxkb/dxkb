import { NextRequest, NextResponse } from "next/server";
import { createWorkspaceService } from "../../../../../../lib/workspace-service";
import { cookies } from "next/headers";
import { safeDecodeURIComponent } from "../../../../../../lib/auth-utils";

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

    // Create workspace service
    const workspaceService = createWorkspaceService(token);

    // Get job summary
    const jobSummary = await workspaceService.queryJobSummary({
      job_id: jobId,
    });

    return NextResponse.json(jobSummary);
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
