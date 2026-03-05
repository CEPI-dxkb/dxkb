import { NextRequest, NextResponse } from "next/server";
import { createAppService } from "@/lib/app-service";
import { getBvbrcAuthToken } from "@/lib/auth";

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

    const appService = createAppService(token);

    const jobs = await appService.enumerateTasksFiltered({
      offset,
      limit,
      include_archived,
      sort_field,
      sort_order,
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
