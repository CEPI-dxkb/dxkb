import { NextRequest, NextResponse } from "next/server";
import { createAppService } from "@/lib/app-service";
import { getBvbrcAuthToken } from "@/lib/auth";

/**
 * Enumerate jobs
 * GET /api/services/app-service/jobs
 */
export async function GET(request: NextRequest) {
  try {
    // Get BV-BRC authentication token from cookies
    const token = await getBvbrcAuthToken();

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

    // Create app service
    const appService = createAppService(token);

    // Enumerate jobs
    const jobs = await appService.enumerateJobs({ offset, limit });

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

