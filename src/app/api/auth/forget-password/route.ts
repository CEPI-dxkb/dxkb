import { NextRequest, NextResponse } from "next/server";

/**
 * Request password reset (better-auth style endpoint)
 * POST /api/auth/forget-password
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { usernameOrEmail, email } = body;

    // Support both usernameOrEmail and email fields
    const identifier = usernameOrEmail || email;

    if (!identifier) {
      return NextResponse.json(
        { message: "Email or username is required" },
        { status: 400 },
      );
    }

    // Call BV-BRC password reset endpoint
    const response = await fetch("https://user.bv-brc.org/reset", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ email: identifier }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        {
          success: false,
          message: errorData.message || "Failed to send password reset email",
        },
        { status: response.status },
      );
    }

    // Return better-auth style response
    return NextResponse.json({
      success: true,
      message: "Password reset email sent successfully",
    });
  } catch (error) {
    console.error("Forget password error:", error);
    return NextResponse.json(
      { 
        success: false,
        message: "Password reset service unavailable" 
      },
      { status: 503 },
    );
  }
}
