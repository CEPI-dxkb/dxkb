import { NextRequest, NextResponse } from "next/server";
import { authAdmin } from "@/lib/auth/server";

/**
 * POST /api/auth/change-password — Change user password via JSON-RPC.
 * Body: { currentPassword, newPassword }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { currentPassword, newPassword } = body;

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

    const result = await authAdmin.changePassword(
      currentPassword,
      newPassword,
    );

    if (result.error) {
      return NextResponse.json(
        { message: result.error.message },
        { status: result.error.status ?? 500 },
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
