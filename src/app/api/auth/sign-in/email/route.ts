import { NextRequest, NextResponse } from "next/server";
import { setBvbrcAuthCookies, getProfileMetadata, extractRealmFromToken } from "../../utils";
import { getRequiredEnv } from "@/lib/env";

/**
 * Sign in with email/username and password (better-auth style endpoint)
 * POST /api/auth/sign-in/email
 */
export async function POST(request: NextRequest) {
  try {
    const credentials = await request.json();

    // Validate required fields
    if (!credentials.username || !credentials.password) {
      return NextResponse.json(
        { message: "Username and password are required" },
        { status: 400 },
      );
    }

    // Authenticate against BV-BRC
    const authUrl = getRequiredEnv("USER_AUTH_URL");
    const response = await fetch(authUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        username: credentials.username,
        password: credentials.password,
      }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { message: "Invalid credentials" },
        { status: 401 },
      );
    }

    const data = await response.text();
    const token = response.headers.get("Authorization") || data;
    const expiresAt = new Date(Date.now() + 3600 * 4 * 1000); // 4 hours from now
    const realm = extractRealmFromToken(token);

    // Fetch user profile from BV-BRC
    const userProfile = await getProfileMetadata(token, credentials.username);

    // Set BV-BRC authentication cookies
    await setBvbrcAuthCookies(token, credentials.username, realm, userProfile);

    // Return better-auth style response
    return NextResponse.json({
      user: {
        id: userProfile?.id || credentials.username,
        username: credentials.username,
        email: userProfile?.email || "",
        first_name: userProfile?.first_name || "",
        last_name: userProfile?.last_name || "",
        email_verified: userProfile?.email_verified || false,
        realm,
      },
      session: {
        token: "", // Token is in HTTP-only cookie
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Sign in error:", error);
    return NextResponse.json(
      { message: "Authentication service unavailable" },
      { status: 503 },
    );
  }
}
