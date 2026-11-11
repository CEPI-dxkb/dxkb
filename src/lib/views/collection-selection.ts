import { maxRqlInValues } from "@/lib/data-api/rql";

// Row ceilings bound the fetch an action performs, not the selection: one row
// can contribute many IDs, so actions that send IDs also need an ID ceiling.

export const selectionCopyMaxRows = 5_000;
export const selectionServicesMaxRows = 100;
export const selectionGenomesMaxRows = 10_000;
export const selectionFeaturesMaxRows = 5_000;
export const selectionGroupMaxRows = 10_000;
/** List URLs carry every ID inline; browsers truncate beyond this. */
export const selectionListMaxUrlLength = 8_000;

/**
 * The destination renders the selection as `in(<idField>,(...))`, which the
 * Data API rejects above `maxRqlInValues`; `selectionListMaxUrlLength` is the
 * tighter bound for long feature IDs.
 */
export const selectionListMaxIds = maxRqlInValues;

/**
 * One Strain row carries every genome of the strain, so 100 rows can flatten to
 * thousands of IDs. Tied to `maxRqlInValues` so anything SERVICES prefills can
 * also be opened as a Genome or Feature list.
 */
export const selectionServicesMaxIds = maxRqlInValues;

/**
 * The group is a single write nothing reads back through `in(...)`, so it keeps
 * the headroom the row ceiling already implied.
 */
export const selectionGroupMaxIds = selectionGroupMaxRows;

/**
 * A field may hold a scalar or an array; several fields are de-duplicated
 * together, which is how one Interaction row contributes both interactors.
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
