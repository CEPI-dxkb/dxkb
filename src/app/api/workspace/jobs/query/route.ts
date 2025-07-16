import { NextRequest, NextResponse } from "next/server";
import { createWorkspaceService } from "../../../../../lib/workspace-service";
import { cookies } from "next/headers";
import { safeDecodeURIComponent } from "../../../../../lib/auth-utils";

export async function POST(request: NextRequest) {
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

    // Parse request body
    const body = await request.json();
    const { job_ids } = body;

    if (!job_ids || !Array.isArray(job_ids) || job_ids.length === 0) {
      return NextResponse.json(
        { error: "job_ids array is required" },
        { status: 400 },
      );
    }

    // Create workspace service
    const workspaceService = createWorkspaceService(token);

    // Query jobs
    const jobs = await workspaceService.queryJobs({ job_ids: job_ids });

    return NextResponse.json({
      jobs,
      count: jobs.length,
    });
  } catch (error) {
    console.error("Error querying jobs:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
