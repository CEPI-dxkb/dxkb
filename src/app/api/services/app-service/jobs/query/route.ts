import { NextRequest, NextResponse } from "next/server";
import { createAppService } from "@/lib/app-service";
import { getBvbrcAuthToken } from "@/lib/auth";

/**
 * Query specific jobs by IDs
 * POST /api/services/app-service/jobs/query
 */
export async function POST(request: NextRequest) {
  try {
    // Get BV-BRC authentication token from cookies
    const token = await getBvbrcAuthToken();

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

    // Create app service
    const appService = createAppService(token);

    // Query jobs
    const jobs = await appService.queryJobs({ job_ids: job_ids });

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

