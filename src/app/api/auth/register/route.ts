import { NextRequest, NextResponse } from "next/server";
import { extractRealmFromToken } from "../storage";
import { setAuthCookies, getProfileMetadata } from "../utils";

export async function POST(request: NextRequest) {
  try {
    const credentials = await request.json();

    const response = await fetch("https://user.patricbrc.org/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        first_name: credentials.first_name,
        middle_name: credentials.middle_name || "",
        last_name: credentials.last_name,
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
      console.log("REGISTER RESPONSE NOT OK", response.status, errorData);

      // Try to parse the error data as JSON to extract the actual message
      let errorMessage = "Registration failed";
      try {
        const parsedError = JSON.parse(errorData);
        errorMessage = parsedError.message || errorMessage;
      } catch {
        // If it's not JSON, use the raw text
        errorMessage = errorData || errorMessage;
      }

      return NextResponse.json(
        { message: errorMessage },
        { status: response.status },
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
      email: credentials.email,
      first_name: credentials.first_name,
      last_name: credentials.last_name,
      realm: realm,
      expires_at: expires_at,
      success: true,
    });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { message: "Authentication service unavailable" },
      { status: 503 },
    );
  }
}
