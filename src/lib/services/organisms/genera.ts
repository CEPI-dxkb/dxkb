import type { OrganismFetchOptions, OrganismGenusFacet } from "./types";
import {
  buildGenomeFacetUrl,
  fetchOrganism,
  getBvBrcWebsiteApiBaseUrl,
  parseSolrFacetList,
  readJsonObject,
  responseErrorMessage,
} from "./utils";

export async function fetchOrganismGenera(
  taxonId: number,
  limit = 24,
  options: OrganismFetchOptions = {},
): Promise<OrganismGenusFacet[]> {
  const baseUrl = getBvBrcWebsiteApiBaseUrl();
  const response = await fetchOrganism(buildGenomeFacetUrl(baseUrl, taxonId, "genus", limit), "genome genus facet", {
    method: "GET",
    headers: { Accept: "application/solr+json" },
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(await responseErrorMessage(response));
  }

  const payload = await readJsonObject(response, "genome genus facet");
  return parseSolrFacetList(payload, "genus");
}
