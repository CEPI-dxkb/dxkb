import { NextRequest, NextResponse } from "next/server";
import { createAppService } from "@/lib/app-service";
import { requireAuthToken } from "@/lib/auth/session";

/**
 * Combined task + app summary endpoint
 * POST /api/services/app-service/jobs/summary
 */
export async function POST(request: NextRequest) {
  try {
    const token = await requireAuthToken();
    if (token instanceof NextResponse) return token;

    const body = await request.json();
    const { include_archived = false } = body;

    const appService = createAppService(token);

    const [taskSummary, appSummary] = await Promise.all([
      appService.queryTaskSummaryFiltered({ include_archived }),
      appService.queryAppSummaryFiltered({ include_archived }),
    ]);

    return NextResponse.json({ taskSummary, appSummary });
  } catch (error) {
    console.error("Error querying job summaries:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}