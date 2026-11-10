import { NextRequest, NextResponse } from "next/server";
import { createAppService } from "@/lib/app-service";
import { withAuth } from "@/lib/auth/server/route";

interface JobSummaryBody {
  include_archived?: boolean;
}

export const POST = withAuth(async (request: NextRequest, { token }) => {
  const body = (await request.json()) as JobSummaryBody;
  const { include_archived = false } = body;

  const appService = createAppService(token);

  const [taskSummary, appSummary] = await Promise.all([
    appService.queryTaskSummaryFiltered({ include_archived }),
    appService.queryAppSummaryFiltered({ include_archived }),
  ]);

  return NextResponse.json({ taskSummary, appSummary });
});
