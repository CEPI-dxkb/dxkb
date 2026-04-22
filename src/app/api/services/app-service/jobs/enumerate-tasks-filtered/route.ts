import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAppService } from "@/lib/app-service";
import { withAuth } from "@/lib/auth/server/instance";

const requestSchema = z.object({
  offset: z.number().int().nonnegative().default(0),
  limit: z.number().int().positive().max(1000).default(200),
  include_archived: z.boolean().default(false),
  sort_field: z
    .enum(["status", "app", "submit_time", "start_time", "completed_time"])
    .optional(),
  sort_order: z.enum(["asc", "desc"]).optional(),
  app: z.string().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
});

/**
 * Enumerate jobs with server-side pagination and archived support
 * POST /api/services/app-service/jobs/enumerate-tasks-filtered
 */
export const POST = withAuth(async (request: NextRequest, { token }) => {
  const body = await request.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request parameters", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const {
    offset, limit, include_archived, sort_field, sort_order, app,
    start_time, end_time,
  } = parsed.data;

  const appService = createAppService(token);
  const result = await appService.enumerateTasksFiltered({
    offset,
    limit,
    include_archived,
    sort_field,
    sort_order,
    app,
    start_time,
    end_time,
  });

  return NextResponse.json({
    jobs: result.jobs,
    totalTasks: result.totalTasks,
  });
});
