import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { safeDecodeURIComponent } from "../utils";

export async function POST(request: NextRequest) {
  try {
    // Get authentication data from cookies
    const cookieStore = await cookies();
    const rawToken = cookieStore.get("token")?.value;
    const token = rawToken ? safeDecodeURIComponent(rawToken) : undefined;
    const username = cookieStore.get("user_id")?.value;

    console.log("VERIFY EMAIL - Token from cookies:", !!token, "Username:", username);

    if (!token || !username) {
      return NextResponse.json(
        {
          success: false,
          message: "Authentication required. Please log in first.",
        },
        { status: 401 },
      );
    }

    // Call BV-BRC email verification endpoint
    const response = await fetch("https://user.patricbrc.org/verify/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: token,
      },
      body: JSON.stringify({
        id: username,
      }),
    });

    if (response.ok) {
      const result = await response.text();

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

// Also support GET method for cases where verification token is passed via URL
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

    // For GET requests, we use the verification token from URL params
    // This is typically used when users click email verification links
    const response = await fetch("https://user.patricbrc.org/verify/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        token: verificationToken,
        username: verificationUsername,
      }),
    });

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
