import {
  keywordQuery,
  keywordQueryClauses,
} from "@/lib/data-api/keyword-terms";

export type SearchParamsRecord = Record<string, string | string[] | undefined>;

/**
 * RQL reserves `,`, `(` and `)`; they are percent-encoded per the BV-BRC
 * convention so a value like `flu)` cannot break out of its clause.
 */
export function escapeRqlValue(value: string): string {
  return value.replace(/,/g, "%2C").replace(/\(/g, "%28").replace(/\)/g, "%29");
}

export function rqlEq(field: string, value: string): string {
  return `eq(${field},${escapeRqlValue(value)})`;
}

/**
 * Never Solr's operators inside one clause: the Data API joins keyword text
 * into the query without brackets, so `keyword(coli OR Salmonella)` would match
 * far more than the OR does.
 */
export function rqlKeyword(value: string): string | undefined {
  const clauses = keywordQueryClauses(keywordQuery(value), escapeRqlValue);
  return clauses.length > 0 ? rqlAnd(...clauses) : undefined;
}

export function rqlAnd(...clauses: string[]): string {
  if (clauses.length === 1) return clauses[0];
  return `and(${clauses.join(",")})`;
}

export function rqlAnyOf(clauses: readonly string[]): string {
  return clauses.length === 1 ? clauses[0] : `or(${clauses.join(",")})`;
}
