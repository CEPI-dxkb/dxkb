import { NextRequest, NextResponse } from "next/server";

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

    console.log("RESPONSE", response);
    console.log("register??");

    const data = await response.text();
    const token = response.headers.get("Authorization") || data;

    return NextResponse.json({
      token,
      expires_at: 3600, // 1 hour
    });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { message: "Authentication service unavailable" },
      { status: 503 },
    );
  }
}
