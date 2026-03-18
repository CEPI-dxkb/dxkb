import { NextResponse } from "next/server";
import { z } from "zod";
import { protectedRoute } from "@/lib/api/protected-route";

const requestSchema = z.object({
  offset: z.number().int().nonnegative().default(0),
  limit: z.number().int().positive().max(1000).default(200),
  include_archived: z.boolean().default(false),
  sort_field: z
    .enum(["status", "app", "submit_time", "start_time", "completed_time"])
    .optional(),
  sort_order: z.enum(["asc", "desc"]).optional(),
  app: z.string().optional(),
});

/**
 * Enumerate jobs with server-side pagination and archived support
 * POST /api/services/app-service/jobs/enumerate-tasks-filtered
 */
export const POST = protectedRoute(async ({ appService, request }) => {
  const body = await request.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request parameters", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const jobs = await appService.enumerateTasksFiltered(parsed.data);

  return { jobs };
});
