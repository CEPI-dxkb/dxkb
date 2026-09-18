import { redirect } from "next/navigation";
import Link from "next/link";
import { TypeSearch } from "@/app/search/typesearch";
import { SearchResults } from "@/app/all-term-search-results";
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

  // The first step is to get the search phrase in a friendly format.
  // This requires a handful of replacements to make sure we don't break the API
  let query = keyword.replace(/^\s+|\s+$/g, "");

  // replace some special characters
  query = query.replace(/'/g, "").replace(/:/g, " ");

  // replace special words/characters: (+), (-), +, - , <, >, /, \ with a space as they are causing solr query problems when included in the keywords
  query = query
    .replace(/\(\+\)/g, " ")
    .replace(/\(-\)/g, " ")
    .replace(/,|\+|-|=|<|>|\\|\//g, " ");

  // When query phrase is quoted, the whole phrase should be search as one keyword unless it contains (), {}, []
  // e.g. "EC 2.1.1.1" should be search as "EC 3.2.1.1" not "EC AND 3.2.1.1"
  // However if user specify "amylase (EC 3.2.1.1)", "amylase (EC 3.2.1.1)" can not be submitted as solr query as it contains ()
  if (query.charAt(0) == '"' && query.match(/\(|\)|\[|\]|\{|\}/)) {
    query = query.replace(/"/g, "");
  }

  // This handles special implementation of doing exact search for possible ids such as fig id, EC number etc.
  // When these id patterns are detected, quotes will be added for them in the search term
  if (query.charAt(0) != '"' || query.match(/\(|\)|\[|\]|\{|\}/)) {
    // keywords should not include {}, [] or () characters
    const keywords = query.split(/\s|\(|\)|\[|\]|\{|\}/);
    // console.log("keywords", keywords);

    // Add quotes for IDs: handle fig id (e.g. fig|83332.12.peg.1),  genome id (e.g. 83332.12), EC number (e.g. 2.1.1.1), other ids with number.number, number only, IDs ending with numbers (at least 1 digit).
    for (let i = 0; i < keywords.length; i++) {
      if (
        keywords[i].charAt(0) != '"' &&
        keywords[i].charAt(keywords[i].length - 1) != '"'
      ) {
        // if not already quoted
        // if (keywords[i].match(/^fig\|[0-9]+/) != null || keywords[i].match(/[0-9]+\.[0-9]+/) != null || keywords[i].match(/^[0-9]+$/) != null || keywords[i].match(/[0-9]+$/) != null){
        if (
          keywords[i].match(/^fig\|[0-9]+/) != null ||
          keywords[i].match(/[0-9]+\.[0-9]+/) != null ||
          keywords[i].match(/[0-9]+$/) != null
        ) {
          keywords[i] = '"' + keywords[i] + '"';
        }
      }
    }
    query = keywords.join(" ");
  }

  query = query.trim();
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
