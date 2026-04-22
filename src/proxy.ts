import { NextRequest, NextResponse } from "next/server";
import { isProtectedPagePath, isProtectedApiPath } from "@/lib/auth/routes";
import { hasSession } from "@/lib/auth/server/middleware";

/**
 * Next.js Proxy for authentication checks (better-auth stateless pattern).
 * Optimistic cookie-existence checks only — validation happens server-side.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isProtectedApiPath(pathname)) {
    if (!hasSession(request)) {
      return NextResponse.json(
        { message: "Authentication required" },
        { status: 401 },
      );
    }
    return NextResponse.next();
  }

  if (isProtectedPagePath(pathname)) {
    if (!hasSession(request)) {
      const signInUrl = new URL("/sign-in", request.url);
      signInUrl.searchParams.set("redirect", pathname + search);
      return NextResponse.redirect(signInUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/protected/:path*", "/services/:path*", "/workspace/:path*", "/jobs/:path*", "/settings/:path*", "/viewer/:path*"],
};
