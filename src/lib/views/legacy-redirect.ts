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

const rqlFieldOperators = ["eq", "ne", "lt", "le", "gt", "ge", "in"] as const;
const fieldArgumentPattern = new RegExp(
  `(?:^|[(,])(?:${rqlFieldOperators.join("|")})\\($`,
);
const sortKeyPattern = /[(,][+-]$/;

/**
 * Adjacent delimiters alone cannot tell a field from a value:
 * `keyword(taxon_lineage_ids)` and `eq(taxon_name,taxon_lineage_ids)` must be
 * left alone.
 */
function isFieldPosition(rql: string, index: number): boolean {
  const before = rql.slice(0, index);
  return sortKeyPattern.test(before) || fieldArgumentPattern.test(before);
}

/**
 * A blunt replaceAll would also rewrite the token inside values. Legacy query
 * strings arrive raw, so quotes appear as `"` or `%22`.
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

const namedParamPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

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
 * Next's decode turns a value's `%2C` into what reads as an argument separator.
 * A comma past a fixed-arity call's last separator cannot be structural, so
 * escaping it restores the value; quoted text and `and`/`or`/`not`/`in` commas
 * are left alone.
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
 * Next re-serializes the raw query form-encoded before the proxy runs
 * (`?eq(a,b)` arrives as `?eq%28a%2Cb%29=`), so a raw RQL fragment is a key
 * with an empty value, split at its first `=`. `%` and `&` are re-escaped so
 * the mapper's `&` split and `decodeURIComponent` read the original text.
 * `escapeValueCommas` restores commas where operator arity proves they belong
 * to a value; inside an `in` list both readings are valid, so they stay
 * members.
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
 * Only for these lists does `?keyword=` reproduce legacy: Feature applies its
 * PATRIC default and Genome's related tabs run the keyword on their own
 * collections; as `?rql=` neither would.
 */
const legacyKeywordSegments: ReadonlySet<string> = new Set(["feature", "genome"]);
const keywordCallPattern = /^keyword\(([^()]*)\)$/;
const keywordAndPattern = /^and\(keyword\([^()]*\)(?:,keyword\([^()]*\))+\)$/;
const legacySortPattern = /^sort\([^()]*\)$/;
/**
 * Solr syntax that works inside one `keyword(...)` but that `?keyword=` reads
 * as a space: a boost, a range and a regular expression. The rest is an HTTP
 * 400 as written, or Solr splits a word at it anyway.
 */
const workingSolrSyntaxPattern = /[\^<>]|(?:^|\s)\//;

function keywordCallValues(part: string): string[] | undefined {
  const lone = keywordCallPattern.exec(part);
  if (lone) return [safeDecode(lone[1]).trim()];
  if (!keywordAndPattern.test(part)) return undefined;
  return [...part.matchAll(/keyword\(([^()]*)\)/g)].map((match) =>
    safeDecode(match[1]).trim(),
  );
}

/**
 * Whether `?keyword=<value>` sends what one legacy `keyword(<value>)` sends. It
 * does not for an open quote, a quote inside a word,
 * `workingSolrSyntaxPattern`, `keyword(*)`, or an `OR`, which Solr reads oddly
 * beside other words and `orKeywordAsRql` sends as RQL.
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
 * A NOT inside an OR, and a query of only NOTs, stay RQL: the Data API reads
 * them as Lucene does (or as nothing), where `?keyword=` reads them as written.
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
 * The sort is dropped: parity is on totals, and legacy's own links carry their
 * sort in the hash (`#defaultSort=-score`).
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
 * Alone, legacy sends the OR to Solr as written, but beside any other clause
 * the Data API lets it leak out of the `keyword(...)`. A NOT inside the OR
 * stays as Solr reads it.
 */
function orKeywordAsRql(part: string): string {
  const lone = keywordCallPattern.exec(part);
  if (!lone) return part;
  const query = keywordQuery(safeDecode(lone[1]));
  if (!query.some((group) => group.length > 1)) return part;
  return rqlAnd(...keywordQueryClauses(query, escapeRqlValue, "asSolr"));
}

/**
 * The hash is not handled here because the server cannot read it. The proxy
 * builds `rawSearch` with `legacySearchFromParams`.
 */
export function mapLegacyViewPath(
  pathname: string,
  rawSearch: string,
): MappedPath | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length < 2 || parts[0] !== "view") return null;

  const legacyName = parts[1];
  const target = legacyViewTargets[legacyName];
  if (!target) return null;

  const { segment } = target;
  const idParts = parts.slice(2);
  const isList = target.kind === "list";

  if (isList || idParts.length === 0) {
    // The legacy raw query may be raw RQL, named params or a mix; classify each
    // `&` segment so named params like filter= are not swallowed into rql=.
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
      // TaxonList used the Genome lineage field name; the Taxonomy endpoint
      // exposes the same relationship as `lineage_ids`.
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
