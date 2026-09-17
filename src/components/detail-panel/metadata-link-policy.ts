/**
 * The pure half of the metadata-link boundary: href classification and
 * `{placeholder}` template resolution, with no JSX and no React import.
 *
 * Rendering lives in the sibling `./metadata-link` module. Both halves exist so
 * every metadata-driven link surface — the detail panel's scalar, array and
 * button fields, and the entity overviews under `src/app/(views)/` — shares one
 * security and routing decision instead of each re-deriving a scheme check.
 */

/** Three-way outcome of {@link classifyHref}. */
export type HrefClassification = "internal" | "external" | "unsafe";

/**
 * The one shared security and routing boundary for every metadata-driven link.
 * Any new link surface must route through this rather than reinventing its own
 * scheme check.
 *
 * - `"internal"` — an unambiguous same-origin path. Requires `startsWith("/")`
 *   *and* excludes a protocol-relative `//host` string: a browser resolves
 *   `//host` as an absolute, cross-origin URL despite the missing scheme, so a
 *   bare `startsWith("/")` check would misclassify it as same-origin and hand
 *   it to `Link`.
 * - `"external"` — an absolute `http(s)` URL, the only scheme this boundary
 *   opens safely, in a new `noopener`-isolated tab.
 * - `"unsafe"` — anything else: a bare `//host`, a non-http(s) scheme
 *   (`javascript:`, `mailto:`, `data:`, ...), or a string that is neither a
 *   path nor a URL. No current `DataField.link` template can reach this today
 *   — every scheme-bearing prefix is a developer-authored literal, and
 *   {@link resolveLink} always `encodeURIComponent`s the row-supplied
 *   `{placeholder}` segments, so row data cannot inject a `//` or
 *   `javascript:` prefix — but that is a property of today's data, not of this
 *   contract, so it must not guess. **Rendering nothing is the deliberate
 *   choice for `"unsafe"`**: an unclassified anchor (no `target`, no `rel`
 *   isolation, and — worse — a scheme a browser might execute) is strictly
 *   more dangerous than no anchor.
 */
export function classifyHref(href: string): HrefClassification {
  if (/^https?:\/\//i.test(href)) return "external";
  if (href.startsWith("/") && !href.startsWith("//")) return "internal";
  return "unsafe";
}

/** Whether a raw row value can be substituted into a link template. */
export function isLinkValue(
  value: unknown,
): value is string | number | boolean {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

/**
 * Fill a `{placeholder}` template from the row. `{value}` is a sentinel that never
 * matches a real row key, so it always falls through to the field's own value;
 * `{genome_id}`-style placeholders match a real row field directly (row-aware).
 *
 * Returns `undefined` — rejecting the link — when any placeholder has no resolvable
 * primitive value, rather than emitting a URL with a missing or literal `{...}` segment.
 */
export function resolveLink(
  template: string,
  row: Record<string, unknown>,
  fallbackField: string,
): string | undefined {
  const resolvedSegments = new Map<string, string>();
  for (const [, key] of template.matchAll(/{([^}]+)}/g)) {
    if (resolvedSegments.has(key)) continue;
    const value = row[key] ?? row[fallbackField];
    const primitive = isLinkValue(value) ? value : undefined;
    if (primitive === undefined || String(primitive) === "") return undefined;
    resolvedSegments.set(key, encodeURIComponent(String(primitive)));
  }
  return template.replace(
    /{([^}]+)}/g,
    (_, key: string) => resolvedSegments.get(key) ?? "",
  );
}
