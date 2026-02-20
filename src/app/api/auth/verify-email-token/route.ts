import { NextRequest, NextResponse } from "next/server";
import { getRequiredEnv } from "@/lib/env";

/**
 * Verify email via URL link (better-auth style endpoint)
 * GET /api/auth/verify-email-token?token=xxx&username=xxx
 *
 * This is used when users click verification links in emails
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

    const verifyUrl = getRequiredEnv("USER_VERIFICATION_URL");

    const timeoutMs = 15_000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(verifyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          token: verificationToken,
          username: verificationUsername,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (response.ok) {
      const result = await response.json();

      return NextResponse.json({
        success: true,
        message: "Email verified successfully",
        data: result,
      });
    } else {
      const errorData = await response.json().catch(() => ({}));

      return NextResponse.json(
        {
          success: false,
          message: errorData.message || "Email verification failed",
          error: errorData,
        },
        { status: response.status },
      );
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json(
        {
          success: false,
          message: "Email verification request timed out",
        },
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
