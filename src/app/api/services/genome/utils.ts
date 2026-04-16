/**
 * Sanitize and join genome IDs into a comma-separated string for RQL `in()` clauses.
 * Only allows IDs matching the BV-BRC genome ID format (e.g. "83332.12").
 */
export function buildGenomeInClause(ids: string[]): string {
  return ids
    .map((id) => id.trim())
    .filter((id) => /^\d+(\.\d+)?$/.test(id))
    .join(",");
}
