"use client"

import { Calendar, Download, ExternalLink, Search, SortDesc } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { CitationNav } from "../components/citation-nav"
import { citations as citationsData } from "../data/citations"

export default function CitationsTimelinePage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [sortOption, setSortOption] = useState("newest")
  const [typeFilter, setTypeFilter] = useState("all")

  // Filter citations based on search query and type
  const filteredCitations = citationsData.filter((citation) => {
    const searchFields = [citation.title, citation.authors, citation.abstract, citation.journal].join(" ").toLowerCase()

    const matchesSearch = searchQuery === "" || searchFields.includes(searchQuery.toLowerCase())
    const matchesType = typeFilter === "all" || citation.type === typeFilter

    return matchesSearch && matchesType
  })

  // Sort citations based on selected option
  const sortedCitations = [...filteredCitations].sort((a, b) => {
    switch (sortOption) {
      case "newest":
        return b.year - a.year
      case "oldest":
        return a.year - b.year
      case "citations":
        return b.citationCount - a.citationCount
      case "impact":
        return b.impactFactor - a.impactFactor
      default:
        return 0
    }
  })

  // Group citations by year for timeline view
  const citationsByYear: Record<number, typeof citationsData> = {}
  sortedCitations.forEach((citation) => {
    if (!citationsByYear[citation.year]) {
      citationsByYear[citation.year] = []
    }
    citationsByYear[citation.year].push(citation)
  })

  // Get years in order based on sort
  const years = Object.keys(citationsByYear).map(Number).sort((a, b) => (sortOption === "oldest" ? a - b : b - a))

  return (
    <div className="citation-page-container">
      <div className="citation-content">
        <div className="citation-page-header">
          <h1 className="citation-page-title">Timeline</h1>
          <p className="citation-page-description">
            A chronological view of research papers that have cited our knowledge base.
          </p>
          <CitationNav />
        </div>

        {/* Filters and Search */}
        <div className="citation-filters">
          <div className="flex flex-col space-y-2 md:flex-row md:items-center md:space-x-2 md:space-y-0">
            <Select defaultValue="all" onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Publication Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Journal Article">Journal Articles</SelectItem>
                <SelectItem value="Conference Paper">Conference Papers</SelectItem>
                <SelectItem value="Book Chapter">Book Chapters</SelectItem>
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

        {/* Timeline View */}
        {years.length > 0 ? (
          <div className="space-y-12">
            {years.map((year) => (
              <div key={year} className="relative">
                <div className="sticky top-0 z-10 bg-background py-3">
                  <div className="flex items-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <h2 className="ml-4 text-xl font-semibold">{year}</h2>
                    <Badge className="ml-2">{citationsByYear[year].length} citations</Badge>
                  </div>
                  <Separator className="mt-4" />
                </div>

                <div className="mt-6 space-y-6 pl-14">
                  {citationsByYear[year].map((citation) => (
                    <div key={citation.id} className="relative">
                      <div className="absolute -left-9 mt-1 h-4 w-4 rounded-full border-2 border-primary bg-background"></div>
                      <Card>
                        <CardContent className="p-6">
                          <div className="citation-card">
                            <div className="citation-card-header">
                              <div className="citation-card-badges">
                                <Badge variant="outline">{citation.type}</Badge>
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className="flex items-center gap-1">
                                    IF: {citation.impactFactor.toFixed(1)}
                                  </Badge>
                                  <Badge variant="secondary" className="flex items-center gap-1">
                                    {citation.citationCount} citations
                                  </Badge>
                                </div>
                              </div>
                            </div>

                            <div>
                              <Link
                                href={citation.doi}
                                target="_blank"
                                className="citation-card-title"
                              >
                                {citation.title}
                                <ExternalLink className="h-4 w-4 inline-block ml-1 flex-shrink-0" />
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
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10">
            <p className="text-muted-foreground">No citations found matching your search criteria.</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setSearchQuery("")
                setTypeFilter("all")
              }}
            >
              Reset Filters
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
