"use client"

import { Download, Filter, Search, SortDesc } from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import FooterHeader from "@/components/headers/footer-header"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

type PublicationType = "journal" | "conference" | "book" | "preprint";
type FieldType = "medicine" | "computerScience" | "biology" | "education" | "climate";
type YearRangeKey = "from" | "to";

export default function PublicationsListView() {
  // Search state
  const [searchQuery, setSearchQuery] = useState("")

  // Sort state
  const [sortOption, setSortOption] = useState("newest")

  // Filter states
  const [typeFilters, setTypeFilters] = useState({
    journal: false,
    conference: false,
    book: false,
    preprint: false,
  })

  const [fieldFilters, setFieldFilters] = useState({
    medicine: false,
    computerScience: false,
    biology: false,
    education: false,
    climate: false,
  })

  const [yearRange, setYearRange] = useState({
    from: "",
    to: "",
  })

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Handle type filter changes
  const handleTypeFilterChange = (type: PublicationType) => {
    setTypeFilters((prev) => ({
      ...prev,
      [type]: !prev[type],
    }))
  }

  // Handle field filter changes
  const handleFieldFilterChange = (field: FieldType) => {
    setFieldFilters((prev) => ({
      ...prev,
      [field]: !prev[field],
    }))
  }

  // Handle year range changes
  const handleYearChange = (field: YearRangeKey, value: string) => {
    setYearRange((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  // Apply filters to publications
  const filteredPublications = publications.filter((publication) => {
    // Search filter
    const searchFields = [publication.title, publication.authors, publication.abstract, publication.journal]
      .join(" ")
      .toLowerCase()

    const matchesSearch = searchQuery === "" || searchFields.includes(searchQuery.toLowerCase())

    // Type filters
    const typeFilterActive = Object.values(typeFilters).some((value) => value)
    const matchesType =
      !typeFilterActive ||
      (typeFilters.journal && publication.type === "Journal Article") ||
      (typeFilters.conference && publication.type === "Conference Paper") ||
      (typeFilters.book && publication.type === "Book Chapter") ||
      (typeFilters.preprint && publication.type === "Preprint")

    // Year range filter
    const fromYear = yearRange.from ? Number.parseInt(yearRange.from) : 0
    const toYear = yearRange.to ? Number.parseInt(yearRange.to) : 3000
    const matchesYear = publication.year >= fromYear && publication.year <= toYear

    // Field filters - assuming we have a field property or can infer it
    // For this example, we'll just return true for field filters since we don't have field data
    const fieldFilterActive = Object.values(fieldFilters).some((value) => value)
    const matchesField = !fieldFilterActive || true // Replace with actual field matching logic if you have field data

    return matchesSearch && matchesType && matchesYear && matchesField
  })

  // Sort publications
  const sortedPublications = [...filteredPublications].sort((a, b) => {
    switch (sortOption) {
      case "newest":
        return b.year - a.year
      case "oldest":
        return a.year - b.year
      case "citations":
        return b.citations - a.citations
      case "title":
        return a.title.localeCompare(b.title)
      default:
        return 0
    }
  })

  // Calculate pagination
  const totalPages = Math.ceil(sortedPublications.length / itemsPerPage);
  const paginatedPublications = sortedPublications.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortOption, typeFilters, fieldFilters, yearRange]);

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    pages.push(1);
    
    if (currentPage > 3) {
      pages.push("ellipsis");
    }

    for (let i = Math.max(2, currentPage - 1); i <= Math.min(currentPage + 1, totalPages - 1); i++) {
      pages.push(i);
    }

    if (currentPage < totalPages - 2) {
      pages.push("ellipsis");
    }

    if (totalPages > 1) {
      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <div className="flex flex-col space-y-8 min-h-screen">
      <FooterHeader title="Publications" />
      <section className="container mx-auto py-10 px-4 md:px-6">
        <div className="flex flex-col space-y-8">
          <div className="space-y-2">
            {/* <h1 className="text-3xl font-bold tracking-tight">Publications</h1> */}
            <p className="text-muted-foreground">
              A comprehensive list of research publications that have utilized our knowledge base platform.
            </p>
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Filters sidebar */}
            <div className="w-full lg:w-64 shrink-0">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <Filter className="h-4 w-4 mr-2" />
                    Filters
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Publication Type</Label>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="journal"
                          name="journal"
                          checked={typeFilters.journal}
                          onCheckedChange={() => handleTypeFilterChange("journal")}
                        />
                        <Label htmlFor="journal" className="text-sm font-normal">
                          Journal Articles
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="conference"
                          name="conference"
                          checked={typeFilters.conference}
                          onCheckedChange={() => handleTypeFilterChange("conference")}
                        />
                        <Label htmlFor="conference" className="text-sm font-normal">
                          Conference Papers
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="book"
                          name="book"
                          checked={typeFilters.book}
                          onCheckedChange={() => handleTypeFilterChange("book")}
                        />
                        <Label htmlFor="book" className="text-sm font-normal">
                          Book Chapters
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="preprint"
                          name="preprint"
                          checked={typeFilters.preprint}
                          onCheckedChange={() => handleTypeFilterChange("preprint")}
                        />
                        <Label htmlFor="preprint" className="text-sm font-normal">
                          Preprints
                        </Label>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Year</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="from-year" className="text-xs">
                          From
                        </Label>
                        <Input
                          id="from-year"
                          placeholder="2020"
                          className="h-8"
                          value={yearRange.from}
                          onChange={(e) => handleYearChange("from", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="to-year" className="text-xs">
                          To
                        </Label>
                        <Input
                          id="to-year"
                          placeholder="2023"
                          className="h-8"
                          value={yearRange.to}
                          onChange={(e) => handleYearChange("to", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Research Field</Label>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="medicine"
                          name="medicine"
                          checked={fieldFilters.medicine}
                          onCheckedChange={() => handleFieldFilterChange("medicine")}
                        />
                        <Label htmlFor="medicine" className="text-sm font-normal">
                          Medicine
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="computer-science"
                          name="computer-science"
                          checked={fieldFilters.computerScience}
                          onCheckedChange={() => handleFieldFilterChange("computerScience")}
                        />
                        <Label htmlFor="computer-science" className="text-sm font-normal">
                          Computer Science
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="biology"
                          name="biology"
                          checked={fieldFilters.biology}
                          onCheckedChange={() => handleFieldFilterChange("biology")}
                        />
                        <Label htmlFor="biology" className="text-sm font-normal">
                          Biology
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="education"
                          name="education"
                          checked={fieldFilters.education}
                          onCheckedChange={() => handleFieldFilterChange("education")}
                        />
                        <Label htmlFor="education" className="text-sm font-normal">
                          Education
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="climate"
                          name="climate"
                          checked={fieldFilters.climate}
                          onCheckedChange={() => handleFieldFilterChange("climate")}
                        />
                        <Label htmlFor="climate" className="text-sm font-normal">
                          Climate Science
                        </Label>
                      </div>
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    onClick={() => {
                      // Reset filters
                      setTypeFilters({
                        journal: false,
                        conference: false,
                        book: false,
                        preprint: false,
                      })
                      setFieldFilters({
                        medicine: false,
                        computerScience: false,
                        biology: false,
                        education: false,
                        climate: false,
                      })
                      setYearRange({
                        from: "",
                        to: "",
                      })
                    }}
                  >
                    Reset Filters
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Main content */}
            <div className="flex-1">
              <div className="mb-6 flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                <div className="relative w-full sm:w-96">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search by title, author, or keyword..."
                    className="w-full pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Select
                    items={[
                      { value: "newest", label: "Newest First" },
                      { value: "oldest", label: "Oldest First" },
                      { value: "citations", label: "Most Cited" },
                      { value: "title", label: "Title (A-Z)" },
                    ]}
                    defaultValue="newest"
                    onValueChange={(value) => setSortOption(value ?? "")}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SortDesc className="mr-2 h-4 w-4" />
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="newest">Newest First</SelectItem>
                        <SelectItem value="oldest">Oldest First</SelectItem>
                        <SelectItem value="citations">Most Cited</SelectItem>
                        <SelectItem value="title">Title (A-Z)</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon">
                    <Download className="h-4 w-4" data-icon="inline-start" />
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                {sortedPublications.length > 0 ? (
                  <>
                    <div className="space-y-4">
                      {paginatedPublications.map((publication) => (
                        <Card key={publication.id} className="overflow-hidden">
                          <div className="px-6">
                            <div className="flex flex-col space-y-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline">{publication.type}</Badge>
                                <Badge variant="secondary">{publication.year}</Badge>
                                <span className="text-sm text-muted-foreground ml-auto">
                                  {publication.citations} citations
                                </span>
                              </div>
                              <Link href={`/publications/${publication.id}`} className="hover:underline">
                                <h3 className="text-xl font-semibold tracking-tight mt-2">{publication.title}</h3>
                              </Link>
                              <p className="text-sm font-medium">{publication.authors}</p>
                              <p className="text-sm text-muted-foreground italic">{publication.journal}</p>
                              <p className="text-sm mt-2">{publication.abstract}</p>
                              <div className="flex items-center gap-2 mt-4">
                                <Link
                                  href={`/publications/${publication.id}`}
                                  className={buttonVariants({ variant: "outline", size: "sm" })}
                                >
                                  View Details
                                </Link>
                                <a
                                  href={publication.doi}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={buttonVariants({ variant: "outline", size: "sm" })}
                                >
                                  View Original
                                </a>
                                <Button variant="outline" size="sm">
                                  <Download className="h-3.5 w-3.5" data-icon="inline-start" />
                                  Cite
                                </Button>
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>

                    {sortedPublications.length > itemsPerPage && (
                      <div className="mt-8">
                        <Pagination>
                          <PaginationContent>
                            <PaginationItem>
                              <PaginationPrevious
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                className={cn(
                                  "cursor-pointer",
                                  currentPage === 1 && "pointer-events-none opacity-50"
                                )}
                              />
                            </PaginationItem>
                            
                            {getPageNumbers().map((page, i) => (
                              <PaginationItem key={i}>
                                {page === "ellipsis" ? (
                                  <PaginationEllipsis />
                                ) : (
                                  <PaginationLink
                                    isActive={page === currentPage}
                                    onClick={() => setCurrentPage(page as number)}
                                    className="cursor-pointer"
                                  >
                                    {page}
                                  </PaginationLink>
                                )}
                              </PaginationItem>
                            ))}

                            <PaginationItem>
                              <PaginationNext
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                className={cn(
                                  "cursor-pointer",
                                  currentPage === totalPages && "pointer-events-none opacity-50"
                                )}
                              />
                            </PaginationItem>
                          </PaginationContent>
                        </Pagination>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-10">
                    <p className="text-muted-foreground">No publications found matching your search criteria.</p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => {
                        setSearchQuery("")
                        setTypeFilters({
                          journal: false,
                          conference: false,
                          book: false,
                          preprint: false,
                        })
                        setFieldFilters({
                          medicine: false,
                          computerScience: false,
                          biology: false,
                          education: false,
                          climate: false,
                        })
                        setYearRange({
                          from: "",
                          to: "",
                        })
                      }}
                    >
                      Reset All Filters
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

// Sample data
const publications = [
  {
    id: "1",
    title: "Advancements in Knowledge Base Systems for Biomedical Research",
    authors: "Smith, J., Johnson, M., Williams, R.",
    year: 2023,
    type: "Journal Article",
    journal: "Journal of Biomedical Informatics",
    abstract:
      "This paper explores the use of modern knowledge base systems in biomedical research, with a specific focus on how our platform enabled faster data retrieval and analysis.",
    citations: 24,
    doi: "https://doi.org/10.1234/jbi.2023.001",
  },
  {
    id: "2",
    title: "Semantic Web Technologies in Educational Knowledge Bases",
    authors: "Brown, A., Davis, L., Miller, S.",
    year: 2022,
    type: "Conference Paper",
    journal: "International Conference on Educational Technology",
    abstract:
      "We present a framework for integrating semantic web technologies with educational knowledge bases, demonstrating improved learning outcomes through our case study.",
    citations: 18,
    doi: "https://doi.org/10.5678/icet.2022.042",
  },
  {
    id: "3",
    title: "Optimizing Query Performance in Large-Scale Knowledge Repositories",
    authors: "Garcia, E., Martinez, P., Rodriguez, T.",
    year: 2023,
    type: "Journal Article",
    journal: "ACM Transactions on Database Systems",
    abstract:
      "This research investigates methods for optimizing query performance in large-scale knowledge repositories, with benchmarks performed on our knowledge base system.",
    citations: 31,
    doi: "https://doi.org/10.1145/tods.2023.007",
  },
  {
    id: "4",
    title: "Knowledge Graphs for Climate Science: A Case Study",
    authors: "Wilson, K., Thompson, J., Anderson, L.",
    year: 2022,
    type: "Book Chapter",
    journal: "Advances in Climate Informatics",
    abstract:
      "We demonstrate how knowledge graphs can enhance climate science research through improved data integration and discovery capabilities.",
    citations: 12,
    doi: "https://doi.org/10.9012/aci.2022.015",
  },
  {
    id: "5",
    title: "Knowledge Graphs for Climate Science: A Case Study",
    authors: "Wilson, K., Thompson, J., Anderson, L.",
    year: 2022,
    type: "Book Chapter",
    journal: "Advances in Climate Informatics",
    abstract:
      "We demonstrate how knowledge graphs can enhance climate science research through improved data integration and discovery capabilities.",
    citations: 12,
    doi: "https://doi.org/10.9012/aci.2022.015",
  },
  {
    id: "6",
    title: "Knowledge Graphs for Climate Science: A Case Study",
    authors: "Wilson, K., Thompson, J., Anderson, L.",
    year: 2022,
    type: "Book Chapter",
    journal: "Advances in Climate Informatics",
    abstract:
      "We demonstrate how knowledge graphs can enhance climate science research through improved data integration and discovery capabilities.",
    citations: 12,
    doi: "https://doi.org/10.9012/aci.2022.015",
  },
]

