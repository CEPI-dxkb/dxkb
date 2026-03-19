import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getRequiredEnv } from "@/lib/env";

/**
 * Send verification email (better-auth style endpoint)
 * POST /api/auth/send-verification-email
 */
export async function POST() {
  try {
    const { token, userId } = await getSession();

    if (!token || !userId) {
      return NextResponse.json(
        {
          success: false,
          message: "Authentication required. Please sign in first.",
        },
        { status: 401 },
      );
    }

    // Call BV-BRC email verification endpoint
    const response = await fetch(getRequiredEnv("USER_VERIFICATION_URL"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: token,
      },
      body: JSON.stringify({
        id: userId,
      }),
    });

    if (response.ok) {
      return NextResponse.json({
        success: true,
        message: "Verification email sent successfully",
      });
    } else {
      const errorData = await response.json().catch(() => ({}));

      return NextResponse.json(
        {
          success: false,
          message: errorData.message || "Failed to send verification email",
        },
        { status: response.status },
      );
    }
  } catch (error) {
    console.error("Send verification email error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
      },
      { status: 500 },
    );
  }
}
