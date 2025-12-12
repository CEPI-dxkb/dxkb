import { NextRequest, NextResponse } from "next/server";
import { getServerAuthToken } from "@/lib/auth";
import { createAppService } from "@/lib/app-service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Get job stderr
 * GET /api/services/app-service/jobs/[id]/stderr
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const token = await getServerAuthToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: jobId } = await params;

    const appService = createAppService(token);
    const output = await appService.fetchJobOutput({
      job_id: jobId,
      output_type: "stderr",
    });

    return new NextResponse(output, {
      headers: {
        "Content-Type": "text/plain",
      },
    });
  } catch (error) {
    console.error("Error fetching stderr:", error);
    return NextResponse.json(
      { error: "Failed to fetch stderr" },
      { status: 500 },
    );
  }
}

