import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  console.log("USER INFO ROUTE");
  try {
    const token = request.headers.get("Authorization");

    if (!token) {
      return NextResponse.json({ error: "No token provided" }, { status: 401 });
    }

    // Extract username from token or get from query params
    let username = request.nextUrl.searchParams.get("username");

    if (!username) {
      // Try to extract from token if not provided in query
      // This is a fallback - ideally username should be passed as query param
      return NextResponse.json(
        { error: "Username not provided" },
        { status: 400 },
      );
    }

    // Fetch user metadata from BV-BRC
    const response = await fetch(
      `https://user.patricbrc.org/user/${username}`,
      {
        headers: {
          Authorization: token,
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch user info" },
        { status: response.status },
      );
    }

    const userData = await response.json();

    return NextResponse.json(userData);
  } catch (error) {
    console.error("Error fetching user info:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
