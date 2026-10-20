import type { OrganismFetchOptions, SerotypeDistributionData, SerotypeYear } from "./types";
import {
  fetchOrganismSolrJson,
  getBvBrcWebsiteApiBaseUrl,
  parseSolrFacetPivot,
} from "./utils";

function parseSerotypeDistributionPivot(
  payload: Record<string, unknown>,
): { year: number; serovars: Record<string, number> }[] {
  // Use the shared facet-pivot parser; serotype just narrows the outer key from
  // string to numeric year. SOLR with `application/solr+json` may emit those
  // years as strings, so coerce here.
  const generic = parseSolrFacetPivot(payload, "collection_year,serovar");
  const rows: { year: number; serovars: Record<string, number> }[] = [];
  for (const [outerKey, inner] of Object.entries(generic)) {
    const year = Number(outerKey);
    if (!Number.isInteger(year)) continue;
    rows.push({ year, serovars: inner });
  }
  return rows;
}

function transformPivot(
  rows: { year: number; serovars: Record<string, number> }[],
): SerotypeDistributionData {
  if (rows.length === 0) return { years: [], serovars: [] };

  const allYears = rows.map((r) => r.year).sort((a, b) => a - b);
  const maxYear = allYears[allYears.length - 1];
  const startYear = maxYear - 9;

  const filtered = rows.filter((r) => r.year >= startYear);

  // Sum each serovar across the filtered window
  const serovarTotals: Record<string, number> = {};
  for (const row of filtered) {
    for (const [sv, count] of Object.entries(row.serovars)) {
      serovarTotals[sv] = (serovarTotals[sv] ?? 0) + count;
    }
  }

  const topSerovars = Object.entries(serovarTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([sv]) => sv);

  const years: SerotypeYear[] = filtered
    .sort((a, b) => a.year - b.year)
    .map(({ year, serovars }) => {
      const yearEntry: SerotypeYear = { year };
      for (const sv of topSerovars) {
        yearEntry[sv] = serovars[sv] ?? 0;
      }
      return yearEntry;
    });

  return { years, serovars: topSerovars };
}

export async function fetchSerotypeDistribution(
  taxonId: number,
  options: OrganismFetchOptions = {},
): Promise<SerotypeDistributionData> {
  const baseUrl = getBvBrcWebsiteApiBaseUrl();
  const url =
    `${baseUrl}/genome/?eq(taxon_lineage_ids,${String(taxonId)})` +
    `&facet((pivot,(collection_year,serovar)),(mincount,1))&limit(0)`;

  const payload = await fetchOrganismSolrJson(
    url,
    { source: "genome collection_year,serovar pivot", label: "Serotype Distribution" },
    options.signal,
  );
  const rows = parseSerotypeDistributionPivot(payload);
  return transformPivot(rows);
}
