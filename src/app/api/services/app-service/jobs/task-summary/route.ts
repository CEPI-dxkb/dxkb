import { NextRequest, NextResponse } from "next/server";
import { createAppService } from "@/lib/app-service";
import { withAuth } from "@/lib/auth/server";

/**
 * Query task status summary
 * POST /api/services/app-service/jobs/task-summary
 */
export const POST = withAuth(async (request: NextRequest, { token }) => {
  const body = await request.json();
  const { include_archived = false } = body;

  const appService = createAppService(token);

  const summary = await appService.queryTaskSummaryFiltered({
    include_archived,
  });

  return NextResponse.json({ summary });
});
