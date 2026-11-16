// The browser sends only the keyword; the route builds every query here so it never forwards caller-written RQL with the caller's token.

import { allTermSearchTypes } from "@/constants/search-info";
import type { DataApiMultiQuery } from "@/lib/data-api/repository";
import { keywordQuery } from "@/lib/data-api/keyword-terms";
import { keywordClauses } from "@/lib/data-api/rql";
import {
  genomeScopeRql,
  nonDeprecatedGenomeClause,
} from "@/lib/services/organisms/genome-scope";
import { rqlAnd } from "@/lib/views/rql";

/** Rows each type shows at first and after "Show more"; all are fetched up front so columns size for every row. */
export const previewRowCount = 5;
export const expandedRowCount = 10;

export const maxSearchKeywordLength = 500;

/** Text without terms (blank, `""`, a lone `OR`) would build an empty and(), which the Data API rejects. */
export function isSearchableKeyword(keyword: string): boolean {
  return keywordQuery(keyword).length > 0;
}

export function typeSearchQuery(
  id: string,
  keyword: string,
  limit: number,
): string {
  let query = rqlAnd(...keywordClauses(keyword, "exact"));
  if (id === "genome_feature")
    query += "&ne(annotation,brc1)&ne(feature_type,source)";
  // As the `/genome?keyword=` list it links to (`genomeBaseRql`), so the card counts its rows.
  if (id === "genome") query += `&${nonDeprecatedGenomeClause}`;
  // The stored `genomes` field only filters and ranks Taxa; the count shown comes from `taxonGenomeCountQueries`.
  if (id === "taxonomy") query += "&gt(genomes,1)";
  // Taxa by genome count, not score: score ranks "Swine influenza virus" (166 genomes) above "Influenza A virus" (1.9M).
  const sort =
    id === "genome_feature"
      ? "+annotation,-score"
      : id === "taxonomy"
        ? "-genomes"
        : "-score";
  return `${query}&limit(${String(limit)})&sort(${sort})`;
}

export function allTypesSearchQueries(
  keyword: string,
  limit = expandedRowCount,
): Record<string, DataApiMultiQuery> {
  return Object.fromEntries(
    allTermSearchTypes.map((type) => [
      type.id,
      {
        dataType: type.id,
        accept: "application/solr+json",
        query: typeSearchQuery(type.id, keyword, limit),
      },
    ]),
  );
}

export const taxonGenomeCountKeyPrefix = "taxonGenomes:";

/** The per-taxon genome count the Taxonomy header shows (lineage less Deprecated), as a `limit(1)` count query per taxon. `taxonIds` must be digit strings: the route filters them before calling. */
export function taxonGenomeCountQueries(
  taxonIds: readonly string[],
): Record<string, DataApiMultiQuery> {
  return Object.fromEntries(
    taxonIds.map((taxonId) => [
      `${taxonGenomeCountKeyPrefix}${taxonId}`,
      {
        dataType: "genome",
        accept: "application/solr+json",
        query: `${genomeScopeRql(Number(taxonId))}&select(genome_id)&limit(1)`,
      },
    ]),
  );
}
