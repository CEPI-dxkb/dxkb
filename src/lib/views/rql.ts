import {
  keywordQuery,
  keywordQueryClauses,
} from "@/lib/data-api/keyword-terms";

export type SearchParamsRecord = Record<string, string | string[] | undefined>;

/**
 * Escape RQL-special characters in a value so a value like `flu)` or `a,b` cannot
 * break out of its clause. RQL reserves `,`, `(`, `)` — percent-encode them per the
 * BV-BRC convention. Plain alphanumeric values pass through unchanged.
 */
export function escapeRqlValue(value: string): string {
  return value.replace(/,/g, "%2C").replace(/\(/g, "%28").replace(/\)/g, "%29");
}

/** Build a single `eq(field,value)` clause with the value escaped. */
export function rqlEq(field: string, value: string): string {
  return `eq(${field},${escapeRqlValue(value)})`;
}

/**
 * The RQL of a keyword refinement, or none when the text has no terms (blank,
 * or only `"`): the text read by `keywordQuery` as the `?keyword=` search
 * reads it, one exact `keyword(...)` per word or quoted phrase, Solr's `OR` as
 * `or(...)` and its `NOT` as `not(...)`, ANDed. Never Solr's operators inside
 * one clause: the Data API joins a keyword's text into the surrounding query
 * without brackets, so `and(eq(genome_id,*),keyword(coli OR Salmonella))`
 * would list all 17,033,311 genomes instead of the 195,658 the OR matches.
 */
export function rqlKeyword(value: string): string | undefined {
  const clauses = keywordQueryClauses(keywordQuery(value), escapeRqlValue);
  return clauses.length > 0 ? rqlAnd(...clauses) : undefined;
}

/** Combine two or more RQL clauses with `and(...)`. */
export function rqlAnd(...clauses: string[]): string {
  if (clauses.length === 1) return clauses[0];
  return `and(${clauses.join(",")})`;
}
