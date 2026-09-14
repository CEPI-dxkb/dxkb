import { idsFromRows } from "@/lib/views/collection-selection";

/**
 * Collect unique Genome IDs from Strain rows. `genome_ids` is a multi-valued field,
 * so a scalar value is treated as malformed and ignored.
 */
export function genomeIdsFromStrains(
  rows: readonly Record<string, unknown>[],
): string[] {
  return idsFromRows(
    rows.filter((row) => Array.isArray(row.genome_ids)),
    "genome_ids",
  );
}
