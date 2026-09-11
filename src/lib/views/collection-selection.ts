// Shared limits and ID extraction for the selection-driven collection actions in
// `collection-selection-actions.tsx`. Keeping them here stops each collection
// re-deriving its own ceilings.

import { maxRqlInValues } from "@/lib/data-api/rql";

// Row ceilings. These bound the *fetch* an action performs — how many rows it will
// pull before it has any IDs at all. They are not selection limits: `idsFromRows`
// flattens array-valued fields (a Strain's `genome_ids`) and pools several fields
// (both Interaction interactors), so one row can contribute many IDs. Every action
// that sends IDs somewhere also needs an ID ceiling (below).

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

// ID ceilings, enforced after `idsFromRows` has flattened, trimmed and de-duplicated.

/**
 * GENOMES / FEATURES list ceiling. The destination route renders the selection as an
 * `in(<idField>,(...))` query and the Data API rejects that clause above
 * `maxRqlInValues`, so this is the destination's own limit rather than a choice of
 * ours. `selectionListMaxUrlLength` is the tighter bound for long feature IDs.
 */
export const selectionListMaxIds = maxRqlInValues;

/**
 * SERVICES ceiling. `selectionServicesMaxRows` cannot double as the ID bound because a
 * single Strain row carries every genome of the strain, so 100 rows can flatten to
 * thousands of genome IDs. Tied to `maxRqlInValues` because that is the largest ID set
 * any selection destination is known to accept: anything SERVICES will prefill can
 * then also be opened as a Genome or Feature list without a second, stricter refusal.
 */
export const selectionServicesMaxIds = maxRqlInValues;

/**
 * GROUP ceiling. The workspace group is a single write that nothing reads back through
 * an `in(...)` clause, so it keeps the headroom the row ceiling already implied:
 * flattened IDs are allowed exactly as many entries as `selectionGroupMaxRows` rows of
 * scalar IDs would have produced.
 */
export const selectionGroupMaxIds = selectionGroupMaxRows;

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
