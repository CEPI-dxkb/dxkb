import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const credentials = await request.json();

    const response = await fetch("https://user.bv-brc.org/reset", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ email: credentials.usernameOrEmail }),
    });
    console.log("RESET PASSWORD RESPONSE", response);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        {
          message: errorData.message || "Failed to send password reset email",
          code: errorData.code,
        },
        { status: response.status },
      );
    }

    return NextResponse.json({
      message: "Password reset email sent successfully",
      success: true,
    });
  } catch (error) {
    console.error("Password reset error:", error);
    return NextResponse.json(
      { message: "Password reset service unavailable" },
      { status: 503 },
    );
  }
}
