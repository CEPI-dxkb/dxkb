import { safeDecode } from "@/lib/url";

/**
 * Next 16 gives page and layout components the RE-ENCODED param (`sample%2F1`,
 * via `getDynamicParam()`) but `generateMetadata` and route handlers the
 * DECODED one (`sample/1`).
 * Forwarding a page param undecoded double-encodes it and 404s identifiers with
 * escaped characters, while decoding in both entry points is wrong the other
 * way; `route-params.test.ts` guards this framework-internal behaviour.
 */

export type RouteParamSource = "page" | "metadata";

/**
 * No default for `source`: a default would silently give the wrong answer to a
 * caller that forgot to think about it.
 */
export function readRouteParam(
  value: string,
  source: RouteParamSource,
): string {
  if (source === "metadata") return value;
  // Next supplies `encodeURIComponent` output, so a malformed value is
  // unreachable; keeping one verbatim avoids a route 500.
  return safeDecode(value);
}

export function readRouteParamSegments(
  values: readonly string[],
  source: RouteParamSource,
): string[] {
  return values.map((value) => readRouteParam(value, source));
}
