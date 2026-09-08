"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  timeZone: "UTC",
});
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dna, Bug, Microscope, Activity, Database } from "lucide-react";
import { searchToQuery } from "@/app/search/search-to-query";
import ResultsOverview from "@/components/search/results-overview";
import {
  allTermSearchTypes,
  labelsBySearchType,
  searchHref,
} from "@/constants/search-info";
import {
  epitopeHref,
  epitopeIdFromRow,
  experimentHref,
  experimentIdFromRow,
  featureHref,
  featureIdFromRow,
  genomeHref,
  proteinStructureHref,
  serologyHref,
  serologyIdFromRow,
  surveillanceHref,
  surveillanceIdFromRow,
} from "@/lib/views/hrefs";

const bvbrcAPI = "https://p3.theseed.org/services/data_api/";

interface BVBRCAPIResponse {
  result: {
    response: {
      docs: unknown[];
      numFound: number;
      maxScore: number;
      numFoundExact: boolean;
    };
  };
}

type SearchResults = Record<string, BVBRCAPIResponse>;

const allTermSearchTypesById = new Map(
  allTermSearchTypes.map((searchType) => [searchType.id, searchType]),
);

function getSearchResultsHref(dataType: string, query: string): string | null {
  const searchType = allTermSearchTypesById.get(dataType);
  return searchType?.route.status === "canonical"
    ? searchHref(searchType, query)
    : null;
}

// ---- make this top-level (outside components) ----
function processQuery(query: string) {
  let processedQuery = query.replace(/'/g, "").replace(/:/g, " ");

  processedQuery = processedQuery
    .replace(/\(\+\)/g, " ")
    .replace(/\(-\)/g, " ")
    .replace(/,|\+|-|=|<|>|\\|\//g, " ");

  if (
    processedQuery.charAt(0) == '"' &&
    processedQuery.match(/\(|\)|\[|\]|\{|\}/)
  ) {
    processedQuery = processedQuery.replace(/"/g, "");
  }

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
          keywords[i].match(/^fig\|[0-9]+/) ||
          keywords[i].match(/[0-9]+\.[0-9]+/) ||
          keywords[i].match(/[0-9]+$/)
        ) {
          keywords[i] = `"${keywords[i]}"`;
        }
      }
    }
    processedQuery = keywords.join(" ");
  }

  return searchToQuery(processedQuery);
}
// ---------------------------------------------------

async function fetchSearchResults(query: string): Promise<SearchResults> {
  const searchPayload: Record<string, unknown> = {};
  const processedQuery = processQuery(query);

  allTermSearchTypes.forEach(({ id: searchType }) => {
    let typeQuery = processedQuery;
    switch (searchType) {
      case "genome_feature":
        typeQuery += "&ne(annotation,brc1)&ne(feature_type,source)";
        break;
      case "taxonomy":
        typeQuery += "&gt(genomes,1)";
        break;
    }

    searchPayload[searchType] = {
      dataType: searchType,
      accept: "application/solr+json",
      query:
        searchType === "genome_feature"
          ? typeQuery + "&limit(3)&sort(+annotation,-score)"
          : typeQuery + "&limit(3)&sort(-score)",
    };
  });

  const response = await fetch(bvbrcAPI + "query/", {
    method: "POST",
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(searchPayload),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Search request failed with status ${String(response.status)}`,
    );
  }

  return (await response.json()) as SearchResults;
}

// Helper function to get the appropriate icon for each data type
function getDataTypeIcon(dataType: string) {
  switch (dataType) {
    case "genome":
      return <Dna className="size-5" />;
    case "genome_feature":
      return <Bug className="size-5" />;
    case "surveillance":
      return <Activity className="size-5" />;
    case "genome_sequence":
      return <Database className="size-5" />;
    default:
      return <Microscope className="size-5" />;
  }
}

// Helper to render unknown as React node
function R(x: unknown): React.ReactNode {
  return x as React.ReactNode;
}

// Helper function to format the content based on data type
function getFormattedContent(doc: Record<string, unknown>, dataType: string) {
  switch (dataType) {
    case "antibiotics":
      return (
        <>
          <h3 className="search-result-header">{R(doc.antibiotic_name)}</h3>
          <div className="search-result-metadata">
            <p
              dangerouslySetInnerHTML={{
                __html: String(
                  (Array.isArray(doc.description)
                    ? doc.description[0]
                    : doc.description) ?? "",
                ),
              }}
              className="search-result-description"
            />
          </div>
        </>
      );
    case "epitope":
      return (
        <>
          <h3 className="search-result-header">
            {R(doc.epitope_id)} | {R(doc.epitope_sequence)}
          </h3>
          <div className="search-result-metadata">
            <p>{R(doc.protein_name)}</p>
            <p>{R(doc.organism)}</p>
          </div>
        </>
      );
    case "experiment":
      return (
        <>
          <h3 className="search-result-header">
            {R(doc.exp_name)} | {R(doc.exp_id)}
          </h3>
          <div className="search-result-description">
            <p>{R(doc.exp_description)}</p>
          </div>
        </>
      );
    case "genome":
      return (
        <>
          <h3 className="search-result-header">{R(doc.genome_name)}</h3>
          <div className="search-result-metadata">
            <p>
              Genome ID: {R(doc.genome_id)} | {R(doc.contigs)} Contigs
            </p>
            <p>
              SEQUENCED:{" "}
              {doc.completion_date != null
                ? dateFormatter.format(new Date(doc.completion_date as string))
                : ""}{" "}
              {doc.sequencing_centers
                ? `by ${Array.isArray(doc.sequencing_centers) ? (doc.sequencing_centers as string[]).join(", ") : (doc.sequencing_centers as string)}`
                : ""}
            </p>
            {doc.collection_date != null && (
              <p>COLLECTED: {R(doc.collection_date)}</p>
            )}
            {doc.host_name != null && <p>HOST: {R(doc.host_name)}</p>}
            {Array.isArray(doc.comments) &&
              doc.comments.map((comment: unknown) => (
                <p key={String(comment)} className="mt-2 italic">
                  {R(comment)}
                </p>
              ))}
          </div>
        </>
      );
    case "genome_feature":
      return (
        <>
          <h3 className="search-result-header">
            {R(doc.product) || R(doc.feature_type)}{" "}
            {doc.gene != null && ` | ${doc.gene as string}`}
          </h3>
          <div className="search-result-metadata">
            <p>{R(doc.genome_name)}</p>
            <p>
              {R(doc.annotation)} | {R(doc.feature_type)} | {R(doc.patric_id)}
            </p>
          </div>
        </>
      );
    case "genome_sequence":
      return (
        <>
          <h3 className="search-result-header">{R(doc.genome_name)}</h3>
          <div className="search-result-description">
            <p>
              {" "}
              {R(doc.accession)} | {R(doc.description)}{" "}
            </p>
          </div>
        </>
      );
    case "pathway":
      return (
        <>
          <h3 className="search-result-header">{R(doc.pathway_name)}</h3>
          <div className="search-result-metadata">
            <p>
              {R(doc.product)} | {R(doc.patric_id)}
            </p>
            <p>{R(doc.genome_name)}</p>
          </div>
        </>
      );
    case "protein_feature":
      return (
        <>
          <h3 className="search-result-header">
            {R(doc.source)} | {R(doc.description)}
          </h3>
          <div className="search-result-metadata">
            <p>{R(doc.genome_name)}</p>
            <p>
              {R(doc.patric_id)} | {R(doc.refseq_locus_tag)}
            </p>
          </div>
        </>
      );
    case "protein_structure":
      return (
        <>
          <h3 className="search-result-header">
            {R(doc.pdb_id)} | {R(doc.title)}
          </h3>
          <div className="search-result-metadata">
            {Array.isArray(doc.organism_name) &&
              doc.organism_name.map((name: unknown) => (
                <p key={String(name)}>{R(name)}</p>
              ))}
          </div>
        </>
      );
    case "serology":
      return (
        <>
          <h3 className="search-result-header">
            {R(doc.sample_identifier)} | {R(doc.host_identifier)}
          </h3>
          <div className="search-result-metadata">
            <p>
              {R(doc.host_common_name)} | {R(doc.collection_country)} |{" "}
              {R(doc.host_health)}
            </p>
          </div>
        </>
      );
    case "sp_gene":
      return (
        <>
          <h3 className="search-result-header">{R(doc.product)}</h3>
          <div className="search-result-metadata">
            <p>{R(doc.genome_name)}</p>
            <p>
              {R(doc.patric_id)} | {R(doc.source)} | {R(doc.evidence)}
            </p>
          </div>
        </>
      );
    case "strain":
      return (
        <>
          <h3 className="search-result-header">{R(doc.strain)}</h3>
          <div className="search-result-metadata">
            <p>{R(doc.species)}</p>
          </div>
        </>
      );
    case "subsystem":
      return (
        <>
          <h3 className="search-result-header">{R(doc.subsystem_name)}</h3>
          <div className="search-result-metadata">
            <p>
              {R(doc.product)} | {R(doc.patric_id)}
            </p>
            <p>{R(doc.genome_name)}</p>
          </div>
        </>
      );
    case "surveillance":
      return (
        <>
          <h3 className="search-result-header">
            {R(doc.sample_identifier)} | {R(doc.host_identifier)}
          </h3>
          <div className="search-result-metadata">
            <p>
              ENV | {R(doc.collection_country)} |{" "}
              {doc.collection_date != null
                ? new Date(doc.collection_date as string | number).getFullYear()
                : ""}
            </p>
          </div>
        </>
      );
    case "taxonomy":
      return (
        <>
          <h3 className="search-result-header">{R(doc.taxon_name)}</h3>
          <div className="search-result-metadata">
            <p>{R(doc.genomes)} Genomes</p>
            <p>Taxon ID: {R(doc.taxon_id)}</p>
          </div>
        </>
      );
    default:
      return (
        <>
          <h3 className="search-result-header">
            {R(doc.name) || R(doc.id) || "Untitled"}
          </h3>
          {doc.description != null && (
            <p className="search-result-description">{R(doc.description)}</p>
          )}
        </>
      );
  }
}

function SearchResultsContent({ query }: { query: string }) {
  const {
    data: searchResults = {},
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["all-term-search-results", query],
    queryFn: () => fetchSearchResults(query),
    enabled: Boolean(query),
    retry: false,
    staleTime: 0,
  });

  // Filter out empty results and sort by numFound
  const validResults = Object.entries(searchResults)
    .filter(([_, data]) => data.result.response.numFound > 0)
    .sort(
      ([_, a], [__, b]) =>
        b.result.response.numFound - a.result.response.numFound,
    );

  // Add this before the return statement

  return (
    <div className="container mx-auto px-4 py-8">
      {isLoading ? (
        <div className="py-20 text-center">
          <p className="text-muted-foreground">Loading results...</p>
        </div>
      ) : isError ? (
        <div className="py-20 text-center" role="alert">
          <h2 className="mb-4 text-2xl font-medium">Search unavailable</h2>
          <p className="text-muted-foreground">
            Search results could not be loaded. Please try again.
          </p>
        </div>
      ) : validResults.length === 0 ? (
        <>
          <ResultsOverview
            isLoading={isLoading}
            searchResults={searchResults}
            labelsByType={labelsBySearchType}
          />
          <div className="py-20 text-center">
            <h2 className="mb-4 text-2xl font-medium">No results found</h2>
            <p className="text-gray-600">
              Try different search terms or filters
            </p>
          </div>
        </>
      ) : (
        <>
          <ResultsOverview
            isLoading={isLoading}
            searchResults={searchResults}
            labelsByType={labelsBySearchType}
          />

          <div className="space-y-8">
            {validResults.map(([dataType, data]) => {
              const docs = data.result.response.docs;
              const numFound = data.result.response.numFound;
              const searchResultsHref = getSearchResultsHref(dataType, query);

              if (numFound === 0) return null;

              return (
                <Card
                  key={dataType}
                  className="gap-0 rounded-lg border bg-card px-4 py-0 text-card-foreground shadow-sm"
                >
                  <CardHeader className="flex flex-row items-center justify-between border-b p-6">
                    <div className="flex items-center gap-2">
                      {getDataTypeIcon(dataType)}
                      <CardTitle className="text-xl font-semibold capitalize">
                        {searchResultsHref ? (
                          <Link href={searchResultsHref}>
                            {labelsBySearchType[dataType]}
                          </Link>
                        ) : (
                          labelsBySearchType[dataType]
                        )}
                      </CardTitle>
                    </div>
                    <Badge className="h-8 max-w-fit min-w-8 bg-secondary font-semibold text-white">
                      {numFound}
                    </Badge>
                  </CardHeader>
                  <CardContent className="divide-y">
                    {docs.map((docUnknown) => {
                      const doc = docUnknown as Record<string, unknown>;
                      const rawDocumentKey =
                        doc.id ??
                        (dataType === "protein_structure"
                          ? doc.pdb_id
                          : undefined) ??
                        doc.genome_id ??
                        doc.patric_id ??
                        doc.pdb_id ??
                        doc.epitope_id ??
                        doc.exp_id ??
                        doc.sample_identifier ??
                        doc.taxon_id;
                      const documentKey =
                        typeof rawDocumentKey === "string" ||
                        typeof rawDocumentKey === "number"
                          ? String(rawDocumentKey)
                          : JSON.stringify(doc);
                      const genomeId =
                        typeof doc.genome_id === "string" ||
                        typeof doc.genome_id === "number"
                          ? doc.genome_id
                          : null;
                      const featureId = featureIdFromRow(doc);
                      const epitopeId = epitopeIdFromRow(doc);
                      const experimentId = experimentIdFromRow(doc);
                      const surveillanceId = surveillanceIdFromRow(doc);
                      const serologyId = serologyIdFromRow(doc);
                      const testType =
                        typeof doc.test_type === "string"
                          ? doc.test_type
                          : undefined;
                      const pathogenTestTypes = Array.isArray(
                        doc.pathogen_test_type,
                      )
                        ? doc.pathogen_test_type.filter(
                            (value): value is string =>
                              typeof value === "string",
                          )
                        : typeof doc.pathogen_test_type === "string"
                          ? [doc.pathogen_test_type]
                          : [];
                      const content = getFormattedContent(doc, dataType);
                      const href =
                        dataType === "genome" && genomeId != null
                          ? genomeHref(genomeId)
                          : dataType === "genome_feature" && featureId
                            ? featureHref(featureId)
                            : dataType === "epitope" && epitopeId
                              ? epitopeHref(epitopeId)
                              : dataType === "experiment" && experimentId
                                ? experimentHref(experimentId)
                              : dataType === "protein_structure" &&
                                  (typeof doc.pdb_id === "string" ||
                                    typeof doc.pdb_id === "number")
                                ? proteinStructureHref(doc.pdb_id)
                                : dataType === "surveillance" && surveillanceId
                                  ? surveillanceHref(
                                      surveillanceId,
                                      pathogenTestTypes.length === 1
                                        ? pathogenTestTypes[0]
                                        : undefined,
                                    )
                                  : dataType === "serology" && serologyId
                                    ? serologyHref(serologyId, testType)
                                    : null;
                      return (
                        <div key={documentKey} className="py-6">
                          {href ? (
                            <Link href={href} className="block">
                              {content}
                            </Link>
                          ) : (
                            content
                          )}
                        </div>
                      );
                    })}
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

interface SearchResultsProps {
  query: string; // 👈 required
}

export function SearchResults({ query }: SearchResultsProps) {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-8">
          Loading search results...
        </div>
      }
    >
      <SearchResultsContent query={query} />
    </Suspense>
  );
}
