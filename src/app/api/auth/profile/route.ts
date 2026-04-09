import { NextRequest, NextResponse } from "next/server";

import { requireAuth, serverAuthenticatedFetch } from "@/lib/auth/session";
import { getRequiredEnv } from "@/lib/env";

/**
 * GET /api/auth/profile — Fetch full user profile from BV-BRC.
 */
export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const response = await serverAuthenticatedFetch(
      `${getRequiredEnv("USER_URL")}/${encodeURIComponent(auth.userId)}`,
      { headers: { Accept: "application/json" } },
    );

    if (!response.ok) {
      return NextResponse.json(
        { message: "Failed to fetch profile" },
        { status: response.status },
      );
    }

    const profile = await response.json();
    return NextResponse.json(profile);
  } catch (error) {
    console.error("Profile fetch error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/auth/profile — Update profile via JSON Patch.
 * Body: [{ op, path, value }]
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const body = await request.text();

    const response = await serverAuthenticatedFetch(
      `${getRequiredEnv("USER_URL")}/${encodeURIComponent(auth.userId)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json-patch+json",
          Accept: "application/json",
        },
        body,
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { message: errorText || "Failed to update profile" },
        { status: response.status },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
