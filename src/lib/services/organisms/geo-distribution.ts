import type {
  OrganismFetchOptions,
  OrganismGeoDistribution,
  OrganismGeoLocationMeta,
} from "./types";
import type { GenomeScope } from "./genome-scope";
import {
  buildGenomeGeoFacetUrl,
  buildGenomeGeoPivot3Url,
  buildGenomeGeoPivotUrl,
  fetchOrganismSolrJson,
  getBvBrcWebsiteApiBaseUrl,
  parseSolrFacetList,
  parseSolrFacetPivot,
  parseSolrFacetPivot3,
} from "./utils";

const countryLimit = 300;
const stateLimit = 100;
const countyLimit = 1000;

async function fetchField(baseUrl: string, scope: GenomeScope, field: string, limit: number | undefined, signal: AbortSignal | undefined): Promise<Record<string, number>> {
  const url = buildGenomeGeoFacetUrl(baseUrl, scope, field, limit);
  const payload = await fetchOrganismSolrJson(url, `genome ${field} facet`, signal);
  const list = parseSolrFacetList(payload, field);
  const map: Record<string, number> = {};
  for (const item of list) {
    if (item.name && item.count > 0) map[item.name] = item.count;
  }
  return map;
}

async function fetchPivot(baseUrl: string, scope: GenomeScope, primary: string, secondary: string, limit: number | undefined, signal: AbortSignal | undefined): Promise<Record<string, Record<string, number>>> {
  const url = buildGenomeGeoPivotUrl(baseUrl, scope, primary, secondary, limit);
  const payload = await fetchOrganismSolrJson(url, `genome ${primary},${secondary} pivot`, signal);
  return parseSolrFacetPivot(payload, `${primary},${secondary}`);
}

async function fetchPivotOrEmpty(baseUrl: string, scope: GenomeScope, primary: string, secondary: string, limit: number | undefined, signal: AbortSignal | undefined): Promise<Record<string, Record<string, number>>> {
  try {
    return await fetchPivot(baseUrl, scope, primary, secondary, limit, signal);
  } catch (err) {
    // AbortError must propagate so callers can short-circuit on cancellation.
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    if (err instanceof Error && err.name === "AbortError") throw err;
    // Pivots are best-effort enrichment data. Log so operators have a signal
    // that a tooltip's "Top Genera"/"Top Hosts" section is empty due to error
    // rather than missing data.
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[geo-distribution] pivot ${primary},${secondary} failed: ${message}`);
    return {};
  }
}

async function fetchPivot3OrEmpty(baseUrl: string, scope: GenomeScope, primary: string, secondary: string, tertiary: string, limit: number | undefined, signal: AbortSignal | undefined): Promise<Record<string, Record<string, Record<string, number>>>> {
  const url = buildGenomeGeoPivot3Url(baseUrl, scope, primary, secondary, tertiary, limit);
  try {
    const payload = await fetchOrganismSolrJson(url, `genome ${primary},${secondary},${tertiary} pivot`, signal);
    return parseSolrFacetPivot3(payload, `${primary},${secondary},${tertiary}`);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    if (err instanceof Error && err.name === "AbortError") throw err;
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[geo-distribution] pivot ${primary},${secondary},${tertiary} failed: ${message}`);
    return {};
  }
}

function buildMeta(
  counts: Record<string, number>,
  genera: Record<string, Record<string, number>>,
  hosts: Record<string, Record<string, number>>,
): Record<string, OrganismGeoLocationMeta> {
  const meta: Record<string, OrganismGeoLocationMeta> = {};
  for (const [name, count] of Object.entries(counts)) {
    meta[name] = {
      count,
      genera: genera[name] ?? {},
      hosts: hosts[name] ?? {},
    };
  }
  return meta;
}

export async function fetchOrganismGeoDistribution(
  scope: GenomeScope,
  options: OrganismFetchOptions = {},
): Promise<OrganismGeoDistribution> {
  const baseUrl = getBvBrcWebsiteApiBaseUrl();
  const { signal } = options;

  const [
    countryData,
    stateData,
    countyPivot,
    countryGenera,
    countryHosts,
    stateGenera,
    stateHosts,
    countyGenera,
  ] = await Promise.all([
    fetchField(baseUrl, scope, "isolation_country", countryLimit, signal),
    fetchField(baseUrl, scope, "state_province", stateLimit, signal),
    // Pivot on state_province→county so each county is scoped to its state.
    // A flat `county` facet would merge same-named counties across states
    // (e.g. "Washington County" exists in 31 states) into a single key.
    fetchPivotOrEmpty(baseUrl, scope, "state_province", "county", countyLimit, signal),
    fetchPivotOrEmpty(baseUrl, scope, "isolation_country", "genus", undefined, signal),
    fetchPivotOrEmpty(baseUrl, scope, "isolation_country", "host_common_name", undefined, signal),
    fetchPivotOrEmpty(baseUrl, scope, "state_province", "genus", undefined, signal),
    fetchPivotOrEmpty(baseUrl, scope, "state_province", "host_common_name", undefined, signal),
    // 3-level pivot so each county genus map is scoped to its state. A flat
    // `county,genus` pivot would merge same-named counties (e.g. "Washington
    // County" in 31 states) into one merged genus breakdown.
    fetchPivot3OrEmpty(baseUrl, scope, "state_province", "county", "genus", countyLimit, signal),
  ]);

  // Build compound-keyed county maps: "StateName|CountyName" → value.
  // This ensures "Washington County, PA" and "Washington County, MD" are kept separate.
  const countyData: Record<string, number> = {};
  const countyMeta: Record<string, OrganismGeoLocationMeta> = {};
  for (const [stateName, counties] of Object.entries(countyPivot)) {
    for (const [countyName, count] of Object.entries(counties)) {
      const key = `${stateName}|${countyName}`;
      countyData[key] = count;
      const generaForState = (countyGenera as Partial<typeof countyGenera>)[stateName];
      const generaForCounty = generaForState
        ? (generaForState as Partial<typeof generaForState>)[countyName]
        : undefined;
      countyMeta[key] = {
        count,
        genera: generaForCounty ?? {},
        hosts: {},
      };
    }
  }

  return {
    countryData,
    countryMeta: buildMeta(countryData, countryGenera, countryHosts),
    stateData,
    stateMeta: buildMeta(stateData, stateGenera, stateHosts),
    countyData,
    countyMeta,
  };
}
