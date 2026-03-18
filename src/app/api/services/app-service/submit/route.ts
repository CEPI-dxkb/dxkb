import { NextResponse } from "next/server";
import { protectedRoute } from "@/lib/api/protected-route";

/**
 * Submit a service job
 * POST /api/services/app-service/submit
 */
export const POST = protectedRoute(async ({ appService, request }) => {
  const body = await request.json();
  const { app_name, app_params, context } = body;

  if (!app_name) {
    return NextResponse.json(
      { error: "app_name is required" },
      { status: 400 },
    );
  }

  if (!app_params || typeof app_params !== "object") {
    return NextResponse.json(
      { error: "app_params must be an object" },
      { status: 400 },
    );
  }

  const result = await appService.submitService({
    app_name,
    app_params,
    context,
  });

  return { success: true, job: result };
});
