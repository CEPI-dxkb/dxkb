"use client"

import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { searchToQuery } from "../../functions/searchToQuery";
import { TypeSearch } from "../search/typesearch";
import { SearchResults } from "../allTermSearchResults";

export default function GlobalSearch () {

      const router = useRouter();
      const searchParams = useSearchParams();

      // Get the value of a specific query parameter
      const keyword = searchParams.get("q") ?? "";
      const searchtype = searchParams.get('searchtype') ?? "";
      
      // The first step is to get the search phrase in a friendly format.
      // This requires a handful of replacements to make sure we don't break the API
      var query = keyword.replace(/^\s+|\s+$/g, '');

      // replace some special characters
      query = query.replace(/'/g, '').replace(/:/g, ' ');
      // console.log("query", query);

      // replace special words/characters: (+), (-), +, - , <, >, /, \ with a space as they are causing solr query problems when included in the keywords
      query =  query.replace(/\(\+\)/g, ' ').replace(/\(-\)/g, ' ').replace(/,|\+|-|=|<|>|\\|\//g, ' ');
      // console.log("query", query);

      // When query phrase is quoted, the whole phrase should be search as one keyword unless it contains (), {}, []
      // e.g. "EC 2.1.1.1" should be search as "EC 3.2.1.1" not "EC AND 3.2.1.1"
      // However if user specify "amylase (EC 3.2.1.1)", "amylase (EC 3.2.1.1)" can not be submitted as solr query as it contains ()
      if (query.charAt(0) == '"' && query.match(/\(|\)|\[|\]|\{|\}/)) {
      query =  query.replace(/"/g, '');
      }

      // This handles special implementation of doing exact search for possible ids such as fig id, EC number etc.
      // When these id patterns are detected, quotes will be added for them in the search term
      if (query.charAt(0) != '"' || query.match(/\(|\)|\[|\]|\{|\}/)) {

      // keywords should not include {}, [] or () characters
      var keywords = query.split(/\s|\(|\)|\[|\]|\{|\}/);
      // console.log("keywords", keywords);

      // Add quotes for IDs: handle fig id (e.g. fig|83332.12.peg.1),  genome id (e.g. 83332.12), EC number (e.g. 2.1.1.1), other ids with number.number, number only, IDs ending with numbers (at least 1 digit).
      for (var i = 0; i < keywords.length; i++) {
         if (keywords[i].charAt(0) != '"' && keywords[i].charAt(keywords[i].length - 1) != '"') { // if not already quoted
            // if (keywords[i].match(/^fig\|[0-9]+/) != null || keywords[i].match(/[0-9]+\.[0-9]+/) != null || keywords[i].match(/^[0-9]+$/) != null || keywords[i].match(/[0-9]+$/) != null){
            if (keywords[i].match(/^fig\|[0-9]+/) != null || keywords[i].match(/[0-9]+\.[0-9]+/) != null || keywords[i].match(/[0-9]+$/) != null) {
            keywords[i] = '"' + keywords[i] + '"';
            }
         }
      }
      query = keywords.join(' ');
      }

      // Now that we have the phrasing set, let's build the query into the proper
      var q = searchToQuery(query);

      // Now that we have the entire query formatted properly, let's figure out where to send it...
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
            "experiment",
          ].includes(searchtype)
        ) {
          return <TypeSearch q={query} searchtype={searchtype} />;
        } else {
          console.log("Do Search: ", searchtype, query);
          return <div>Fallback search</div>;
        }

}
