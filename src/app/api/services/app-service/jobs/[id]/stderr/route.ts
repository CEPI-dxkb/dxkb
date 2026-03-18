import { NextResponse } from "next/server";
import { protectedRoute } from "@/lib/api/protected-route";

/**
 * Get job stderr
 * GET /api/services/app-service/jobs/[id]/stderr
 */
export const GET = protectedRoute(
  async ({ appService, params }) => {
    return appService.fetchJobOutput({
      job_id: params.id,
      output_type: "stderr",
    });
  },
  {
    formatResponse: (result) =>
      new NextResponse(result as string, {
        headers: { "Content-Type": "text/plain" },
      }),
  },
);
