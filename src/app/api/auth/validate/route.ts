import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("Authorization");

    if (!token) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }

    // Try to make a simple API call to validate token
    const response = await fetch("https://patricbrc.org/api/genome/?limit(1)", {
      headers: {
        Authorization: token,
      },
    });

    return NextResponse.json({ valid: response.ok });
  } catch (error) {
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}
