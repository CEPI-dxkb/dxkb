import { NextRequest, NextResponse } from "next/server";
import { isProtectedPagePath, isProtectedApiPath } from "@/lib/auth/routes";

/**
 * Check if user has BV-BRC session cookies.
 * Cookie existence only — full validation happens in API routes via getAuthToken().
 */
function hasBvbrcSession(request: NextRequest): boolean {
  const token = request.cookies.get("bvbrc_token")?.value;
  const userId = request.cookies.get("bvbrc_user_id")?.value;
  return Boolean(token && userId);
}

/**
 * Next.js Proxy for authentication checks (better-auth stateless pattern).
 * Optimistic cookie-existence checks only — validation happens server-side.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isProtectedApiPath(pathname)) {
    if (!hasBvbrcSession(request)) {
      return NextResponse.json(
        { message: "Authentication required" },
        { status: 401 },
      );
    }
    return NextResponse.next();
  }

  if (isProtectedPagePath(pathname)) {
    if (!hasBvbrcSession(request)) {
      const signInUrl = new URL("/sign-in", request.url);
      signInUrl.searchParams.set("redirect", pathname + search);
      return NextResponse.redirect(signInUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/protected/:path*", "/services/:path*", "/workspace/:path*", "/jobs/:path*"],
};
