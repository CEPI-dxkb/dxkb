import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("Authorization");

    if (!token) {
      return NextResponse.json(
        { message: "No token provided" },
        { status: 401 },
      );
    }

    const response = await fetch(
      "https://user.patricbrc.org/authenticate/refresh",
      {
        headers: {
          Authorization: token,
        },
      },
    );

    if (!response.ok) {
      return NextResponse.json(
        { message: "Token refresh failed" },
        { status: 401 },
      );
    }

    const newToken = response.headers.get("Authorization");

    return NextResponse.json({
      token: newToken,
      expires_at: 3600,
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    return NextResponse.json(
      { message: "Token refresh service unavailable" },
      { status: 503 },
    );
  }
}
