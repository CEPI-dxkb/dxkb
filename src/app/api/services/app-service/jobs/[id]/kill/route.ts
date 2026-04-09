import { NextRequest, NextResponse } from "next/server";
import { createAppService } from "@/lib/app-service";
import { requireAuthToken } from "@/lib/auth/session";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Kill a job
 * POST /api/services/app-service/jobs/[id]/kill
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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

    // Create app service
    const appService = createAppService(token);

    // Kill the job
    const result = await appService.killJob({ job_id: jobId });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error killing job:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

