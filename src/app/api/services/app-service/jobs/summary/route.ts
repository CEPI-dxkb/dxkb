import { protectedRoute } from "@/lib/api/protected-route";

/**
 * Combined task + app summary endpoint
 * POST /api/services/app-service/jobs/summary
 */
export const POST = protectedRoute(async ({ appService, request }) => {
  const body = await request.json();
  const { include_archived = false } = body;

  const [taskSummary, appSummary] = await Promise.all([
    appService.queryTaskSummaryFiltered({ include_archived }),
    appService.queryAppSummaryFiltered({ include_archived }),
  ]);

  return { taskSummary, appSummary };
});
