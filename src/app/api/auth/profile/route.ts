import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { getRequiredEnv } from "@/lib/env";

/**
 * GET /api/auth/profile — Fetch full user profile from BV-BRC.
 */
export const GET = auth.route(async (_request, { userId }) => {
  try {
    const response = await auth.fetch(
      `${getRequiredEnv("USER_URL")}/${encodeURIComponent(userId)}`,
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
});

/**
 * POST /api/auth/profile — Update profile via JSON Patch.
 * Body: [{ op, path, value }]
 */
export const POST = auth.route(async (request: NextRequest, { userId }) => {
  try {
    const body = await request.text();

    const response = await auth.fetch(
      `${getRequiredEnv("USER_URL")}/${encodeURIComponent(userId)}`,
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
});
