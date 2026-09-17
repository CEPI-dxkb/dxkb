import type { NextRequest } from "next/server";

/**
 * Query parsing for the loopback E2E mock's fixture matchers.
 *
 * ## One decode, per clause — never a second one per value
 *
 * A Data API clause reaches this handler in one of two shapes, and a single
 * `decodeURIComponent` of the raw `&`-separated part lands on the decoded
 * clause text in both:
 *
 * 1. **As the repository wrote it.** `serializeValue`
 *    (`src/lib/data-api/rql.ts`) percent-encodes each RQL value, so
 *    `sample/1` arrives inside `eq(sample_identifier,sample%2F1)`. One decode
 *    gives `eq(sample_identifier,sample/1)`.
 * 2. **After Next's normalisation.** Next runs every route-handler query
 *    through a `URLSearchParams` round trip: it DECODES the clause (consuming
 *    `serializeValue`'s layer) and re-encodes it form-urlencoded, so each
 *    clause arrives as a key with an empty value and with `(` `)` `,`
 *    escaped. One decode of that lands on the same text as case 1.
 *
 * So the decode in `splitClauses` is the only percent-decode this module
 * performs. {@link normalizeQueryValue} only strips `serializeValue`'s
 * quoting and restores the space that the form-urlencoded transport wrote as
 * `+`; it deliberately does NOT decode again.
 *
 * ## Why the second decode was removed
 *
 * An earlier version of this module decoded the extracted value a second
 * time. That made `sample%2F1` and `sample/1` resolve to the same fixture,
 * which is exactly the wrong leniency: the production bug this task
 * uncovered was a page component sending `eq(sample_identifier,sample%252F1)`
 * because Next re-encodes its `params` (see `readRouteParam` in
 * `src/lib/views/route-params.ts` for the full mechanism and the
 * Next-internals citation). The extra decode absorbed that and turned
 * `e2e/tests/surveillance-view.spec.ts` green while the real app 404'd. With
 * the production path fixed, the mock must be strict again so a regression of
 * that bug fails the suite instead of being forgiven by it.
 *
 * ## The one ambiguity the transport still destroys
 *
 * A value written as `+` cannot be told apart from a value containing a
 * literal plus: `serializeValue` emits `%2B` for a real plus, but Next's
 * round trip writes a space as `+`, and after the single decode both read as
 * `+`. {@link normalizeQueryValue} resolves it as a space, which is what
 * `keyword("Nasal swab")` needs. Clause TEXT keeps its `+`, which is what
 * keeps `sort(+genome_name,+genome_id)` matching verbatim.
 */

export interface FixtureQueryEquality {
  field: string;
  value: string;
}

export interface FixtureQuery {
  /** Still-encoded search string, `?` included. Diagnostics only. */
  search: string;
  /** Decoded clauses, in request order (see this module's header). */
  clauses: string[];
  /** Every `eq(field,value)` in the query, values unquoted and space-restored. */
  equals: FixtureQueryEquality[];
  /** Every `keyword(value)` in the query, values unquoted and space-restored. */
  keywords: string[];
}

/** Undo one percent-decode without throwing on a malformed escape. */
function decodeOnce(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Read an RQL value out of an already-decoded clause: strip
 * `serializeValue`'s quoting and restore the space the form-urlencoded
 * transport wrote as `+`. No percent-decoding — `splitClauses` already did
 * the one decode there is, and a second one would collapse `sample%2F1` onto
 * `sample/1` (see this module's header).
 */
export function normalizeQueryValue(raw: string): string {
  const unquoted =
    raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')
      ? raw.slice(1, -1)
      : raw;
  return unquoted.replace(/\+/g, " ");
}

const equalsPattern = /\beq\(([A-Za-z_][A-Za-z0-9_]*),("[^"]*"|[^(),]*)\)/g;
const keywordPattern = /\bkeyword\(("[^"]*"|[^(),]*)\)/g;

/**
 * Split the search string back into the clause list the Data API repository
 * built, undoing only the transport layer.
 */
function splitClauses(search: string): string[] {
  return search
    .replace(/^\?/, "")
    .split("&")
    .filter(Boolean)
    .map((part) => {
      // The repository sends bare RQL clauses, never `name=value` pairs, so a
      // trailing `=` is the empty value `URLSearchParams.toString()` appends
      // to a key. Keep the key side.
      const separator = part.indexOf("=");
      return decodeOnce(separator === -1 ? part : part.slice(0, separator));
    });
}

export function parseFixtureQuery(request: NextRequest): FixtureQuery {
  const search = new URL(request.url).search;
  const clauses = splitClauses(search);
  const joined = clauses.join("&");
  return {
    search,
    clauses,
    equals: [...joined.matchAll(equalsPattern)].map((match) => ({
      field: match[1],
      value: normalizeQueryValue(match[2]),
    })),
    keywords: [...joined.matchAll(keywordPattern)].map((match) =>
      normalizeQueryValue(match[1]),
    ),
  };
}

/** The first `eq(<field>,…)` value in the query, or `undefined`. */
export function equalsValue(
  query: FixtureQuery,
  field: string,
): string | undefined {
  return query.equals.find((equality) => equality.field === field)?.value;
}

/** Whether the query carries a `keyword(<value>)` matching exactly. */
export function hasKeyword(query: FixtureQuery, value: string): boolean {
  return query.keywords.includes(value);
}

/** Whether the query carries `<clause>` verbatim as one of its clauses. */
export function hasClause(query: FixtureQuery, clause: string): boolean {
  return query.clauses.includes(clause);
}

/** Whether any clause invokes `<name>(`, e.g. `select`, `facet`, `limit`. */
export function hasCall(query: FixtureQuery, name: string): boolean {
  return query.clauses.some((clause) => clause.includes(`${name}(`));
}
