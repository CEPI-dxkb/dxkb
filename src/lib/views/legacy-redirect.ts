import {
  encodePathSegment,
  encodeQueryComponent,
  safeDecode,
  toQueryString,
} from "@/lib/url";
import {
  keywordQuery,
  keywordQueryClauses,
  keywordTerms,
} from "@/lib/data-api/keyword-terms";
import { escapeRqlValue, rqlAnd } from "./rql";
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

/** RQL operators the Data API parser accepts with exactly this many arguments. */
const fixedArityOperators: Readonly<Record<string, number>> = {
  eq: 2,
  ne: 2,
  lt: 2,
  le: 2,
  gt: 2,
  ge: 2,
  keyword: 1,
};

interface RqlCall {
  arity: number | undefined;
  commas: number;
}

/**
 * Re-escape commas that Next's decode turned from a value's `%2C` into what
 * reads as an argument separator. A fixed-arity call takes only so many
 * arguments, so a comma past its last separator cannot be structural: the
 * destination parser would reject the extra argument. Escaping it restores the
 * value, and a comma already inside a value decodes to the same text either
 * way. Quoted text (the parser keeps its commas) and the commas of `and`, `or`,
 * `not` and `in` lists are left alone.
 */
function escapeValueCommas(rql: string): string {
  const calls: RqlCall[] = [];
  let result = "";
  let name = "";
  let quoted = false;
  let escaped = false;
  for (const char of rql) {
    if (escaped) escaped = false;
    else if (char === "\\" && quoted) escaped = true;
    else if (char === '"') quoted = !quoted;
    else if (!quoted && char === "(") {
      calls.push({
        arity: Object.hasOwn(fixedArityOperators, name)
          ? fixedArityOperators[name]
          : undefined,
        commas: 0,
      });
    } else if (!quoted && char === ")") calls.pop();
    else if (!quoted && char === ",") {
      const call = calls.length > 0 ? calls[calls.length - 1] : undefined;
      if (call?.arity !== undefined && call.commas >= call.arity - 1) {
        result += "%2C";
        name = "";
        continue;
      }
      if (call) call.commas += 1;
    }
    name = /[a-z_]/.test(char) ? name + char : "";
    result += char;
  }
  return result;
}

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
 * Next's decode also turns an unquoted `%2C` inside a value into a comma.
 * `escapeValueCommas` restores it wherever the operator's arity proves the
 * comma belongs to a value (`eq(genome_name,foo%2Cbar)`); inside an `in` list
 * the two readings are both valid, so `in(genome_id,(a,b%2Cc))` still arrives
 * as three members. `+` becomes a space, an encoded parenthesis becomes a
 * structural one, and a bare identifier (`?foo`) is read as a named parameter.
 */
export function legacySearchFromParams(params: URLSearchParams): string {
  const parts: string[] = [];
  for (const [key, value] of params) {
    if (namedParamPattern.test(key)) {
      parts.push(new URLSearchParams([[key, value]]).toString());
      continue;
    }
    const rql = value ? `${key}=${value}` : key;
    parts.push(
      escapeValueCommas(rql.replaceAll("%", "%25").replaceAll("&", "%26")),
    );
  }
  return parts.join("&");
}

/**
 * Lists whose `?keyword=` reproduces legacy's keyword query: the Feature list
 * then applies its PATRIC default, and the Genome list's related tabs run the
 * keyword on their own collections, as legacy's do. As `?rql=` neither would.
 */
const legacyKeywordSegments: ReadonlySet<string> = new Set(["feature", "genome"]);
const keywordCallPattern = /^keyword\(([^()]*)\)$/;
/** Legacy's search box form for several words: `and(keyword(a),keyword(b))`. */
const keywordAndPattern = /^and\(keyword\([^()]*\)(?:,keyword\([^()]*\))+\)$/;
const legacySortPattern = /^sort\([^()]*\)$/;
/**
 * Solr syntax that works inside one `keyword(...)` but that `?keyword=` reads
 * as a space (`keywordQuery`): a boost (`keyword(coli^2)` is coli's 134,274
 * genomes, coli and 2 ANDed 130,072), a range (`keyword(<coli)`: 129) and a
 * regular expression (`keyword(/col/)`: 3,382). The rest of that syntax is an
 * HTTP 400 as written (`keyword(GO:0003677)`), or Solr splits a word at it
 * anyway (`keyword(coli-K12)` and the parts ANDed are both 1,666 genomes).
 */
const workingSolrSyntaxPattern = /[\^<>]|(?:^|\s)\//;

/**
 * The `keyword(...)` values of one legacy RQL part that is a lone keyword or
 * legacy's search-box `and` of keywords, decoded; undefined for any other part.
 */
function keywordCallValues(part: string): string[] | undefined {
  const lone = keywordCallPattern.exec(part);
  if (lone) return [safeDecode(lone[1]).trim()];
  if (!keywordAndPattern.test(part)) return undefined;
  return [...part.matchAll(/keyword\(([^()]*)\)/g)].map((match) =>
    safeDecode(match[1]).trim(),
  );
}

/**
 * Whether `?keyword=<value>` sends what one legacy `keyword(<value>)` sends.
 * `?keyword=` reads its text with `keywordQuery`, one clause per term, which
 * keeps the meaning of:
 * - unquoted words: the Data API matches `keyword(coli Salmonella)` like
 *   `and(keyword(coli),keyword(Salmonella))` (1,933 genomes on alpha);
 * - a quoted word or phrase, sent whole with its quotes (`keyword("Rv0001")`
 *   is 1 PATRIC feature, `keyword(Rv0001)` 341,190; `keyword("DNA
 *   polymerase")` 16,285,620, the words apart 22,504,678);
 * - Solr's `AND`, `NOT` and `-` exclusion (`keyword(coli NOT Salmonella)` and
 *   `keyword(coli -Salmonella)` are both 132,341 genomes, as
 *   `and(keyword(coli),not(keyword(Salmonella)))`).
 * Not of: an open quote, which `keywordTerms` would close, a quote inside a
 * word, `workingSolrSyntaxPattern`, `keyword(*)`, and an `OR`, which Solr
 * reads oddly beside other words (`keyword(E coli OR Salmonella)` is 502,671
 * genomes, `E` alone) and `orKeywordAsRql` sends as RQL.
 */
function readsAsWritten(value: string): boolean {
  const query = keywordQuery(value);
  return (
    value !== "*" &&
    query.length > 0 &&
    keywordTerms(value).join(" ") === value.split(/\s+/).join(" ") &&
    !workingSolrSyntaxPattern.test(value) &&
    query.every((group) => group.length === 1)
  );
}

/**
 * The arguments of `part` when it is exactly one `name(...)` call, split at its
 * top-level commas.
 */
function callArguments(part: string, name: string): string[] | undefined {
  if (!part.startsWith(`${name}(`) || !part.endsWith(")")) return undefined;
  const inner = part.slice(name.length + 1, -1);
  const args: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < inner.length; index += 1) {
    if (inner[index] === "(") depth += 1;
    else if (inner[index] === ")") depth -= 1;
    else if (inner[index] === "," && depth === 0) {
      args.push(inner.slice(start, index));
      start = index + 1;
    }
    if (depth < 0) return undefined;
  }
  if (depth !== 0) return undefined;
  args.push(inner.slice(start));
  return args;
}

/** The value of `keyword(<one term>)` that reads as written, not negated. */
function searchBoxTerm(part: string): string | undefined {
  const lone = keywordCallPattern.exec(part);
  if (!lone) return undefined;
  const value = safeDecode(lone[1]).trim();
  const [term, ...others] = keywordTerms(value);
  return term === value &&
    others.length === 0 &&
    readsAsWritten(value) &&
    !keywordQuery(value)[0][0].negated
    ? value
    : undefined;
}

/**
 * The `?keyword=` text of a query alpha's search box builds with `or(...)` or
 * `not(...)` (`searchToQuery`): an `and` of `keyword(term)`,
 * `not(keyword(term))` and `or(keyword(term),…)`, each term one word or
 * phrase that reads as written. `keywordQuery` reads the text back as that
 * query (`a b OR c NOT d`). A NOT inside an OR, and a query of only NOTs, stay
 * RQL: the Data API reads `or(not(keyword(coli)),keyword(Salmonella))` as
 * Lucene does (Salmonella AND NOT coli, 61,384 genomes) and
 * `and(not(...),not(...))` as nothing, where `?keyword=` reads them as written.
 */
function searchBoxKeyword(part: string): string | undefined {
  const items = callArguments(part, "and") ?? [part];
  const texts: string[] = [];
  let positive = false;
  for (const item of items) {
    const term = searchBoxTerm(item);
    const negated = callArguments(item, "not");
    const negatedTerm =
      negated?.length === 1 ? searchBoxTerm(negated[0]) : undefined;
    const options = callArguments(item, "or")?.map(searchBoxTerm);
    if (term !== undefined) {
      texts.push(term);
      positive = true;
    } else if (negatedTerm !== undefined) {
      texts.push(`NOT ${negatedTerm}`);
    } else if (
      options !== undefined &&
      options.length > 1 &&
      options.every((option) => option !== undefined)
    ) {
      texts.push(options.join(" OR "));
      positive = true;
    } else return undefined;
  }
  return positive ? texts.join(" ") : undefined;
}

/**
 * The `?keyword=` text that sends what a legacy list query sends: the query is
 * one keyword part beside at most one `sort(...)`, a lone `keyword(x)` or
 * `and(keyword(a),keyword(b),…)` whose values read as written
 * (`readsAsWritten`), or alpha's search-box `or(...)`/`not(...)` form
 * (`searchBoxKeyword`). The sort is dropped: parity is on totals, and legacy's
 * own links carry their sort in the hash (`#defaultSort=-score`) instead.
 */
function legacyKeyword(rqlParts: readonly string[]): string | undefined {
  const queryParts = rqlParts.filter((part) => !legacySortPattern.test(part));
  if (queryParts.length !== 1 || rqlParts.length > 2) return undefined;
  const values = keywordCallValues(queryParts[0]);
  if (!values) return searchBoxKeyword(queryParts[0]);
  // Joined, a value's dangling operator would bind the next one (`a OR`, `b`).
  const keyword = values.join(" ");
  return values.every(readsAsWritten) && readsAsWritten(keyword)
    ? keyword
    : undefined;
}

/**
 * A lone `keyword(x)` whose text holds Solr's `OR` (or `||`), as RQL: alone,
 * legacy sends it to Solr as written (195,658 genomes for
 * `keyword(coli OR Salmonella)`), but beside any other clause the Data API
 * lets the OR leak out of it. A NOT inside the OR stays as Solr reads it
 * (`keyword(coli OR NOT Salmonella)`: coli AND NOT Salmonella, 132,341). A
 * plain `a OR b` then reads back as `?keyword=` (`searchBoxKeyword`). Any other
 * part is returned as it is.
 */
function orKeywordAsRql(part: string): string {
  const lone = keywordCallPattern.exec(part);
  if (!lone) return part;
  const query = keywordQuery(safeDecode(lone[1]));
  if (!query.some((group) => group.length > 1)) return part;
  return rqlAnd(...keywordQueryClauses(query, escapeRqlValue, "asSolr"));
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
    const rawRqlParts: string[] = [];
    const namedParts: string[] = [];
    for (const seg of rawSearch.split("&")) {
      if (!seg) continue;
      if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(seg)) {
        namedParts.push(seg);
      } else {
        rawRqlParts.push(seg);
      }
    }
    const namedParams = new URLSearchParams(namedParts.join("&"));
    const rqlParts = legacyKeywordSegments.has(segment)
      ? rawRqlParts.map(orKeywordAsRql)
      : rawRqlParts;
    const keyword =
      legacyKeywordSegments.has(segment) && !namedParams.has("keyword")
        ? legacyKeyword(rqlParts)
        : undefined;
    const searchParts: string[] = [];
    if (keyword !== undefined) {
      searchParts.push(`keyword=${encodeQueryComponent(keyword)}`);
    } else if (rqlParts.length > 0) {
      // TaxonList historically used the Genome lineage field name even though the
      // Taxonomy endpoint exposes the same relationship as `lineage_ids`.
      const joined = rqlParts.join("&");
      const rql =
        segment === "taxonomy"
          ? renameRqlField(joined, "taxon_lineage_ids", "lineage_ids")
          : joined;
      searchParts.push(`rql=${encodeQueryComponent(rql)}`);
    }
    for (const [name, value] of Object.entries(target.defaultParams ?? {})) {
      if (!namedParams.has(name)) namedParams.set(name, value);
    }
    if (namedParams.size > 0) searchParts.push(toQueryString(namedParams));
    return { pathname: `/${segment}`, search: searchParts.join("&") };
  }

  // Singular view: keep the id in the path, preserve named query params verbatim.
  let id: string;
  try {
    id = idParts
      .map((part) => encodePathSegment(decodeURIComponent(part)))
      .join("%2F");
  } catch {
    return null;
  }
  const search = rawSearch
    ? toQueryString(new URLSearchParams(rawSearch))
    : "";
  return { pathname: `/${segment}/${id}`, search };
}
