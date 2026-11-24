import type { OrganismGeoDistribution } from "@/lib/services/organisms/types";

/**
 * Whether any county has genomes. The Data API's genome core carries no county
 * values (as of 2026-11-23), so this is false for every taxon today; it is
 * derived from the pivot the page already fetches so the State view comes back
 * on its own the day the field is filled.
 */
export function hasCountyData(
  data: Pick<OrganismGeoDistribution, "countyData">,
): boolean {
  return Object.values(data.countyData).some((count) => count > 0);
}

/**
 * Whether the State view can be opened: some county has genomes, or the county
 * query failed. A failed pivot leaves `countyData` empty, but it keeps the
 * State view available so the failure alert and its Retry are reachable
 * (DXKBCORE-420) instead of reading as a taxon without county data.
 */
export function isStateViewAvailable(
  data: Pick<OrganismGeoDistribution, "countyData" | "countyError">,
): boolean {
  return Boolean(data.countyError) || hasCountyData(data);
}

export const stateViewUnavailableReason =
  "County-level data is not available for this taxon.";
