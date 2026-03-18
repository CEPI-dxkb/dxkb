import { protectedRoute } from "@/lib/api/protected-route";

/**
 * Query task status summary
 * POST /api/services/app-service/jobs/task-summary
 */
export const POST = protectedRoute(async ({ appService, request }) => {
  const body = await request.json();
  const { include_archived = false } = body;

  const summary = await appService.queryTaskSummaryFiltered({
    include_archived,
  });

  return { summary };
});
