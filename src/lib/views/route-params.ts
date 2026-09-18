import { safeDecode } from "@/lib/url";

/**
 * Recovering a real value from a Next dynamic route param.
 *
 * Next 16 delivers the same matched segment to different entry points in
 * different encodings, so no caller can treat `params.x` as "the value"
 * without declaring where it read it. For `/surveillance/sample%2F1`:
 *
 *   - The route matcher percent-decodes every matched param
 *     (`next/dist/shared/lib/router/utils/route-matcher.js`), so the
 *     interpolated param is `sample/1`.
 *   - **Page and layout components** read params built by `getDynamicParam()`
 *     (`next/dist/shared/lib/router/utils/get-dynamic-param.js`), whose
 *     `getParamValue()` does `value = encodeURIComponent(value)` — and
 *     `value.map((i) => encodeURIComponent(i))` for a catch-all — under the
 *     comment "The value that is passed to user code".
 *     `next/dist/server/app-render/create-component-tree.js` puts that
 *     RE-ENCODED value in `params`. Client pages get the same object through
 *     the RSC payload. So these receive `sample%2F1`.
 *   - **`generateMetadata`** builds its params from the interpolated params
 *     directly (`next/dist/lib/metadata/resolve-metadata.js`), so it receives
 *     the DECODED `sample/1`.
 *   - **Route handlers** (`next/dist/server/route-modules/app-route/`) never
 *     call `getDynamicParam`, so they receive the decoded value too. They do
 *     not need this helper — see `buildWorkspacePath` in
 *     `src/app/api/workspace/resolve-download.ts`.
 *   - **`searchParams`** are decoded consistently everywhere and never need
 *     this helper either — see `parseProteinStructureMode` in
 *     `src/lib/protein-structure-view/mode.ts`.
 *
 * Forwarding a page component's param without decoding sends a value one
 * encoding level too deep. That is what made every surveillance/serology
 * identifier containing a character `encodeURIComponent` escapes (`/`, space,
 * `%`, `#`, `&`, non-ASCII) resolve to `notFound()`: the wire clause became
 * `eq(sample_identifier,sample%252F1)` because `serializeValue` escaped the
 * `%` again. Decoding in *both* entry points is equally wrong in the other
 * direction — it turns a request for the literal identifier `sample%2F1`
 * into a request for `sample/1`.
 *
 * This is framework-internal behaviour a Next upgrade could change under us.
 * The guards are `src/lib/views/__tests__/route-params.test.ts` and the
 * per-route page tests, which feed each entry point the encoding Next
 * actually gives it.
 */

/** Which entry point read `params`. See this module's header. */
export type RouteParamSource = "page" | "metadata";

/**
 * The real value behind a dynamic route param, given where it was read.
 *
 * No default for `source`: a default would silently give the wrong answer to
 * whichever caller forgot to think about it, which is exactly how the
 * compound-sample 404 survived review.
 */
export function readRouteParam(
  value: string,
  source: RouteParamSource,
): string {
  if (source === "metadata") return value;
  // Malformed values are unreachable for real requests because Next supplies
  // `encodeURIComponent` output, but keeping one verbatim avoids a route 500.
  return safeDecode(value);
}

/** Catch-all form of {@link readRouteParam}; `getParamValue` encodes per segment. */
export function readRouteParamSegments(
  values: readonly string[],
  source: RouteParamSource,
): string[] {
  return values.map((value) => readRouteParam(value, source));
}
