import { NextRequest, NextResponse } from "next/server";
import { createAppService } from "@/lib/app-service";
import { requireAuthToken } from "@/lib/auth/session";
import { JsonRpcError } from "@/lib/jsonrpc-client";

/**
 * Submit a service job
 * POST /api/services/app-service/submit
 */
export async function POST(request: NextRequest) {
  try {
    const token = await requireAuthToken();
    if (token instanceof NextResponse) return token;

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
  } catch (error) {
    console.error("Error submitting service:", error);

    // Handle JSON-RPC errors with detailed information
    if (error instanceof JsonRpcError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          data: error.data,
        },
        { status: 500 },
      );
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

