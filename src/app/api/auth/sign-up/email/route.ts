import { NextRequest, NextResponse } from "next/server";
import { createSession, extractRealmFromToken } from "@/lib/auth/session";
import { fetchUserProfile } from "@/lib/auth/profile";
import { getRequiredEnv } from "@/lib/env";

/**
 * Sign up with email and password (better-auth style endpoint)
 * POST /api/auth/sign-up/email
 */
export async function POST(request: NextRequest) {
  try {
    const credentials = await request.json();

    // Validate required fields
    if (!credentials.username || !credentials.email || !credentials.password) {
      return NextResponse.json(
        { message: "Username, email, and password are required" },
        { status: 400 },
      );
    }

    if (credentials.password !== credentials.password_repeat) {
      return NextResponse.json(
        { message: "Passwords do not match" },
        { status: 400 },
      );
    }

    // Register with BV-BRC
    const registerUrl = getRequiredEnv("USER_REGISTER_URL");
    const response = await fetch(registerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        first_name: credentials.first_name || "",
        middle_name: credentials.middle_name || "",
        last_name: credentials.last_name || "",
        username: credentials.username,
        email: credentials.email,
        affiliation: credentials.affiliation || "",
        organisms: credentials.organisms || "",
        interests: credentials.interests || "",
        password: credentials.password,
        password_repeat: credentials.password_repeat,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      let errorMessage = "Registration failed";
      try {
        const parsedError = JSON.parse(errorData);
        errorMessage = parsedError.message || errorMessage;
      } catch {
        errorMessage = errorData || errorMessage;
      }

      return NextResponse.json(
        { message: errorMessage },
        { status: response.status },
      );
    }

    const data = await response.text();
    const token = response.headers.get("Authorization") || data;
    if (!token) {
      return NextResponse.json(
        { message: "Registration failed: missing auth token" },
        { status: 502 },
      );
    }

    const expiresAt = new Date(Date.now() + 3600 * 4 * 1000); // 4 hours from now
    const realm = extractRealmFromToken(token);

    // Fetch user profile from BV-BRC
    const userProfile = await fetchUserProfile(credentials.username, token);

    // Set BV-BRC authentication cookies
    await createSession(token, credentials.username, realm, userProfile ?? undefined);

    // Return better-auth style response
    return NextResponse.json({
      user: {
        id: userProfile?.id || credentials.username,
        username: credentials.username,
        email: credentials.email,
        first_name: credentials.first_name || "",
        last_name: credentials.last_name || "",
        email_verified: false,
        realm,
      },
      session: {
        token: "", // Token is in HTTP-only cookie
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Sign up error:", error);
    return NextResponse.json(
      { message: "Registration service unavailable" },
      { status: 503 },
    );
  }
}
