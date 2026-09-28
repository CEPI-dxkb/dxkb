import { legacyViewTargets } from "./view-registry";

export interface MappedPath {
  pathname: string;
  search: string;
}

/** Comparison operators whose first argument is a field name. */
const rqlFieldOperators = ["eq", "ne", "lt", "le", "gt", "ge", "in"] as const;
const fieldArgumentPattern = new RegExp(
  `(?:^|[(,])(?:${rqlFieldOperators.join("|")})\\($`,
);
/** Legacy sort keys carry a direction prefix, e.g. `sort(+field,-other)`. */
const sortKeyPattern = /[(,][+-]$/;

/**
 * True when the token starting at `index` is the field argument of a comparison
 * operator, or a legacy sort key. Adjacent delimiters alone cannot tell those apart
 * from a value: `(` and `,` equally precede fields, scalar values and list members,
 * so `keyword(taxon_lineage_ids)` and `eq(taxon_name,taxon_lineage_ids)` must be
 * left alone.
 */
function isFieldPosition(rql: string, index: number): boolean {
  const before = rql.slice(0, index);
  return sortKeyPattern.test(before) || fieldArgumentPattern.test(before);
}

/**
 * Rename an RQL field, matching only where the token sits in field position and
 * outside a quoted value. A blunt replaceAll over the assembled RQL would also
 * rewrite the token inside values, turning eq(description,%22taxon_lineage_ids%22)
 * into a different query. Legacy query strings arrive raw, so quotes appear as
 * either " or %22.
 */
function renameRqlField(rql: string, from: string, to: string): string {
  let result = "";
  let index = 0;
  let quote: '"' | "%22" | null = null;
  while (index < rql.length) {
    if (quote) {
      if (rql.startsWith(quote, index)) {
        result += quote;
        index += quote.length;
        quote = null;
      } else {
        result += rql[index];
        index += 1;
      }
      continue;
    }
    if (rql[index] === '"' || rql.startsWith("%22", index)) {
      quote = rql[index] === '"' ? '"' : "%22";
      result += quote;
      index += quote.length;
      continue;
    }
    const nextIndex = index + from.length;
    if (
      rql.startsWith(from, index) &&
      nextIndex < rql.length &&
      ",)".includes(rql[nextIndex]) &&
      isFieldPosition(rql, index)
    ) {
      result += to;
      index += from.length;
      continue;
    }
    result += rql[index];
    index += 1;
  }
  return result;
}

/** A query key that can name a legacy parameter such as `keyword` or `filter`. */
const namedParamPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Rebuild the raw legacy query string `mapLegacyViewPath` expects from parsed
 * search params.
 *
 * The proxy never sees the raw query. Next.js parses it and re-serializes it
 * form-encoded before the proxy runs (`runMiddleware` in next-server), so
 * `?eq(genome_status,Complete)` arrives as `?eq%28genome_status%2CComplete%29=`,
 * and encoding that string again double-encodes the RQL. The parsed pairs are
 * still faithful: a raw RQL fragment becomes a key with an empty value, split
 * at its first `=` if it has one. `%` and `&` are re-escaped so the mapper's
 * `&` split and the RQL parser's per-value `decodeURIComponent` read the
 * original text.
 *
 * Next's decode loses two distinctions that cannot be restored here: an
 * unquoted `%2C` inside a value becomes a structural comma, and `+` becomes a
 * space. A bare identifier (`?foo`) is read as a named parameter.
 */
export function legacySearchFromParams(params: URLSearchParams): string {
  const parts: string[] = [];
  for (const [key, value] of params) {
    if (namedParamPattern.test(key)) {
      parts.push(new URLSearchParams([[key, value]]).toString());
      continue;
    }
    const rql = value ? `${key}=${value}` : key;
    parts.push(rql.replaceAll("%", "%25").replaceAll("&", "%26"));
  }
  return parts.join("&");
}

/**
 * Map a legacy BV-BRC /view/* request (path + raw query string, no leading "?")
 * to the new schema. Returns null if the path is not a mappable /view/* URL.
 * Hash is intentionally NOT handled here (the server cannot read it). The proxy
 * builds `rawSearch` with `legacySearchFromParams`.
 */
export function mapLegacyViewPath(
  pathname: string,
  rawSearch: string,
): MappedPath | null {
  const parts = pathname.split("/").filter(Boolean); // ["view", "Genome", "59201.7581"]
  if (parts.length < 2 || parts[0] !== "view") return null;

  const legacyName = parts[1];
  const target = legacyViewTargets[legacyName];
  if (!target) return null;

  const { segment } = target;
  const idParts = parts.slice(2); // remaining path segments after the view name
  const isList = target.kind === "list";

  if (isList || idParts.length === 0) {
    // List view: the legacy raw query string may be raw RQL, named params, or a mix
    // (e.g. "eq(genome_id,83332.12)&filter=%22CDS%22"). Split on & and classify each
    // segment individually so named params like filter= are not swallowed into rql=.
    if (!rawSearch && !target.defaultParams) {
      return { pathname: `/${segment}`, search: "" };
    }
    const rqlParts: string[] = [];
    const namedParts: string[] = [];
    for (const seg of rawSearch.split("&")) {
      if (!seg) continue;
      if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(seg)) {
        namedParts.push(seg);
      } else {
        rqlParts.push(seg);
      }
    }
    const searchParts: string[] = [];
    if (rqlParts.length > 0) {
      // TaxonList historically used the Genome lineage field name even though the
      // Taxonomy endpoint exposes the same relationship as `lineage_ids`.
      const joined = rqlParts.join("&");
      const rql =
        segment === "taxonomy"
          ? renameRqlField(joined, "taxon_lineage_ids", "lineage_ids")
          : joined;
      searchParts.push(`rql=${encodeURIComponent(rql)}`);
    }
    const namedParams = new URLSearchParams(namedParts.join("&"));
    for (const [name, value] of Object.entries(target.defaultParams ?? {})) {
      if (!namedParams.has(name)) namedParams.set(name, value);
    }
    if (namedParams.size > 0) searchParts.push(namedParams.toString());
    return { pathname: `/${segment}`, search: searchParts.join("&") };
  }

  // Singular view: keep the id in the path, preserve named query params verbatim.
  let id: string;
  try {
    id = idParts
      .map((part) => encodeURIComponent(decodeURIComponent(part)))
      .join("%2F");
  } catch {
    return null;
  }
  const search = rawSearch ? new URLSearchParams(rawSearch).toString() : "";
  return { pathname: `/${segment}/${id}`, search };
}
