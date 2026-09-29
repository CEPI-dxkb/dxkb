/**
 * Safely decode a URI component, returning the original string
 * if it contains malformed percent-encoded sequences.
 */
export function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Escapes `encodeURIComponent` produces that RFC 3986 allows literally in a
 * query name or value. `&`, `=`, `+`, `#` and `%` are absent on purpose: they
 * are query syntax and must stay escaped.
 */
const queryLiterals: ReadonlyMap<string, string> = new Map([
  ["%24", "$"],
  ["%2C", ","],
  ["%2F", "/"],
  ["%3A", ":"],
  ["%3B", ";"],
  ["%3F", "?"],
  ["%40", "@"],
]);

/**
 * Escapes `encodeURIComponent` produces that RFC 3986 allows literally in a
 * path segment. `/`, `?`, `#` and `%` are absent on purpose.
 */
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

/**
 * Replace allowed escapes with their literal character. The scan walks whole
 * `%XX` tokens left to right, so an escaped percent (`%25`) followed by `2C`
 * is never mistaken for `%2C`.
 */
function restoreLiterals(
  encoded: string,
  literals: ReadonlyMap<string, string>,
): string {
  return encoded.replace(
    /%[0-9A-F]{2}/g,
    (escape) => literals.get(escape) ?? escape,
  );
}

/**
 * Encode one query name or value, leaving RFC 3986-legal characters readable
 * (`eq(public,false)`, `/workspace/a@b.org`). Space becomes `+`, as in
 * `URLSearchParams`. `'` is escaped because the WHATWG URL parser escapes it in
 * queries anyway, so this output matches what `new URL()` and browsers show.
 * A lone surrogate becomes U+FFFD, as in `URLSearchParams`, instead of making
 * `encodeURIComponent` throw.
 */
export function encodeQueryComponent(value: string): string {
  return restoreLiterals(encodeURIComponent(value.toWellFormed()), queryLiterals)
    .replace(/%20/g, "+")
    .replace(/'/g, "%27");
}

/**
 * Encode one path segment, leaving RFC 3986-legal characters readable.
 *
 * Only for a segment that follows a literal `/` (`/genome/${…}`). `:` stays
 * literal, so as the first segment of a relative reference the output could
 * read as a scheme (`javascript:…`); template substitution that can place a
 * value first keeps `encodeURIComponent`.
 */
export function encodePathSegment(value: string): string {
  return restoreLiterals(encodeURIComponent(value.toWellFormed()), pathLiterals);
}

/**
 * Serialize search params readably. Use instead of `URLSearchParams#toString()`
 * for any URL a user sees; `toString()` escapes `( ) , / : @` as well.
 */
export function toQueryString(params: URLSearchParams): string {
  return [...params]
    .map(
      ([name, value]) =>
        `${encodeQueryComponent(name)}=${encodeQueryComponent(value)}`,
    )
    .join("&");
}
