import { NextRequest, NextResponse } from "next/server";
import { authAdmin } from "@/lib/auth/server";

/**
 * Verify email via URL link (better-auth style endpoint)
 * GET /api/auth/verify-email-token?token=xxx&username=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const verificationToken = searchParams.get("token");
    const verificationUsername = searchParams.get("username");

    if (!verificationToken || !verificationUsername) {
      return NextResponse.json(
        {
          success: false,
          message: "Verification token and username are required",
        },
        { status: 400 },
      );
    }

    const result = await authAdmin.verifyEmailToken(
      verificationToken,
      verificationUsername,
    );

    if (result.error) {
      if (result.error.code === "service_unavailable" && result.error.status === 504) {
        return NextResponse.json(
          {
            success: false,
            message: "Email verification request timed out",
          },
          { status: 504 },
        );
      }
      return NextResponse.json(
        {
          success: false,
          message: result.error.message,
        },
        { status: result.error.status ?? 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Email verified successfully",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json(
        { success: false, message: "Email verification request timed out" },
        { status: 504 },
      );
    }
    console.error("Email verification error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Internal server error during email verification",
      },
      { status: 500 },
    );
  }
}
