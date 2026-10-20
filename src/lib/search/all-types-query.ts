// The all-data-types search's one Data API request, as both sides need it:
// the browser sends only the keyword to `/api/data/search`, and the route
// builds every type's query here. So the route never forwards RQL a caller
// wrote, with the caller's token, to the Data API.

import { allTermSearchTypes } from "@/constants/search-info";
import type { DataApiMultiQuery } from "@/lib/data-api/repository";
import { keywordQuery } from "@/lib/data-api/keyword-terms";
import { keywordClauses } from "@/lib/data-api/rql";
import { rqlAnd } from "@/lib/views/rql";

/**
 * Rows each type shows at first, and after "Show more". All of them are
 * fetched up front, so a table sizes its columns for every row it can show and
 * "Show more" moves none of them.
 */
export const previewRowCount = 5;
export const expandedRowCount = 10;

/** The longest keyword the search route takes: the collection gateway's cap. */
export const maxSearchKeywordLength = 500;

/**
 * Whether `keyword` (normalized text) has a term to search. Text without terms
 * (blank, `""`, a lone `OR`, only syntax) would build an empty and(), which
 * the Data API rejects.
 */
export function isSearchableKeyword(keyword: string): boolean {
  return keywordQuery(keyword).length > 0;
}

/**
 * One type's query: the keyword clauses the type's own list builds for its
 * `?keyword=` (`keywordClauses`), so a count is the total the list it links to
 * shows.
 */
export function typeSearchQuery(
  id: string,
  keyword: string,
  limit: number,
): string {
  let query = rqlAnd(...keywordClauses(keyword, "exact"));
  if (id === "genome_feature")
    query += "&ne(annotation,brc1)&ne(feature_type,source)";
  if (id === "taxonomy") query += "&gt(genomes,1)";
  // Taxa by genome count, not score: score puts "Swine influenza virus" (166
  // genomes) above "Influenza A virus" (1.9M) for `influenza`.
  const sort =
    id === "genome_feature"
      ? "+annotation,-score"
      : id === "taxonomy"
        ? "-genomes"
        : "-score";
  return `${query}&limit(${String(limit)})&sort(${sort})`;
}

/** Every DXKB type's top `limit` matches for `keyword`, keyed by type. */
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
