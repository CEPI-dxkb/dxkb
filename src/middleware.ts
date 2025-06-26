import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  // For API routes that need auth, check for Authorization header
  if (request.nextUrl.pathname.startsWith("/api/protected/")) {
    const authHeader = request.headers.get("Authorization");

    if (!authHeader) {
      return NextResponse.json(
        { message: "Authentication required" },
        { status: 401 },
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/protected/:path*"],
};
