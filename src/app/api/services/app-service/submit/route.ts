import { NextRequest, NextResponse } from "next/server";
import { createAppService } from "@/lib/app-service";
import { withAuth } from "@/lib/auth/server/route";

interface SubmitRequestBody {
  app_name?: unknown;
  app_params?: unknown;
}

export const POST = withAuth(async (request: NextRequest, { token }) => {
  const body = (await request.json()) as SubmitRequestBody;
  const { app_name, app_params } = body;

  if (!app_name || typeof app_name !== "string") {
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

  const appService = createAppService(token);

  const result = await appService.submitService({
    app_name,
    app_params: app_params as Record<string, unknown>,
  });

  return NextResponse.json({
    success: true,
    job: result,
  });
});
