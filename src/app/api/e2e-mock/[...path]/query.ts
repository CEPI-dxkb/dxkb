import type { NextRequest } from "next/server";

/**
 * Query parsing for the loopback E2E mock's fixture matchers.
 *
 * ## Why this is not one `decodeURIComponent(search)` call
 *
 * A Data API request reaches this handler through two encoding layers, and
 * both have to come off — in order — before a fixture value can be compared
 * to a fixture record.
 *
 * 1. **`serializeValue`** (`src/lib/data-api/rql.ts`) percent-encodes every
 *    RQL *value* and quotes it when it contains whitespace, so the sample
 *    identifier `sample/1` is serialised into the clause
 *    `eq(sample_identifier,sample%2F1)`.
 * 2. **The query transport.** `ServerDataRepository` assigns those clauses to
 *    `URL.search`, and Next normalises every route-handler query through a
 *    `URLSearchParams` round trip: each bare clause arrives as a *key* with an
 *    empty value, with `(` `)` `,` percent-encoded and spaces turned into
 *    `+`. A page whose dynamic `params` segment is still percent-encoded
 *    (Next does not decode `%2F` for the page component the way it does for
 *    `generateMetadata`) serialises one level deeper again:
 *    `eq(sample_identifier,sample%252F1)`.
 *
 * A single decode over the whole search string undoes exactly one of those
 * layers, so `sample%252F1` came back as `sample%2F1` and never matched the
 * `sample/1` fixture — the Surveillance compound-member journey rendered
 * "Surveillance record not found" from an empty result. Decoding twice
 * globally would instead corrupt clause syntax. So: decode the transport
 * layer per clause, then decode the value layer per extracted value, and
 * compare parsed values to fixture values rather than substrings to a
 * substring.
 *
 * ## Two ambiguities the transport genuinely destroys
 *
 * The `URLSearchParams` round trip is lossy, and no parser can undo that:
 *
 * - `+` inside a value means a space (a literal plus is emitted as `%2B` by
 *   `serializeValue` and survives as `%2B`), so {@link decodeQueryValue}
 *   treats it as one. Clause *text* keeps its `+`, which is what makes
 *   `sort(+genome_name,+genome_id)` still match.
 * - A value that literally contains `%2F` is indistinguishable from one that
 *   contains `/`, and it resolves to the slash fixture. That is the outcome
 *   the app needs, not a concession: the page component receives
 *   `params.sampleId` still percent-encoded, so `/surveillance/sample%2F1`
 *   asks for `sample%2F1` and has to find `sample/1`.
 *   `__tests__/full-transport.test.ts` pins both halves.
 */

export interface FixtureQueryEquality {
  field: string;
  value: string;
}

export interface FixtureQuery {
  /** Still-encoded search string, `?` included. Diagnostics only. */
  search: string;
  /** Transport-decoded clauses, in request order. Values stay value-encoded. */
  clauses: string[];
  /** Every `eq(field,value)` in the query, values fully decoded. */
  equals: FixtureQueryEquality[];
  /** Every `keyword(value)` in the query, values fully decoded. */
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
 * Decode an RQL value: strip `serializeValue`'s quoting, treat `+` as the
 * space the form-urlencoded transport turned it into, then undo
 * `serializeValue`'s percent-encoding.
 */
export function decodeQueryValue(raw: string): string {
  const unquoted =
    raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')
      ? raw.slice(1, -1)
      : raw;
  return decodeOnce(unquoted.replace(/\+/g, "%20"));
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
      value: decodeQueryValue(match[2]),
    })),
    keywords: [...joined.matchAll(keywordPattern)].map((match) =>
      decodeQueryValue(match[1]),
    ),
  };
}

/** The first `eq(<field>,…)` value in the query, decoded, or `undefined`. */
export function equalsValue(
  query: FixtureQuery,
  field: string,
): string | undefined {
  return query.equals.find((equality) => equality.field === field)?.value;
}

/** Whether the query filters on `<field>` at all, whatever the value. */
export function hasEqualsField(query: FixtureQuery, field: string): boolean {
  return query.equals.some((equality) => equality.field === field);
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
