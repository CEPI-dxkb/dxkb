import { NextRequest, NextResponse } from "next/server";

/**
 * Check if user has BV-BRC session cookie
 * Similar to better-auth's getSessionCookie but for BV-BRC auth
 * 
 * NOTE: This only checks for cookie existence, not validity.
 * Full validation happens in API routes using getBvbrcAuthToken().
 */
function hasBvbrcSession(request: NextRequest): boolean {
  const token = request.cookies.get("bvbrc_token")?.value;
  const userId = request.cookies.get("bvbrc_user_id")?.value;
  return Boolean(token && userId);
}

/**
 * Next.js Proxy/Middleware for authentication checks
 * Following better-auth's recommended patterns for Next.js
 * 
 * IMPORTANT: Cookie existence checks only - validation happens server-side
 * This is the recommended approach per better-auth docs to avoid blocking requests
 */
export function proxy(request: NextRequest) {
  // For API routes that need auth, check for BV-BRC auth cookies
  if (request.nextUrl.pathname.startsWith("/api/protected/")) {
    if (!hasBvbrcSession(request)) {
      return NextResponse.json(
        { message: "Authentication required" },
        { status: 401 },
      );
    }

    // Let the request through - API routes will validate and get tokens via getBvbrcAuthToken()
    return NextResponse.next();
  }

  // For protected pages, redirect to sign-in if not authenticated
  if (
    (request.nextUrl.pathname.startsWith("/services/") &&
      request.nextUrl.pathname !== "/services") ||
    request.nextUrl.pathname.startsWith("/workspace")
  ) {
    if (!hasBvbrcSession(request)) {
      // Redirect to sign-in page with return URL (path + query so deep links retain params)
      const signInUrl = new URL("/sign-in", request.url);
      signInUrl.searchParams.set(
        "redirect",
        request.nextUrl.pathname + request.nextUrl.search,
      );
      return NextResponse.redirect(signInUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/protected/:path*", "/services/:path*", "/workspace/:path*"],
};
