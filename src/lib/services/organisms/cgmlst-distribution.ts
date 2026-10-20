import type { OrganismFetchOptions, OrganismGenusFacet } from "./types";
import {
  buildGenomeFacetUrl,
  fetchOrganismSolrJson,
  getBvBrcWebsiteApiBaseUrl,
  parseSolrFacetList,
} from "./utils";

export const hcLevels = [
  "hc0", "hc2", "hc5", "hc10", "hc20", "hc50", "hc100",
] as const;

export type HcLevel = (typeof hcLevels)[number];
export type CgmlstHcDistribution = Record<HcLevel, OrganismGenusFacet[]>;

export async function fetchCgmlstHcDistribution(
  taxonId: number,
  options: OrganismFetchOptions = {},
): Promise<CgmlstHcDistribution> {
  const baseUrl = getBvBrcWebsiteApiBaseUrl();

  // No internal allSettled — let any per-level failure surface to the caller
  // (e.g. `MetadataDistributions`) which already wraps in `Promise.allSettled`
  // and decides how to degrade. Swallowing here too would hide errors twice
  // and prevent the panel from showing a real error message.
  const lists = await Promise.all(
    hcLevels.map((level) =>
      fetchOrganismSolrJson(
        buildGenomeFacetUrl(baseUrl, taxonId, `cgmlst_${level}`, 10),
        {
          source: `genome cgmlst_${level} facet`,
          label: `cgMLST ${level.toUpperCase()} Distribution`,
        },
        options.signal,
      ).then((payload) => parseSolrFacetList(payload, `cgmlst_${level}`)),
    ),
  );

  return Object.fromEntries(
    hcLevels.map((level, i) => [level, lists[i]]),
  ) as CgmlstHcDistribution;
}
