import type {
  OrganismFetchOptions,
  OrganismGeoDistribution,
  OrganismGeoLocationMeta,
} from "./types";
import { describeGenomeScope, type GenomeScope } from "./genome-scope";
import { formatUserFacingErrorMessage } from "@/lib/utils";
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
const stateLimit = 1000;
const countyLimit = 1000;

async function fetchField(baseUrl: string, scope: GenomeScope, field: string, limit: number | undefined, signal: AbortSignal | undefined): Promise<Record<string, number>> {
  const url = buildGenomeGeoFacetUrl(baseUrl, scope, field, limit);
  const payload = await fetchOrganismSolrJson(url, { source: `genome ${field} facet` }, signal);
  const list = parseSolrFacetList(payload, field);
  const map: Record<string, number> = {};
  for (const item of list) {
    if (item.name && item.count > 0) map[item.name] = item.count;
  }
  return map;
}

async function fetchPivot(baseUrl: string, scope: GenomeScope, primary: string, secondary: string, limit: number | undefined, signal: AbortSignal | undefined): Promise<Record<string, Record<string, number>>> {
  const url = buildGenomeGeoPivotUrl(baseUrl, scope, primary, secondary, limit);
  const payload = await fetchOrganismSolrJson(url, { source: `genome ${primary},${secondary} pivot` }, signal);
  return parseSolrFacetPivot(payload, `${primary},${secondary}`);
}

async function fetchPivotOrEmpty(baseUrl: string, scope: GenomeScope, primary: string, secondary: string, limit: number | undefined, signal: AbortSignal | undefined): Promise<Record<string, Record<string, number>>> {
  try {
    return await fetchPivot(baseUrl, scope, primary, secondary, limit, signal);
  } catch (err) {
    // AbortError must propagate so callers can short-circuit on cancellation.
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    if (err instanceof Error && err.name === "AbortError") throw err;
    // Pivots are best-effort enrichment; log so an empty tooltip section is
    // distinguishable from missing data.
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[geo-distribution] pivot ${primary},${secondary} failed: ${message}`);
    return {};
  }
}

interface CountyPivotResult {
  pivot: Record<string, Record<string, number>>;
  /** Set when the pivot failed; the map says so instead of claiming there are no counties. */
  error?: string;
}

/** The state to county counts. Unlike the tooltip pivots, a failure is reported, not hidden. */
async function fetchCountyPivot(baseUrl: string, scope: GenomeScope, limit: number, signal: AbortSignal | undefined): Promise<CountyPivotResult> {
  try {
    return { pivot: await fetchPivot(baseUrl, scope, "state_province", "county", limit, signal) };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    if (err instanceof Error && err.name === "AbortError") throw err;
    const error = formatUserFacingErrorMessage(err, "The county counts could not be loaded.");
    console.warn(`[geo-distribution] county pivot failed for ${describeGenomeScope(scope)}: ${error}`);
    return { pivot: {}, error };
  }
}

async function fetchPivot3OrEmpty(baseUrl: string, scope: GenomeScope, primary: string, secondary: string, tertiary: string, limit: number | undefined, signal: AbortSignal | undefined): Promise<Record<string, Record<string, Record<string, number>>>> {
  const url = buildGenomeGeoPivot3Url(baseUrl, scope, primary, secondary, tertiary, limit);
  try {
    const payload = await fetchOrganismSolrJson(url, { source: `genome ${primary},${secondary},${tertiary} pivot` }, signal);
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
    countyResult,
    countryGenera,
    countryHosts,
    stateGenera,
    stateHosts,
    countyGenera,
  ] = await Promise.all([
    fetchField(baseUrl, scope, "isolation_country", countryLimit, signal),
    fetchField(baseUrl, scope, "state_province", stateLimit, signal),
    // Pivot on state_province→county; a flat `county` facet would merge
    // same-named counties across states.
    fetchCountyPivot(baseUrl, scope, countyLimit, signal),
    fetchPivotOrEmpty(baseUrl, scope, "isolation_country", "genus", undefined, signal),
    fetchPivotOrEmpty(baseUrl, scope, "isolation_country", "host_common_name", undefined, signal),
    fetchPivotOrEmpty(baseUrl, scope, "state_province", "genus", undefined, signal),
    fetchPivotOrEmpty(baseUrl, scope, "state_province", "host_common_name", undefined, signal),
    fetchPivot3OrEmpty(baseUrl, scope, "state_province", "county", "genus", countyLimit, signal),
  ]);

  const countyData: Record<string, number> = {};
  const countyMeta: Record<string, OrganismGeoLocationMeta> = {};
  for (const [stateName, counties] of Object.entries(countyResult.pivot)) {
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
    ...(countyResult.error ? { countyError: countyResult.error } : {}),
  };
}
