import { protectedRoute } from "@/lib/api/protected-route";

/**
 * Kill a job
 * POST /api/services/app-service/jobs/[id]/kill
 */
export const POST = protectedRoute(async ({ appService, params }) => {
  return appService.killJob({ job_id: params.id });
});
