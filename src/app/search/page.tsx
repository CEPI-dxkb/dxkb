import { redirect } from "next/navigation";
import Link from "next/link";
import { TypeSearch } from "@/app/search/typesearch";
import { SearchResults } from "@/app/all-term-search-results";
import { normalizeLegacyKeyword } from "@/app/search/legacy-keyword-normalization";
import {
  firstSearchParamValue,
  resolveLegacySearch,
} from "@/app/search/search-type-routing";
import type { SearchParamsRecord } from "@/lib/views/rql";

/** Overview with nothing to search for yet. */
function SearchPrompt() {
  return (
    <div className="p-6 text-sm text-muted-foreground">
      Enter a search term to search across every BV-BRC data type.
    </div>
  );
}

/**
 * A legacy `type=` value this app has no view for (Specialty Genes, Pathways,
 * Subsystems, Antibiotics, or a typo). The all-data-types results are the only
 * honest destination we can offer for the phrase that was searched.
 */
function UnsupportedSearchType({
  searchtype,
  keyword,
}: {
  searchtype: string;
  keyword: string;
}) {
  return (
    <div className="space-y-2 p-6 text-sm text-muted-foreground">
      <p>There is no search view for &ldquo;{searchtype}&rdquo;.</p>
      {keyword ? (
        <p>
          <Link
            className="underline underline-offset-4"
            href={`/search?type=everything&q=${encodeURIComponent(keyword)}`}
          >
            Search all data types for &ldquo;{keyword}&rdquo;
          </Link>{" "}
          instead.
        </p>
      ) : null}
    </div>
  );
}

export default async function GlobalSearch({
  searchParams,
}: {
  searchParams: Promise<SearchParamsRecord>;
}) {
  const params = await searchParams;
  const keyword = firstSearchParamValue(params.q);
  const query = normalizeLegacyKeyword(keyword);
  if (!query) return <SearchPrompt />;

  // Now that we have the entire query formatted properly, let's figure out where
  // to send it. Every legacy type resolves through the descriptors, so marking a
  // descriptor canonical is all it takes to redirect its legacy URL.
  const target = resolveLegacySearch(params, query);
  switch (target.kind) {
    case "redirect":
      return redirect(target.href);
    case "allTypes":
      return <SearchResults query={query} />;
    case "typeSearch":
      return <TypeSearch q={query} searchtype={target.searchtype} />;
    case "prompt":
      return <SearchPrompt />;
    case "unsupported":
      return (
        <UnsupportedSearchType
          searchtype={target.searchtype}
          keyword={query}
        />
      );
    default: {
      // The whole point of this module is that the branch table is total, and
      // neither `noImplicitReturns` nor an explicit return type is in force
      // here — so a sixth target kind would otherwise compile and return
      // `undefined` from a page component.
      const unhandled: never = target;
      throw new Error(`Unhandled search target: ${JSON.stringify(unhandled)}`);
    }
  }
}
