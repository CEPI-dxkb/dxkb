import { NextRequest, NextResponse } from "next/server";
import { createAppService } from "@/lib/app-service";
import { withAuth } from "@/lib/auth/server/route";

interface TaskSummaryBody {
  include_archived?: boolean;
}

export const POST = withAuth(async (request: NextRequest, { token }) => {
  const body = (await request.json()) as TaskSummaryBody;
  const { include_archived = false } = body;

  const appService = createAppService(token);

  const summary = await appService.queryTaskSummaryFresh({
    include_archived,
  });

  return NextResponse.json({ summary });
});
