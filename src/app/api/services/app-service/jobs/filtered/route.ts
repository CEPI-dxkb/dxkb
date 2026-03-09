import { NextRequest, NextResponse } from "next/server";
import { createAppService } from "@/lib/app-service";
import { getBvbrcAuthToken } from "@/lib/auth";

const MAX_LIMIT = 1000;
const ALLOWED_SORT_FIELDS = new Set([
  "status",
  "app",
  "submit_time",
  "start_time",
  "completed_time",
]);
const ALLOWED_SORT_ORDERS = new Set(["asc", "desc"]);

/**
 * Enumerate jobs with server-side pagination and archived support
 * POST /api/services/app-service/jobs/filtered
 */
export async function POST(request: NextRequest) {
  try {
    const token = await getBvbrcAuthToken();

    if (!token) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const {
      offset = 0,
      limit = 200,
      include_archived = false,
      sort_field,
      sort_order,
    } = body;

    // Validate and clamp numeric inputs
    const sanitizedOffset = Math.max(0, Math.floor(Number(offset) || 0));
    const parsedLimit = Number(limit);
    const sanitizedLimit = Math.min(
      MAX_LIMIT,
      Math.max(1, Math.floor(Number.isFinite(parsedLimit) ? parsedLimit : 200)),
    );

    // Validate sort_field against allowlist
    const sanitizedSortField =
      sort_field && ALLOWED_SORT_FIELDS.has(sort_field)
        ? sort_field
        : undefined;

    // Validate sort_order against allowlist
    const sanitizedSortOrder =
      sort_order && ALLOWED_SORT_ORDERS.has(sort_order)
        ? (sort_order as "asc" | "desc")
        : undefined;

    const appService = createAppService(token);

    const jobs = await appService.enumerateTasksFiltered({
      offset: sanitizedOffset,
      limit: sanitizedLimit,
      include_archived: Boolean(include_archived),
      sort_field: sanitizedSortField,
      sort_order: sanitizedSortOrder,
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
