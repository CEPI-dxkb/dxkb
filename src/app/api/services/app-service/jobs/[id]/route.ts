import { protectedRoute } from "@/lib/api/protected-route";

/**
 * Get job details
 * GET /api/services/app-service/jobs/[id]
 */
export const GET = protectedRoute(async ({ appService, params, searchParams }) => {
  const includeLogs = searchParams.get("include_logs") === "true";

  return appService.queryJobDetails({
    job_id: params.id,
    include_logs: includeLogs,
  });
});
