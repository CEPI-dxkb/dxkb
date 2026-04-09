import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/session";
import { getRequiredEnv } from "@/lib/env";

/**
 * POST /api/auth/change-password — Change user password via JSON-RPC.
 * Body: { currentPassword, newPassword }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { currentPassword, newPassword } = await request.json();

    if (
      typeof currentPassword !== "string" ||
      typeof newPassword !== "string" ||
      !currentPassword ||
      !newPassword
    ) {
      return NextResponse.json(
        { message: "Current password and new password are required" },
        { status: 400 },
      );
    }

    const headers = new Headers();
    headers.set("Authorization", auth.token);
    headers.set("Content-Type", "application/json");
    headers.set("Accept", "application/json");

    const response = await fetch(
      `${getRequiredEnv("USER_URL")}/`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          id: 1,
          jsonrpc: "2.0",
          method: "setPassword",
          params: [auth.userId, currentPassword, newPassword],
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { message: errorText || "Failed to change password" },
        { status: response.status },
      );
    }

    const result = await response.json();

    if (result.error) {
      return NextResponse.json(
        { message: result.error.message || "Failed to change password" },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
