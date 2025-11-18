import { NextRequest, NextResponse } from "next/server";
import { extractRealmFromToken } from "../storage";
import { setAuthCookies, getProfileMetadata } from "../utils";

export async function POST(request: NextRequest) {
  try {
    const credentials = await request.json();

    const response = await fetch("https://user.patricbrc.org/authenticate", {
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
      console.log("RESPONSE NOT OK", response);
      return NextResponse.json(
        { message: "Invalid credentials" },
        { status: 401 },
      );
    }

    const data = await response.text();
    const token = response.headers.get("Authorization") || data;
    const expires_at = Date.now() + 3600 * 1000; // 1 hour from now
    const realm = extractRealmFromToken(token);

    // Fetch user profile from BV-BRC
    const userProfile = await getProfileMetadata(token, credentials.username);

    // Set authentication cookies
    await setAuthCookies(token, credentials.username, realm, userProfile);

    // Return user data without sensitive information
    return NextResponse.json({
      username: credentials.username,
      realm: realm,
      expires_at: expires_at,
      success: true,
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { message: "Authentication service unavailable" },
      { status: 503 },
    );
  }
}
