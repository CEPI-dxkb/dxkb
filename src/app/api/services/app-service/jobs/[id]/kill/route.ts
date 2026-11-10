import { NextRequest, NextResponse } from "next/server";
import { createAppService } from "@/lib/app-service";
import { withAuth } from "@/lib/auth/server/route";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const POST = withAuth<RouteParams>(
  async (request: NextRequest, { token, params }) => {
    const { id: jobId } = await params;

    if (!jobId) {
      return NextResponse.json(
        { error: "Job ID is required" },
        { status: 400 },
      );
    }

    const appService = createAppService(token);

    const result = await appService.killJob({ job_id: jobId });

    return NextResponse.json(result);
  },
);
