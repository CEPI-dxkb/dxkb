import { genomeLinkedScopeClauses, type GenomeScope } from "./genome-scope";
import type {
  AmrAntibioticRow,
  AmrDistributionData,
  OrganismFetchOptions,
} from "./types";
import {
  fetchOrganismSolrJsonPost,
  getBvBrcWebsiteApiBaseUrl,
  parseSolrFacetPivot,
} from "./utils";

const pivotKey = "antibiotic,resistant_phenotype";

function buildBody(scope: GenomeScope): string {
  return (
    "eq(genome_id,*)" +
    genomeLinkedScopeClauses(scope)
      .map((clause) => `&${clause}`)
      .join("") +
    "&in(resistant_phenotype,(Resistant,Susceptible,Intermediate))" +
    "&limit(1)" +
    "&facet((pivot,(antibiotic,resistant_phenotype)),(mincount,1),(limit,-1))" +
    // Matches the live site request verbatim for cache/telemetry parity. Does not change
    // the facet_pivot shape in the application/solr+json response — pivots remain arrays of
    // {value, count, pivot} objects, which parseSolrFacetPivot expects.
    "&json(nl,map)"
  );
}

function toRow(
  antibiotic: string,
  phenotypes: Partial<Record<string, number>>,
): AmrAntibioticRow {
  const Resistant = phenotypes.Resistant ?? 0;
  const Susceptible = phenotypes.Susceptible ?? 0;
  const Intermediate = phenotypes.Intermediate ?? 0;
  return {
    antibiotic,
    Resistant,
    Susceptible,
    Intermediate,
    total: Resistant + Susceptible + Intermediate,
  };
}

export async function fetchAmrPhenotypeDistribution(
  scope: GenomeScope,
  options: OrganismFetchOptions = {},
): Promise<AmrDistributionData> {
  const baseUrl = getBvBrcWebsiteApiBaseUrl();
  const url = `${baseUrl}/genome_amr/`;
  const payload = await fetchOrganismSolrJsonPost(
    url,
    buildBody(scope),
    "amr phenotype distribution",
    options.signal,
  );
  const pivot = parseSolrFacetPivot(payload, pivotKey);
  const antibiotics = Object.entries(pivot)
    .map(([name, phenotypes]) => toRow(name, phenotypes))
    .sort((a, b) => b.total - a.total);
  return { antibiotics };
}
