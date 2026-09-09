// Shared limits and ID extraction for the selection-driven collection actions in
// `collection-selection-actions.tsx`. Keeping them here stops each collection
// re-deriving its own ceilings.

/** Copy-to-clipboard ceiling; above this the browser clipboard write is unreliable. */
export const selectionCopyMaxRows = 5_000;
/** Services build a temporary Genome Group, so the selection stays small. */
export const selectionServicesMaxRows = 100;
export const selectionGenomesMaxRows = 10_000;
export const selectionGroupMaxRows = 10_000;
/** Genome list URLs carry every ID inline; longer than this and browsers truncate. */
export const selectionGenomesMaxUrlLength = 8_000;

/**
 * Collect unique, trimmed IDs from `field` on each row. The field may hold a scalar
 * (`genome_id`) or an array (`genome_ids`); both shapes are flattened.
 */
export function idsFromRows(
  rows: readonly Record<string, unknown>[],
  field: string,
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const value = row[field];
    const values = Array.isArray(value) ? value : [value];
    for (const entry of values) {
      if (typeof entry !== "string" && typeof entry !== "number") continue;
      const id = String(entry).trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  }

  return ids;
}
