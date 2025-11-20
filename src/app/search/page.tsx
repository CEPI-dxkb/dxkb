"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  LuDna,
  LuBug,
  LuMicroscope,
  LuActivity,
  LuDatabase,
} from "react-icons/lu";
import { SearchBar } from "@/components/search/search-bar";
import { searchToQuery } from "@/app/search/search-to-query";
import ResultsOverview from "@/components/search/results-overview";

const bvbrcAPI = "https://p3.theseed.org/services/data_api/";

const searchTypes = [
  "taxonomy",
  "genome",
  "strain",
  "genome_feature",
  "sp_gene",
  "protein_feature",
  "epitope",
  "protein_structure",
  "pathway",
  "subsystem",
  "surveillance",
  "serology",
  "experiment",
  "antibiotics",
  "genome_sequence",
] as const;

const labelsByType: { [key: string]: string } = {
  taxonomy: "Taxa",
  genome: "Genomes",
  strain: "Strains",
  genome_feature: "Features",
  sp_gene: "Specialty Genes",
  protein_feature: "Domains and Motifs",
  epitope: "Epitopes",
  protein_structure: "Protein Structures",
  pathway: "Pathways",
  subsystem: "Subsystems",
  surveillance: "Surveillance",
  serology: "Serology",
  experiment: "Experiments",
  antibiotics: "Antibiotics",
  genome_sequence: "Genomic Sequences",
};

interface BVBRCAPIResponse {
  result: {
    response: {
      docs: any[];
      numFound: number;
      maxScore: number;
      numFoundExact: boolean;
    };
  };
}

interface SearchResults {
  [key: string]: BVBRCAPIResponse;
}

// Helper function to get the appropriate icon for each data type
function getDataTypeIcon(dataType: string) {
  switch (dataType) {
    case "genome":
      return <LuDna className="h-5 w-5" />;
    case "genome_feature":
      return <LuBug className="h-5 w-5" />;
    case "surveillance":
      return <LuActivity className="h-5 w-5" />;
    case "genome_sequence":
      return <LuDatabase className="h-5 w-5" />;
    default:
      return <LuMicroscope className="h-5 w-5" />;
  }
}

// Helper function to format the content based on data type
function getFormattedContent(doc: any, dataType: string) {
  switch (dataType) {
    case "antibiotics":
      return (
        <>
          <h3 className="search-result-header">{doc.antibiotic_name}</h3>
          <div className="search-result-metadata">
            <p
              dangerouslySetInnerHTML={{ __html: doc.description[0] }}
              className="search-result-description"
            />
          </div>
        </>
      );
    case "epitope":
      return (
        <>
          <h3 className="search-result-header">
            {doc.epitope_id} | {doc.epitope_sequence}
          </h3>
          <div className="search-result-metadata">
            <p>{doc.protein_name}</p>
            <p>{doc.organism}</p>
          </div>
        </>
      );
    case "experiment":
      return (
        <>
          <h3 className="search-result-header">
            {doc.exp_name} | {doc.exp_id}
          </h3>
          <div className="search-result-description">
            <p>{doc.exp_description}</p>
          </div>
        </>
      );
    case "genome":
      return (
        <>
          <h3 className="search-result-header">{doc.genome_name}</h3>
          <div className="search-result-metadata">
            <p>
              Genome ID: {doc.genome_id} | {doc.contigs} Contigs
            </p>
            <p>
              SEQUENCED: {new Date(doc.completion_date).toLocaleDateString()}{" "}
              {doc.sequencing_centers ? `by ${doc.sequencing_centers}` : ""}
            </p>
            {doc.collection_date && <p>COLLECTED: {doc.collection_date}</p>}
            {doc.host_name && <p>HOST: {doc.host_name}</p>}
            {doc.comments?.map((comment: string, i: number) => (
              <p key={i} className="mt-2 italic">
                {comment}
              </p>
            ))}
          </div>
        </>
      );
    case "genome_feature":
      return (
        <>
          <h3 className="search-result-header">
            {doc.product || doc.feature_type} {doc.gene && ` | ${doc.gene}`}
          </h3>
          <div className="search-result-metadata">
            <p>{doc.genome_name}</p>
            <p>
              {doc.annotation} | {doc.feature_type} | {doc.patric_id}
            </p>
          </div>
        </>
      );
    case "genome_sequence":
      return (
        <>
          <h3 className="search-result-header">{doc.genome_name}</h3>
          <div className="search-result-description">
            <p>
              {" "}
              {doc.accession} | {doc.description}{" "}
            </p>
          </div>
        </>
      );
    case "pathway":
      return (
        <>
          <h3 className="search-result-header">{doc.pathway_name}</h3>
          <div className="search-result-metadata">
            <p>
              {doc.product} | {doc.patric_id}
            </p>
            <p>{doc.genome_name}</p>
          </div>
        </>
      );
    case "protein_feature":
      return (
        <>
          <h3 className="search-result-header">
            {doc.source} | {doc.description}
          </h3>
          <div className="search-result-metadata">
            <p>{doc.genome_name}</p>
            <p>
              {doc.patric_id} | {doc.refseq_locus_tag}
            </p>
          </div>
        </>
      );
    case "protein_structure":
      return (
        <>
          <h3 className="search-result-header">
            {doc.pdb_id} | {doc.title}
          </h3>
          <div className="search-result-metadata">
            {doc.organism_name?.map((name: any, i: number) => (
              <p key={i}>{name}</p>
            ))}
          </div>
        </>
      );
    case "serology":
      return (
        <>
          <h3 className="search-result-header">
            {doc.sample_identifier} | {doc.host_identifier}
          </h3>
          <div className="search-result-metadata">
            <p>
              {doc.host_common_name} | {doc.collection_country} |{" "}
              {doc.host_health}
            </p>
          </div>
        </>
      );
    case "sp_gene":
      return (
        <>
          <h3 className="search-result-header">{doc.product}</h3>
          <div className="search-result-metadata">
            <p>{doc.genome_name}</p>
            <p>
              {doc.patric_id} | {doc.source} | {doc.evidence}
            </p>
          </div>
        </>
      );
    case "strain":
      return (
        <>
          <h3 className="search-result-header">{doc.strain}</h3>
          <div className="search-result-metadata">
            <p>{doc.species}</p>
          </div>
        </>
      );
    case "subsystem":
      return (
        <>
          <h3 className="search-result-header">{doc.subsystem_name}</h3>
          <div className="search-result-metadata">
            <p>
              {doc.product} | {doc.patric_id}
            </p>
            <p>{doc.genome_name}</p>
          </div>
        </>
      );
    case "surveillance":
      return (
        <>
          <h3 className="search-result-header">
            {doc.sample_identifier} | {doc.host_identifier}
          </h3>
          <div className="search-result-metadata">
            <p>
              ENV | {doc.collection_country} |{" "}
              {new Date(doc.collection_date).getFullYear()}
            </p>
          </div>
        </>
      );
    case "taxonomy":
      return (
        <>
          <h3 className="search-result-header">{doc.taxon_name}</h3>
          <div className="search-result-metadata">
            <p>{doc.genomes} Genomes</p>
            <p>Taxon ID: {doc.taxon_id}</p>
          </div>
        </>
      );
    default:
      return (
        <>
          <h3 className="search-result-header">
            {doc.name || doc.id || "Untitled"}
          </h3>
          {doc.description && (
            <p className="search-result-description">
              {doc.description}
            </p>
          )}
        </>
      );
  }
}

function SearchResultsContent() {
  const searchParams = useSearchParams();
  const [searchResults, setSearchResults] = useState<SearchResults>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const query = searchParams.get("q");
    const searchType = searchParams.get("searchtype");
    if (query) {
      fetchSearchResults(query);
    }
  }, [searchParams]);


  const fetchSearchResults = async (query: string) => {
    setIsLoading(true);
    try {
      const searchPayload: Record<string, any> = {};
      const processedQuery = processQuery(query);

      searchTypes.forEach((searchType) => {
        let tq = processedQuery;
        switch (searchType) {
          case "genome_feature":
            tq += "&ne(annotation,brc1)&ne(feature_type,source)";
            break;
          case "taxonomy":
            tq += "&gt(genomes,1)";
            break;
        }

        searchPayload[searchType] = {
          dataType: searchType,
          accept: "application/solr+json",
          query:
            searchType === "genome_feature"
              ? tq + "&limit(3)&sort(+annotation,-score)"
              : tq + "&limit(3)&sort(-score)",
        };
      });

      console.log("query is:", searchPayload);

      const response = await fetch(bvbrcAPI + "query/", {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(searchPayload),
      });

      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error("Error fetching search results:", error);
    } finally {
      setIsLoading(false);
    }

    console.log("results", searchResults);
  };

  const processQuery = (query: string) => {
    // replace some special characters
    let processedQuery = query.replace(/'/g, "").replace(/:/g, " ");

    // replace special words/characters
    processedQuery = processedQuery
      .replace(/\(\+\)/g, " ")
      .replace(/\(-\)/g, " ")
      .replace(/,|\+|-|=|<|>|\\|\//g, " ");

    // Handle quoted phrases
    if (
      processedQuery.charAt(0) == '"' &&
      processedQuery.match(/\(|\)|\[|\]|\{|\}/)
    ) {
      processedQuery = processedQuery.replace(/"/g, "");
    }

    // Handle special IDs
    if (
      processedQuery.charAt(0) != '"' ||
      processedQuery.match(/\(|\)|\[|\]|\{|\}/)
    ) {
      const keywords = processedQuery.split(/\s|\(|\)|\[|\]|\{|\}/);

      for (let i = 0; i < keywords.length; i++) {
        if (
          keywords[i].charAt(0) != '"' &&
          keywords[i].charAt(keywords[i].length - 1) != '"'
        ) {
          if (
            keywords[i].match(/^fig\|[0-9]+/) != null ||
            keywords[i].match(/[0-9]+\.[0-9]+/) != null ||
            keywords[i].match(/[0-9]+$/) != null
          ) {
            keywords[i] = '"' + keywords[i] + '"';
          }
        }
      }
      processedQuery = keywords.join(" ");
    }

    return searchToQuery(processedQuery);
  };

  // Filter out empty results and sort by numFound
  const validResults = Object.entries(searchResults)
    .filter(([_, data]) => data?.result?.response?.numFound > 0)
    .sort(
      ([_, a], [__, b]) =>
        (b?.result?.response?.numFound || 0) -
        (a?.result?.response?.numFound || 0),
    );

  // Add this before the return statement

  return (
    <div className="container mx-auto px-4 py-8">
      <SearchBar initialValue={searchParams.get("q") || ""} className="mb-8" />
      {isLoading ? (
        <div className="py-20 text-center">
          <p className="text-muted-foreground">Loading results...</p>
        </div>
      ) : validResults.length === 0 ? (
        <>
          <ResultsOverview isLoading={isLoading} searchResults={searchResults} labelsByType={labelsByType} />
          <div className="py-20 text-center">
              <h2 className="mb-4 text-2xl font-medium">No results found</h2>
            <p className="text-gray-600">Try different search terms or filters</p>
          </div>
        </>
      ) : (
        <>
          <ResultsOverview isLoading={isLoading} searchResults={searchResults} labelsByType={labelsByType} />

          <div className="space-y-8">
            {validResults.map(([dataType, data]) => {
              const docs = data.result.response?.docs || [];
              const numFound = data.result.response?.numFound || 0;

              if (numFound === 0) return null;

              return (
                <Card
                  key={dataType}
                  className="bg-card text-card-foreground gap-0 rounded-lg border py-0 shadow-sm px-4"
                >
                  <CardHeader className="flex flex-row items-center justify-between border-b p-6">
                    <div className="flex items-center gap-2">
                      {getDataTypeIcon(dataType)}
                      <CardTitle className="text-xl font-semibold capitalize">
                        {labelsByType[dataType]}
                      </CardTitle>
                    </div>
                    <Badge className="bg-secondary h-8 max-w-fit min-w-8 font-semibold text-white">
                      {numFound}
                    </Badge>
                  </CardHeader>
                  <CardContent className="divide-y">
                    {docs.map((doc: any, index: number) => (
                      <div key={doc.id || index} className="py-6">
                        {getFormattedContent(doc, dataType)}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default function SearchResultsPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-8">Loading search results...</div>}>
      <SearchResultsContent />
    </Suspense>
  );
}
