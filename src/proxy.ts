import { NextRequest, NextResponse } from "next/server";
import {
  isProtectedPagePath,
  protectedPageRequestHeader,
} from "@/lib/auth/routes";
import { hasSessionCookies } from "@/lib/auth/server/cookies";
import { encodeQueryComponent, toQueryString } from "@/lib/url";
import {
  legacySearchFromParams,
  mapLegacyViewPath,
} from "@/lib/views/legacy-redirect";
import { viewSegments } from "@/lib/views/view-registry";

/**
 * Next.js Proxy for optimistic page authentication checks.
 * Cookie validation remains server-side.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // 1. Legacy /view/* → new schema (path + query only; hash handled client-side).
  if (pathname.startsWith("/view/")) {
    const mapped = mapLegacyViewPath(
      pathname,
      legacySearchFromParams(request.nextUrl.searchParams),
    );
    if (mapped) {
      const url = new URL(mapped.pathname, request.url);
      url.search = mapped.search;
      return NextResponse.redirect(url, 308);
    }
  }

  // 2. Internal ?view= → ?tab= on (views) routes.
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  if (firstSegment && viewSegments.includes(firstSegment)) {
    const viewValue = request.nextUrl.searchParams.get("view");
    if (viewValue !== null) {
      const params = new URLSearchParams(request.nextUrl.searchParams);
      params.delete("view");
      params.set("tab", viewValue);
      return NextResponse.redirect(
        new URL(`${pathname}?${toQueryString(params)}`, request.url),
        308,
      );
    }
  }

  if (isProtectedPagePath(pathname)) {
    const requestPath = search
      ? `${pathname}?${toQueryString(request.nextUrl.searchParams)}`
      : pathname;
    if (!hasSessionCookies(request)) {
      return NextResponse.redirect(
        new URL(
          `/sign-in?redirect=${encodeQueryComponent(requestPath)}`,
          request.url,
        ),
      );
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(protectedPageRequestHeader, requestPath);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  return NextResponse.next();
}

// NOTE: the view segment paths below mirror `viewSegments` in view-registry.ts.
// Next.js requires a statically analyzable matcher literal — it cannot be computed
// from viewSegments at runtime, so the list is intentionally duplicated here.
export const config = {
  matcher: [
    "/services/:path*",
    "/workspace/:path*",
    "/jobs/:path*",
    "/settings/:path*",
    "/viewer/:path*",
    "/view/:path*",
    "/taxonomy/:path*",
    "/genome/:path*",
    "/feature/:path*",
    "/epitope/:path*",
    "/surveillance/:path*",
    "/serology/:path*",
    "/strain/:path*",
    "/domains-and-motifs/:path*",
    "/protein-structure/:path*",
    "/experiment/:path*",
  ],
};
