/**
 * Sanitize and join genome IDs into a comma-separated string for RQL `in()` clauses.
 * Only allows IDs matching /^[0-9.]+$/ to prevent injection.
 */
export function buildGenomeInClause(ids: string[]): string {
  return ids
    .map((id) => id.trim())
    .filter((id) => /^[0-9.]+$/.test(id))
    .join(",");
}
