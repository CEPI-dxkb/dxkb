import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAppService } from "@/lib/app-service";
import { requireAuthToken } from "@/lib/auth/session";

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
export async function POST(request: NextRequest) {
  try {
    const token = await requireAuthToken();
    if (token instanceof NextResponse) return token;

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request parameters", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { offset, limit, include_archived, sort_field, sort_order, app } =
      parsed.data;

    const appService = createAppService(token);

    const jobs = await appService.enumerateTasksFiltered({
      offset,
      limit,
      include_archived,
      sort_field,
      sort_order,
      app,
    });

    return NextResponse.json({ jobs });
  } catch (error) {
    console.error("Error enumerating filtered jobs:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
