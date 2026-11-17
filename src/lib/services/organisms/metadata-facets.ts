import { foldFacetBuckets } from "./fold-facet-buckets";
import type { GenomeScope } from "./genome-scope";
import { metadataFieldLabel } from "./metadata-field-labels";
import type { OrganismFetchOptions, OrganismMetadataFacets } from "./types";
import {
  buildGenomeFacetUrl,
  fetchOrganismSolrJson,
  getBvBrcWebsiteApiBaseUrl,
  parseSolrFacetList,
} from "./utils";

// Buckets asked of Solr before folding, so a variant ranked outside the top
// few still joins its group. The first `keep` folded buckets are returned.
const metadataFacetFetchLimit = 200;

async function fetchMetadataFacet(
  baseUrl: string,
  scope: GenomeScope,
  field: string,
  keep: number | undefined,
  signal: AbortSignal | undefined,
) {
  const fetchLimit =
    keep === undefined ? undefined : Math.max(keep, metadataFacetFetchLimit);
  const payload = await fetchOrganismSolrJson(
    buildGenomeFacetUrl(baseUrl, scope, field, fetchLimit),
    { source: `genome ${field} facet`, label: metadataFieldLabel(field) },
    signal,
  );
  const buckets = parseSolrFacetList(payload, field);
  return keep === undefined ? buckets : foldFacetBuckets(buckets).slice(0, keep);
}

export async function fetchOrganismMetadataFacets(
  scope: GenomeScope,
  fields: string[],
  options: OrganismFetchOptions & { limit?: number } = {},
): Promise<OrganismMetadataFacets> {
  const baseUrl = getBvBrcWebsiteApiBaseUrl();
  const defaultLimit =
    options.limit !== undefined && options.limit > 0 ? options.limit : 12;
  const settled = await Promise.allSettled(
    fields.map((field) =>
      fetchMetadataFacet(
        baseUrl,
        scope,
        field,
        field === "collection_year" ? undefined : defaultLimit,
        options.signal,
      ),
    ),
  );

  const failed = settled.find((result) => result.status === "rejected");
  if (failed?.status === "rejected") {
    throw failed.reason;
  }

  return fields.reduce<OrganismMetadataFacets>((facets, field, index) => {
    const result = settled[index];
    if (result.status === "fulfilled") {
      facets[field] = result.value;
    }
    return facets;
  }, {});
}
