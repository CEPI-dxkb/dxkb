import { NextResponse } from "next/server";
import { clearBvbrcAuthCookies } from "../utils";

/**
 * Sign out (better-auth style endpoint)
 * POST /api/auth/sign-out
 */
export async function POST() {
  try {
    // Clear all BV-BRC authentication cookies
    await clearBvbrcAuthCookies();

    // Return better-auth style response
    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Sign out error:", error);
    return NextResponse.json(
      { message: "Failed to sign out" },
      { status: 500 },
    );
  }
}
