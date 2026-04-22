import { NextRequest, NextResponse } from "next/server";
import { authAdmin } from "@/lib/auth/server/instance";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const identifier = body.usernameOrEmail || body.email;

    if (!identifier) {
      return NextResponse.json(
        { message: "Email or username is required" },
        { status: 400 },
      );
    }

    const result = await authAdmin.requestPasswordReset(identifier);

    if (result.error) {
      const status =
        result.error.code === "network" ? 503 : (result.error.status ?? 500);
      const message =
        result.error.code === "network"
          ? "Password reset service unavailable"
          : result.error.message;
      return NextResponse.json(
        { success: false, message },
        { status },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Password reset email sent successfully",
    });
  } catch (error) {
    console.error("Forget password error:", error);
    return NextResponse.json(
      { success: false, message: "Password reset service unavailable" },
      { status: 503 },
    );
  }
}
