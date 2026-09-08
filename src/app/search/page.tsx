import { redirect } from "next/navigation";
import { TypeSearch } from "@/app/search/typesearch";
import { SearchResults } from "@/app/all-term-search-results";
import type { SearchParamsRecord } from "@/lib/views/rql";

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function experimentRedirect(
  params: SearchParamsRecord,
  searchtype: string,
  query: string,
): string {
  const destination = new URLSearchParams();
  const tabs = Array.isArray(params.tab) ? params.tab : [params.tab];
  const biosetsRequested =
    searchtype === "bioset" ||
    tabs.includes("bioset") ||
    tabs.includes("biosets");

  for (const [name, value] of Object.entries(params)) {
    if (name === "type" || value === undefined) continue;
    if (name === "tab" && biosetsRequested) {
      destination.set("tab", "biosets");
      continue;
    }
    if (name === "q") {
      destination.set("keyword", query);
      continue;
    }
    for (const item of Array.isArray(value) ? value : [value]) {
      destination.append(name, item);
    }
  }
  if (biosetsRequested && !destination.has("tab")) {
    destination.set("tab", "biosets");
  }

  return `/experiment${destination.size ? `?${destination}` : ""}`;
}

export default async function GlobalSearch({
  searchParams,
}: {
  searchParams: Promise<SearchParamsRecord>;
}) {
  const params = await searchParams;
  const keyword = firstValue(params.q);
  const searchtype = firstValue(params.type);

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

  // Now that we have the entire query formatted properly, let's figure out where to send it...
  if (searchtype === "experiment" || searchtype === "bioset") {
    redirect(experimentRedirect(params, searchtype, query));
  }

  if (searchtype === "everything") {
    return <SearchResults query={query} />;
  } else if (
    [
      "genome",
      "strain",
      "genome_feature",
      "protein_feature",
      "epitope",
      "protein_structure",
      "surveillance",
      "serology",
      "taxonomy",
      "genome_sequence",
      "genome_amr",
    ].includes(searchtype)
  ) {
    return <TypeSearch q={query} searchtype={searchtype} />;
  } else {
    return <div>Fallback search</div>;
  }
}
