import type { OrganismGeoDistribution } from "@/lib/services/organisms/types";

/**
 * Whether the State view has anything to draw. The Data API's genome core
 * carries no county values (as of 2026-11-23), so this is false for every
 * taxon today; it is derived from the pivot the page already fetches so the
 * view comes back on its own the day the field is filled. A failed county pivot also reads as
 * false (DXKBCORE-420 tracks telling the two apart).
 */
export function hasCountyData(
  data: Pick<OrganismGeoDistribution, "countyData">,
): boolean {
  return Object.values(data.countyData).some((count) => count > 0);
}

export const stateViewUnavailableReason =
  "County-level data is not available for this taxon.";
