export const strainCopyMaxRows = 5_000;
export const strainServicesMaxRows = 100;
export const strainGenomesMaxRows = 10_000;
export const strainGroupMaxRows = 10_000;
export const strainGenomesMaxUrlLength = 8_000;

export function genomeIdsFromStrains(
  rows: readonly Record<string, unknown>[],
): string[] {
  const genomeIds: string[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (!Array.isArray(row.genome_ids)) continue;
    for (const value of row.genome_ids) {
      if (typeof value !== "string" && typeof value !== "number") continue;
      const genomeId = String(value).trim();
      if (!genomeId || seen.has(genomeId)) continue;
      seen.add(genomeId);
      genomeIds.push(genomeId);
    }
  }

  return genomeIds;
}
