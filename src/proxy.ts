import { NextRequest, NextResponse } from "next/server";
import { safeDecodeURIComponent } from "./lib/auth";

export function proxy(request: NextRequest) {
  // For API routes that need auth, check for auth cookies
  if (request.nextUrl.pathname.startsWith("/api/protected/")) {
    const rawAuthToken = request.cookies.get("token")?.value;
    const authToken = rawAuthToken
      ? safeDecodeURIComponent(rawAuthToken)
      : undefined;
    const userId = request.cookies.get("user_id")?.value;

    if (!authToken || !userId) {
      return NextResponse.json(
        { message: "Authentication required" },
        { status: 401 },
      );
    }

    // Add auth info to headers for API routes to use
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-auth-token", authToken);
    requestHeaders.set("x-user-id", userId);

    const realm = request.cookies.get("realm")?.value;
    if (realm) {
      requestHeaders.set("x-realm", realm);
    }

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // For protected pages, redirect to login if not authenticated
  if (
    (request.nextUrl.pathname.startsWith("/services/") &&
      request.nextUrl.pathname !== "/services") ||
    request.nextUrl.pathname.startsWith("/workspace")
  ) {
    const authToken = request.cookies.get("token")?.value;

    if (!authToken) {
      // Create login URL with redirect parameter to preserve the original destination
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/protected/:path*", "/services/:path*", "/workspace/:path*"],
};
