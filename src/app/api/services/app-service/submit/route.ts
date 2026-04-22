import { NextRequest, NextResponse } from "next/server";
import { createAppService } from "@/lib/app-service";
import { withAuth } from "@/lib/auth/server";

/**
 * Submit a service job
 * POST /api/services/app-service/submit
 */
export const POST = withAuth(async (request: NextRequest, { token }) => {
  // Parse request body
  const body = await request.json();
  const { app_name, app_params, context } = body;

  // Validate required fields
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

  // Create app service
  const appService = createAppService(token);

  // Submit the service job
  const result = await appService.submitService({
    app_name,
    app_params,
    context,
  });

  return NextResponse.json({
    success: true,
    job: result,
  });
});
