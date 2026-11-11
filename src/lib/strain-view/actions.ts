import { idsFromRows } from "@/lib/views/collection-selection";

export function genomeIdsFromStrains(
  rows: readonly Record<string, unknown>[],
): string[] {
  return idsFromRows(
    rows.filter((row) => Array.isArray(row.genome_ids)),
    "genome_ids",
  );
}
