"use client";

import React, { useState, FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LuSearch } from "react-icons/lu";
import { useRouter } from "next/navigation";
import { searchToQuery } from "@/app/search/search-to-query";

interface SearchBarProps {
  initialValue?: string;
  className?: string;
  placeholder?: string;
  size?: "default" | "lg";
  showIcon?: boolean;
  onSubmit?: (query: string) => void;
}

const bvbrcAPI = "https://p3.theseed.org/services/data_api/";

const searchTypes = [
  "taxonomy",
  "genome",
  "strain",
  "genome_feature",
  "protein_feature",
  "epitope",
  "protein_structure",
  "surveillance",
  "serology",
  "experiment",
  "genome_sequence",
];

export function SearchBar({
  initialValue = "",
  className = "",
  placeholder = "Search by virus name, protein, gene, or taxonomy...",
  size = "default",
  showIcon = true,
  onSubmit,
}: SearchBarProps) {
  const [inputValue, setInputValue] = useState(initialValue);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

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

  const handleSearch = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim()) return;

    setIsLoading(true);

    try {
      const searchPayload: Record<string, any> = {};
      const query = processQuery(inputValue);

      searchTypes.forEach((searchType) => {
        let tq = query;
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

      const response = await fetch(bvbrcAPI + "query/", {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(searchPayload),
      });

      const data = await response.json();

      if (onSubmit) {
        onSubmit(inputValue);
      }

      sessionStorage.setItem("searchResults", JSON.stringify(data));
      sessionStorage.setItem("searchQuery", inputValue);
      router.push(`/search?q=${encodeURIComponent(inputValue)}`);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <form onSubmit={handleSearch} className={`flex gap-2 ${className}`}>
      <div className="relative flex-grow">
        <Input
          type="text"
          placeholder={placeholder}
          className={`${size === "lg" ? "py-6" : ""} ${showIcon ? "pl-10" : ""}`}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {showIcon && (
          <LuSearch
            className="absolute top-1/2 left-3 -translate-y-1/2 transform text-gray-400"
            size={18}
          />
        )}
      </div>
      <Button
        type="submit"
        size={size}
        className={`bg-secondary-def hover:bg-secondary-def ${
          size === "lg" ? "py-6" : ""
        }`}
        disabled={isLoading}
      >
        {isLoading ? "Searching..." : "Search"}
      </Button>
    </form>
  );
}
