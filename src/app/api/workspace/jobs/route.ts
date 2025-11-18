import { NextRequest, NextResponse } from "next/server";
import { serverAuthenticatedFetch } from "../../../../lib/server-auth-utils";
import { createWorkspaceService } from "../../../../lib/workspace-service";
import { cookies } from "next/headers";
import { safeDecodeURIComponent } from "../../../../lib/auth-utils";

export async function GET(request: NextRequest) {
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const limit = parseInt(searchParams.get("limit") || "30000", 10);
    const statusFilter = searchParams.get("status_filter")?.split(",") || [];
    const appFilter = searchParams.get("app_filter")?.split(",") || [];

    // Create workspace service
    const workspaceService = createWorkspaceService(token);

    // Enumerate jobs
    const jobs = await workspaceService.enumerateJobs({ offset, limit });

    // Apply client-side filtering if needed
    let filteredJobs = jobs;

    if (statusFilter.length > 0) {
      filteredJobs = filteredJobs.filter((job) =>
        statusFilter.includes(job.status),
      );
    }

    if (appFilter.length > 0) {
      filteredJobs = filteredJobs.filter((job) => appFilter.includes(job.app));
    }

    return NextResponse.json({
      jobs: filteredJobs,
      pagination: {
        offset,
        limit,
        total: filteredJobs.length,
      },
    });
  } catch (error) {
    console.error("Error enumerating jobs:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
