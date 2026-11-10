export const metadataLinkClassName =
  "text-primary underline hover:text-primary/80 dark:text-link dark:hover:text-foreground";

export type HrefClassification = "internal" | "external" | "unsafe";

/**
 * `internal` rejects `//host` and `/\\host` (browsers resolve them
 * cross-origin); `unsafe` renders nothing rather than an anchor without
 * `target`/`rel` isolation.
 */
export function classifyHref(href: string): HrefClassification {
  if (/^https?:\/\//i.test(href)) return "external";
  if (href.startsWith("/") && href[1] !== "/" && href[1] !== "\\") {
    return "internal";
  }
  return "unsafe";
}

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
 * `{value}` falls through to the field's own value; returns `undefined` when
 * any placeholder has no primitive value.
 */
export function resolveLink(
  template: string,
  row: Record<string, unknown>,
  fallbackField: string,
): string | undefined {
  const resolvedSegments = new Map<string, string>();
  for (const [, key] of template.matchAll(/{([^}]+)}/g)) {
    if (resolvedSegments.has(key)) continue;
    const value = key === "value" ? row[fallbackField] : row[key];
    const primitive = isLinkValue(value) ? value : undefined;
    if (primitive === undefined || String(primitive) === "") return undefined;
    resolvedSegments.set(key, encodeURIComponent(String(primitive)));
  }
  // Every segment is `encodeURIComponent` output, so it cannot form a
  // placeholder for a later pass to substitute.
  let resolved = template;
  for (const [key, segment] of resolvedSegments) {
    resolved = resolved.replaceAll(`{${key}}`, () => segment);
  }
  return resolved;
}
