"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PublicationType, SortOption } from "../data/types";

interface CitationFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  sortOption: SortOption;
  setSortOption: (option: SortOption) => void;
  typeFilter: PublicationType;
  setTypeFilter: (type: PublicationType) => void;
  uniqueYears: number[];
}

export function CitationFilters({
  searchQuery,
  setSearchQuery,
  sortOption,
  setSortOption,
  typeFilter,
  setTypeFilter,
  uniqueYears,
}: CitationFiltersProps) {
  return (
    <div className="citation-filters">
      <div className="citation-search">
        <Search className="citation-search-icon" />
        <Input
          placeholder="Search citations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="citation-search-input"
        />
      </div>

      <div className="citation-filters-grid">
        <Select value={sortOption} onValueChange={(value: SortOption) => setSortOption(value)}>
          <SelectTrigger>
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
            <SelectItem value="highest-impact">Highest Impact</SelectItem>
            <SelectItem value="most-cited">Most Cited</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={(value: PublicationType) => setTypeFilter(value)}>
          <SelectTrigger>
            <SelectValue placeholder="Publication Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Types</SelectItem>
            <SelectItem value="Journal Article">Journal Articles</SelectItem>
            <SelectItem value="Conference Paper">Conference Papers</SelectItem>
            <SelectItem value="Book Chapter">Book Chapters</SelectItem>
          </SelectContent>
        </Select>

        <Select value={String(uniqueYears[0])} onValueChange={() => {}}>
          <SelectTrigger>
            <SelectValue placeholder="Year Range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {uniqueYears.map((year) => (
              <SelectItem key={year} value={String(year)}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
} 