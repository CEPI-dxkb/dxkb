"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  LuDna,
  LuBug,
  LuMicroscope,
  LuActivity,
  LuDatabase,
} from "react-icons/lu";
import { SearchBar } from "@/components/search/search-bar";

interface SearchPayload {
  dataType: string;
  accept: string;
  query: string;
}

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
    case "genome":
      return (
        <>
          <h3 className="search-results-header">{doc.genome_name}</h3>
          <div className="mt-2 space-y-1 text-sm text-gray-600">
            <p>
              Genome ID: {doc.genome_id} | {doc.contigs} Contigs
            </p>
            <p>
              SEQUENCED: {new Date(doc.completion_date).toLocaleDateString()}{" "}
              {doc.sequencing_centers ? `by ${doc.sequencing_centers}` : ""}
            </p>
            <p>COLLECTED: {doc.collection_date}</p>
            <p>HOST: {doc.host_name}</p>
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
          <h3 className="search-results-header">
            {doc.product || doc.feature_type}
          </h3>
          <div className="mt-2 space-y-1 text-sm text-gray-600">
            <p>{doc.genome_name}</p>
            <p>
              {doc.annotation} | {doc.patric_id}
            </p>
          </div>
        </>
      );
    case "surveillance":
      return (
        <>
          <h3 className="search-results-header">
            {doc.sample_identifier} | {doc.host_identifier}
          </h3>
          <div className="mt-2 space-y-1 text-sm text-gray-600">
            <p>
              ENV | {doc.collection_country} |{" "}
              {new Date(doc.collection_date).getFullYear()}
            </p>
          </div>
        </>
      );
    case "genome_sequence":
      return (
        <>
          <h3 className="search-results-header">{doc.genome_name}</h3>
          <div className="mt-2 space-y-1 text-sm text-gray-600">
            <p>
              {" "}
              {doc.accession} | {doc.description}{" "}
            </p>
          </div>
        </>
      );
    case "epitope":
      return (
        <>
          <h3 className="search-results-header">
            {doc.epitope_id} | {doc.epitope_sequence}
          </h3>
          <div className="mt-2 space-y-1 text-sm text-gray-600">
            <p>{doc.protein_name}</p>
            <p>{doc.organism}</p>
          </div>
        </>
      );

    case "protein_feature":
      return (
        <>
          <h3 className="search-results-header">
            {doc.source} | {doc.description}
          </h3>
          <div className="mt-2 space-y-1 text-sm text-gray-600">
            <p>{doc.genome_name}</p>
            <p>{doc.patric_id} | {doc.refseq_locus_tag}</p>
          </div>
        </>
      );
    case "taxonomy":
      return (
        <>
          <h3 className="search-results-header">{doc.taxon_name}</h3>
          <div className="mt-2 space-y-1 text-sm text-gray-600">
            <p>{doc.genomes} Genomes</p>
            <p>Taxon ID: {doc.taxon_id}</p>
          </div>
        </>
      );
    default:
      return (
        <>
          <h3 className="search-results-header">
            {doc.name || doc.id || "Untitled"}
          </h3>
          {doc.description && (
            <p className="mt-1 text-sm text-gray-600">{doc.description}</p>
          )}
        </>
      );
  }
}

export default function SearchResultsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchResults, setSearchResults] = useState<SearchResults>({});

  useEffect(() => {
    const storedResults = sessionStorage.getItem("searchResults");
    if (storedResults) {
      try {
        setSearchResults(JSON.parse(storedResults));
      } catch (e) {
        console.error("Error parsing search results:", e);
      }
    }
  }, [searchParams]);

  const handleSearch = (query: string) => {
    // The SearchBar component already handles the search logic
    // This is just a callback for any additional actions needed
  };

  // Filter out empty results and sort by numFound
  const validResults = Object.entries(searchResults)
    .filter(([_, data]) => data?.result?.response?.numFound > 0)
    .sort(
      ([_, a], [__, b]) =>
        (b?.result?.response?.numFound || 0) -
        (a?.result?.response?.numFound || 0),
    );

  return (
    <div className="container mx-auto px-4 py-8">
      <SearchBar
        initialValue={searchParams.get("q") || ""}
        className="mb-8"
        onSubmit={handleSearch}
      />

      {validResults.length === 0 ? (
        <div className="py-20 text-center">
          <h2 className="mb-4 text-2xl font-medium">No results found</h2>
          <p className="text-gray-600">Try different search terms or filters</p>
        </div>
      ) : (
        <div className="space-y-8">
          {validResults.map(([dataType, data]) => {
            const docs = data.result.response?.docs || [];
            const numFound = data.result.response?.numFound || 0;

            if (numFound === 0) return null;

            return (
              <div
                key={dataType}
                className="bg-card text-card-foreground rounded-lg border shadow-sm"
              >
                <div className="flex items-center justify-between border-b p-6">
                  <div className="flex items-center gap-2">
                    {getDataTypeIcon(dataType)}
                    <h2 className="text-xl font-semibold capitalize">
                      {dataType === "protein_feature"
                        ? "Domains & Motifs"
                        : dataType.replace(/_/g, " ")}
                    </h2>
                  </div>
                  <Badge className="bg-secondary-def text-white min-w-8 max-w-fit h-8">
                    {numFound}
                  </Badge>
                </div>
                <div className="divide-y">
                  {docs.map((doc: any, index: number) => (
                    <div key={doc.id || index} className="p-6">
                      {getFormattedContent(doc, dataType)}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
