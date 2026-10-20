import type { OrganismFetchOptions, OrganismGenusFacet } from "./types";
import {
  buildGenomeFacetUrl,
  fetchOrganism,
  getBvBrcWebsiteApiBaseUrl,
  organismResponseError,
  parseSolrFacetList,
  readJsonObject,
  type OrganismRequest,
} from "./utils";

// Unlabelled: the card showing a failure names it ("Top genera could not be
// loaded").
const generaRequest: OrganismRequest = { source: "genome genus facet" };

export async function fetchOrganismGenera(
  taxonId: number,
  limit = 24,
  options: OrganismFetchOptions = {},
): Promise<OrganismGenusFacet[]> {
  const baseUrl = getBvBrcWebsiteApiBaseUrl();
  const response = await fetchOrganism(buildGenomeFacetUrl(baseUrl, taxonId, "genus", limit), generaRequest, {
    method: "GET",
    headers: { Accept: "application/solr+json" },
    signal: options.signal,
  });

  if (!response.ok) throw await organismResponseError(response, generaRequest);

  const payload = await readJsonObject(response, generaRequest);
  return parseSolrFacetList(payload, "genus");
}
