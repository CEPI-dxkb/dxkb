import { redirect } from "next/navigation";
import Link from "next/link";
import { SearchResults } from "@/app/all-term-search-results";
import { normalizeLegacyKeyword } from "@/app/search/legacy-keyword-normalization";
import { keywordQuery } from "@/lib/data-api/keyword-terms";
import {
  firstSearchParamValue,
  resolveLegacySearch,
} from "@/app/search/search-type-routing";
import type { SearchParamsRecord } from "@/lib/views/rql";
import { encodeQueryComponent } from "@/lib/url";

function SearchPrompt() {
  return (
    <div className="p-6 text-sm text-muted-foreground">
      Enter a search term to search across every BV-BRC data type.
    </div>
  );
}

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
            href={`/search?type=everything&q=${encodeQueryComponent(keyword)}`}
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
  if (keywordQuery(query).length === 0) return <SearchPrompt />;

  const target = resolveLegacySearch(params, query);
  switch (target.kind) {
    case "redirect":
      return redirect(target.href);
    case "allTypes":
      // Keyed by the search, so a new one starts unfolded and scrolled up.
      return <SearchResults key={query} query={query} />;
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
      // No `noImplicitReturns`, so a fifth target kind would otherwise return
      // `undefined` from a page component.
      const unhandled: never = target;
      throw new Error(`Unhandled search target: ${JSON.stringify(unhandled)}`);
    }
  }
}
