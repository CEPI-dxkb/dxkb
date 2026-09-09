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

/** Build a single `keyword(value)` clause with the value escaped. */
export function rqlKeyword(value: string): string {
  return `keyword(${escapeRqlValue(value)})`;
}

/** Combine two or more RQL clauses with `and(...)`. */
export function rqlAnd(...clauses: string[]): string {
  if (clauses.length === 1) return clauses[0];
  return `and(${clauses.join(",")})`;
}
