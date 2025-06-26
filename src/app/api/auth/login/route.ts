import { NextRequest, NextResponse } from "next/server";

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

    console.log("RESPONSE", response);
    console.log("login??");

    const data = await response.text();
    const token = response.headers.get("Authorization") || data;

    return NextResponse.json({
      token,
      expires_at: 3600, // 1 hour
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { message: "Authentication service unavailable" },
      { status: 503 },
    );
  }
}
