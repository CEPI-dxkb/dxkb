"use client"

import { BarChart, Calendar, Download, ExternalLink, Search, SortDesc } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CitationNav } from "./components/citation-nav";
import { citations as citationsData } from "./data/citations";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface Citation {
  id: string;
  title: string;
  authors: string;
  year: number;
  type: string;
  journal: string;
  abstract: string;
  citationCount: number;
  impactFactor: number;
  doi: string;
}

export default function CitationsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState("newest");
  const [yearFilter, setYearFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filter citations based on search query and year
  const filteredCitations = citationsData.filter((citation) => {
    const searchFields = [citation.title, citation.authors, citation.abstract, citation.journal].join(" ").toLowerCase();

    const matchesSearch = searchQuery === "" || searchFields.includes(searchQuery.toLowerCase());
    const matchesYear = yearFilter === "all" || citation.year.toString() === yearFilter;

    return matchesSearch && matchesYear;
  });

  // Sort citations based on selected option
  const sortedCitations = [...filteredCitations].sort((a, b) => {
    switch (sortOption) {
      case "newest":
        return b.year - a.year;
      case "oldest":
        return a.year - b.year;
      case "citations":
        return b.citationCount - a.citationCount;
      case "impact":
        return b.impactFactor - a.impactFactor;
      default:
        return 0;
    }
  });

  // Calculate pagination
  const totalPages = Math.ceil(sortedCitations.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCitations = sortedCitations.slice(startIndex, endIndex);

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Generate page numbers
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  };

  // Calculate metrics
  const totalCitations = citationsData.reduce((sum, citation) => sum + citation.citationCount, 0);
  const averageImpactFactor = (
    citationsData.reduce((sum, citation) => sum + citation.impactFactor, 0) / citationsData.length
  ).toFixed(2);
  const citationsByYear: Record<number, number> = {};
  citationsData.forEach((citation) => {
    citationsByYear[citation.year] = (citationsByYear[citation.year] || 0) + 1;
  });
  const uniqueYears = [...new Set(citationsData.map((citation) => citation.year))].sort((a, b) => b - a);

  return (
    <div className="citation-page-container">
      <div className="citation-content">
        <div className="citation-page-header">
          <h1 className="citation-page-title">Dashboard</h1>
          <p className="citation-page-description">
            Research papers and articles that have cited our knowledge base platform.
          </p>
          <CitationNav />
        </div>

        {/* Metrics Overview */}
        <div className="citation-metrics-grid">
          <Card>
            <CardHeader className="citation-metrics-card">
              <CardTitle className="citation-metrics-title">Total Citations</CardTitle>
              <BarChart className="citation-metrics-icon" />
            </CardHeader>
            <CardContent>
              <div className="citation-metrics-value">{citationsData.length}</div>
              <p className="citation-metrics-description">Papers citing our platform</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="citation-metrics-card">
              <CardTitle className="citation-metrics-title">Citation Count</CardTitle>
              <BarChart className="citation-metrics-icon" />
            </CardHeader>
            <CardContent>
              <div className="citation-metrics-value">{totalCitations}</div>
              <p className="citation-metrics-description">Total citations received</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="citation-metrics-card">
              <CardTitle className="citation-metrics-title">Average Impact Factor</CardTitle>
              <BarChart className="citation-metrics-icon" />
            </CardHeader>
            <CardContent>
              <div className="citation-metrics-value">{averageImpactFactor}</div>
              <p className="citation-metrics-description">Across all citing journals</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="citation-metrics-card">
              <CardTitle className="citation-metrics-title">Most Recent</CardTitle>
              <Calendar className="citation-metrics-icon" />
            </CardHeader>
            <CardContent>
              <div className="citation-metrics-value">{Math.max(...uniqueYears)}</div>
              <p className="citation-metrics-description">Year of most recent citation</p>
            </CardContent>
          </Card>
        </div>

        {/* Citation Visualization */}
        <Card>
          <CardHeader>
            <CardTitle>Citation Trends</CardTitle>
            <CardDescription>Number of citations by year</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="timeline-container">
              <div className="timeline-bar-container">
                {uniqueYears.map((year) => (
                  <div key={year} className="timeline-bar-wrapper">
                    <div
                      className="timeline-bar"
                      style={{
                        height: `${(citationsByYear[year] / Math.max(...Object.values(citationsByYear))) * 100}%`,
                      }}
                    />
                    <div className="timeline-label">
                      <span className="timeline-year">{year}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filters and Search */}
        <div className="citation-filters">
          <div className="flex flex-col space-y-2 md:flex-row md:items-center md:space-x-2 md:space-y-0">
            <Select defaultValue="all" onValueChange={setYearFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {uniqueYears.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select defaultValue="newest" onValueChange={setSortOption}>
              <SelectTrigger className="w-[180px]">
                <SortDesc className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="citations">Most Cited</SelectItem>
                <SelectItem value="impact">Highest Impact</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="citation-search">
            <Search className="citation-search-icon" />
            <Input
              type="search"
              placeholder="Search citations..."
              className="citation-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Citations List */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList>
            <TabsTrigger value="all">All Citations</TabsTrigger>
            <TabsTrigger value="high-impact">High Impact</TabsTrigger>
            <TabsTrigger value="recent">Recent</TabsTrigger>
          </TabsList>
          <TabsContent value="all" className="mt-6">
            <div className="space-y-4">
              {paginatedCitations.length > 0 ? (
                paginatedCitations.map((citation) => <CitationCard key={citation.id} citation={citation} />)
              ) : (
                <div className="text-center py-10">
                  <p className="text-muted-foreground">No citations found matching your search criteria.</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => {
                      setSearchQuery("");
                      setYearFilter("all");
                      setCurrentPage(1);
                    }}
                  >
                    Reset Filters
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
          <TabsContent value="high-impact" className="mt-6">
            <div className="space-y-4">
              {paginatedCitations
                .filter((citation) => citation.impactFactor > 4)
                .map((citation) => (
                  <CitationCard key={citation.id} citation={citation} />
                ))}
            </div>
          </TabsContent>
          <TabsContent value="recent" className="mt-6">
            <div className="space-y-4">
              {paginatedCitations
                .filter((citation) => citation.year >= 2022)
                .map((citation) => (
                  <CitationCard key={citation.id} citation={citation} />
                ))}
            </div>
          </TabsContent>
        </Tabs>

        {sortedCitations.length > 0 && (
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (currentPage > 1) {
                      handlePageChange(currentPage - 1);
                    }
                  }}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
              {getPageNumbers().map((page) => (
                <PaginationItem key={page}>
                  <PaginationLink
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      handlePageChange(page);
                    }}
                    isActive={currentPage === page}
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (currentPage < totalPages) {
                      handlePageChange(currentPage + 1);
                    }
                  }}
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>
    </div>
  );
}

function CitationCard({ citation }: { citation: Citation }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="citation-card">
          <div className="citation-card-header">
            <div className="citation-card-badges">
              <Badge variant="outline">{citation.year}</Badge>
              <Badge variant="secondary">{citation.type}</Badge>
            </div>
            <div className="citation-card-badges">
              <Badge variant="outline" className="flex items-center gap-1">
                <BarChart className="h-3 w-3" />
                IF: {citation.impactFactor.toFixed(1)}
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1">
                {citation.citationCount} citations
              </Badge>
            </div>
          </div>

          <div>
            <Link
              href={citation.doi}
              target="_blank"
              className="citation-card-title"
            >
              {citation.title}
              <ExternalLink className="h-4 w-4 inline-block ml-1" />
            </Link>
            <p className="citation-card-meta">{citation.authors}</p>
            <p className="citation-card-journal">{citation.journal}</p>
          </div>

          <p className="citation-card-abstract">{citation.abstract}</p>

          <div className="citation-card-actions">
            <Button variant="outline" size="sm" asChild>
              <a href={citation.doi} target="_blank" rel="noopener noreferrer">
                View Paper
              </a>
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export Citation
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

