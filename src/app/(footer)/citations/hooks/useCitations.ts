import { useState, useMemo } from "react";
import { Citation, SortOption, PublicationType } from "../data/types";

export function useCitations(citations: Citation[]) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("newest");
  const [typeFilter, setTypeFilter] = useState<PublicationType>("All");

  const sortedCitations = useMemo(() => {
    let filtered = [...citations];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (citation) =>
          citation.title.toLowerCase().includes(query) ||
          citation.authors.toLowerCase().includes(query) ||
          citation.journal.toLowerCase().includes(query)
      );
    }

    // Apply type filter
    if (typeFilter !== "All") {
      filtered = filtered.filter((citation) => citation.type === typeFilter);
    }

    // Apply sorting
    switch (sortOption) {
      case "newest":
        filtered.sort((a, b) => b.year - a.year);
        break;
      case "oldest":
        filtered.sort((a, b) => a.year - b.year);
        break;
      case "highest-impact":
        filtered.sort((a, b) => b.impactFactor - a.impactFactor);
        break;
      case "most-cited":
        filtered.sort((a, b) => b.citationCount - a.citationCount);
        break;
    }

    return filtered;
  }, [citations, searchQuery, sortOption, typeFilter]);

  return {
    searchQuery,
    setSearchQuery,
    sortOption,
    setSortOption,
    typeFilter,
    setTypeFilter,
    sortedCitations,
  };
} 