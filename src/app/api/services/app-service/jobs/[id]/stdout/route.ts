import { NextRequest, NextResponse } from "next/server";
import { getBvbrcAuthToken } from "@/lib/auth";
import { createAppService } from "@/lib/app-service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Get job stdout
 * GET /api/services/app-service/jobs/[id]/stdout
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const token = await getBvbrcAuthToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: jobId } = await params;

    const appService = createAppService(token);
    const output = await appService.fetchJobOutput({
      job_id: jobId,
      output_type: "stdout",
    });

    return new NextResponse(output, {
      headers: {
        "Content-Type": "text/plain",
      },
    });
  } catch (error) {
    console.error("Error fetching stdout:", error);
    return NextResponse.json(
      { error: "Failed to fetch stdout" },
      { status: 500 },
    );
  }
}

