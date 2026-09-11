// Shared limits and ID extraction for the selection-driven collection actions in
// `collection-selection-actions.tsx`. Keeping them here stops each collection
// re-deriving its own ceilings.

/** Copy-to-clipboard ceiling; above this the browser clipboard write is unreliable. */
export const selectionCopyMaxRows = 5_000;
/** Services build a temporary Genome Group, so the selection stays small. */
export const selectionServicesMaxRows = 100;
export const selectionGenomesMaxRows = 10_000;
/** Legacy's ViewFeatureItems ceiling on the Interactions tab. */
export const selectionFeaturesMaxRows = 5_000;
export const selectionGroupMaxRows = 10_000;
/** List URLs carry every ID inline; longer than this and browsers truncate. */
export const selectionListMaxUrlLength = 8_000;

/**
 * Collect unique, trimmed IDs from `fields` on each row. A field may hold a scalar
 * (`genome_id`) or an array (`genome_ids`); both shapes are flattened. Several fields
 * are read in order and de-duplicated together, which is how one Interaction row
 * contributes both of its interactors.
 */
export function idsFromRows(
  rows: readonly Record<string, unknown>[],
  fields: string | readonly string[],
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    for (const field of typeof fields === "string" ? [fields] : fields) {
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
  }

  return ids;
}
