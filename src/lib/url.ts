export function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Escapes RFC 3986 allows literally in a query; `& = + # %` stay escaped as query syntax. */
const queryLiterals: ReadonlyMap<string, string> = new Map([
  ["%24", "$"],
  ["%2C", ","],
  ["%2F", "/"],
  ["%3A", ":"],
  ["%3B", ";"],
  ["%3F", "?"],
  ["%40", "@"],
]);

/** Escapes RFC 3986 allows literally in a path segment; `/ ? # %` stay escaped. */
const pathLiterals: ReadonlyMap<string, string> = new Map([
  ["%24", "$"],
  ["%26", "&"],
  ["%2B", "+"],
  ["%2C", ","],
  ["%3A", ":"],
  ["%3B", ";"],
  ["%3D", "="],
  ["%40", "@"],
]);

/** Walks whole `%XX` tokens so `%25` followed by `2C` is never read as `%2C`. */
function restoreLiterals(
  encoded: string,
  literals: ReadonlyMap<string, string>,
): string {
  return encoded.replace(
    /%[0-9A-F]{2}/g,
    (escape) => literals.get(escape) ?? escape,
  );
}

/** Encodes one query name or value readably; space becomes `+` and `'` is escaped as in `URLSearchParams`, and a lone surrogate becomes U+FFFD instead of throwing. */
export function encodeQueryComponent(value: string): string {
  return restoreLiterals(encodeURIComponent(value.toWellFormed()), queryLiterals)
    .replace(/%20/g, "+")
    .replace(/'/g, "%27");
}

/** Only for a segment after a literal `/`: `:` stays literal, so a leading segment could read as a scheme (`javascript:…`). */
export function encodePathSegment(value: string): string {
  return restoreLiterals(encodeURIComponent(value.toWellFormed()), pathLiterals);
}

/** Readable replacement for `URLSearchParams#toString()` on user-visible URLs, which escapes `( ) , / : @`. */
export function toQueryString(params: URLSearchParams): string {
  return [...params]
    .map(
      ([name, value]) =>
        `${encodeQueryComponent(name)}=${encodeQueryComponent(value)}`,
    )
    .join("&");
}

/** Rewrites the current URL's query with `replaceState` (no history entry); browser only. */
export function replaceQuery(apply: (params: URLSearchParams) => void): void {
  const { pathname, search, hash } = window.location;
  // A separate URLSearchParams: mutating url.searchParams re-escapes the query.
  const params = new URLSearchParams(search);
  apply(params);
  const query = toQueryString(params);
  const next = `${pathname}${query ? `?${query}` : ""}${hash}`;
  if (next !== `${pathname}${search}${hash}`) {
    window.history.replaceState(null, "", next);
  }
}
