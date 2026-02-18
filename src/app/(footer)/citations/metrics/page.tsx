"use client"

import { BarChart3, BookOpen, Download, ExternalLink, LineChart, TrendingUp, Users } from "lucide-react"
import Link from "next/link"
import { useState, useMemo } from "react"

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CitationNav } from "../components/citation-nav"
import { citations as citationsData } from "../data/citations"

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

interface YearMetrics {
  count: number;
  totalCitations: number;
  avgImpact: number;
}

interface Author {
  name: string;
  count: number;
}

export default function CitationsMetricsPage() {
  const [yearRange, setYearRange] = useState<string>("all")

  // Get unique years and sort them
  const uniqueYears = [...new Set(citationsData.map((citation) => citation.year))].sort((a, b) => a - b)

  // Filter citations based on year range
  const filteredCitations = useMemo(() => {
    if (yearRange === "all") return citationsData
    const [startYear, endYear] = yearRange.split("-").map(Number)
    return citationsData.filter((citation) => citation.year >= startYear && citation.year <= endYear)
  }, [yearRange])

  // Calculate metrics by year
  const metricsByYear: Record<number, YearMetrics> = {}
  uniqueYears.forEach((year) => {
    const yearCitations = citationsData.filter((c) => c.year === year)
    metricsByYear[year] = {
      count: yearCitations.length,
      totalCitations: yearCitations.reduce((sum, c) => sum + c.citationCount, 0),
      avgImpact: yearCitations.length > 0
        ? Number((yearCitations.reduce((sum, c) => sum + c.impactFactor, 0) / yearCitations.length).toFixed(1))
        : 0,
    }
  })

  // Calculate metrics by publication type
  const publicationTypes = ["Journal Article", "Conference Paper", "Book Chapter"]
  const citationsByType: Record<string, number> = {}
  publicationTypes.forEach((type) => {
    citationsByType[type] = filteredCitations.filter((c) => c.type === type).length
  })

  // Get top authors
  const authorCounts: Record<string, number> = {}
  filteredCitations.forEach((citation) => {
    const authors = citation.authors.split(", ")
    authors.forEach((author) => {
      const lastName = author.split(", ")[0] || author.split(" ")[0]
      authorCounts[lastName] = (authorCounts[lastName] || 0) + 1
    })
  })

  const topAuthors: Author[] = Object.entries(authorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }))

  // Calculate impact factor distribution
  const impactFactorRanges = [
    { range: "0-1", count: 0 },
    { range: "1-2", count: 0 },
    { range: "2-3", count: 0 },
    { range: "3-4", count: 0 },
    { range: "4-5", count: 0 },
    { range: "5+", count: 0 },
  ]

  filteredCitations.forEach((citation) => {
    const impact = citation.impactFactor
    if (impact >= 5) {
      impactFactorRanges[5].count++
    } else {
      const index = Math.floor(impact)
      if (index >= 0 && index < 5) {
        impactFactorRanges[index].count++
      }
    }
  })

  // Calculate h-index (simplified version)
  const hIndex = calculateHIndex(filteredCitations)

  return (
    <div className="citation-page-container">
      <div className="citation-content">
        <div className="citation-page-header">
          <h1 className="citation-page-title">Metrics</h1>
          <p className="citation-page-description">
            Detailed analytics and impact metrics for papers citing our knowledge base.
          </p>
          <CitationNav />
        </div>

        {/* Time Range Filter */}
        <div className="citation-filters">
          <div className="flex flex-col space-y-2 md:flex-row md:items-center md:space-x-2 md:space-y-0">
            <Select
              items={[
                { value: "all", label: "All Time" },
                ...(uniqueYears.length > 0 && uniqueYears[0] !== uniqueYears[uniqueYears.length - 1]
                  ? [
                      {
                        value: String(uniqueYears[0]) + "-" + String(uniqueYears[uniqueYears.length - 1]),
                        label: `${uniqueYears[0]} - ${uniqueYears[uniqueYears.length - 1]}`,
                      },
                      ...(uniqueYears.length > 2
                        ? [
                            {
                              value: String(uniqueYears[uniqueYears.length - 3]) + "-" + String(uniqueYears[uniqueYears.length - 1]),
                              label: "Last 3 Years",
                            },
                          ]
                        : []),
                    ]
                  : []),
                ...uniqueYears.map((year) => ({ value: String(year) + "-" + String(year), label: String(year) })),
              ]}
              value={yearRange}
              onValueChange={(value) => setYearRange(value ?? "")}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select year range" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">All Time</SelectItem>
                  {uniqueYears.length > 0 && uniqueYears[0] !== uniqueYears[uniqueYears.length - 1] && (
                    <>
                      <SelectItem value={String(uniqueYears[0]) + "-" + String(uniqueYears[uniqueYears.length - 1])}>
                        {uniqueYears[0]} - {uniqueYears[uniqueYears.length - 1]}
                      </SelectItem>
                      {uniqueYears.length > 2 && (
                        <SelectItem 
                          value={String(uniqueYears[uniqueYears.length - 3]) + "-" + String(uniqueYears[uniqueYears.length - 1])}
                        >
                          Last 3 Years
                        </SelectItem>
                      )}
                    </>
                  )}
                  {uniqueYears.map((year) => (
                    <SelectItem key={year} value={String(year) + "-" + String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="citation-metrics-grid">
          <Card>
            <CardHeader className="citation-metrics-card">
              <CardTitle className="citation-metrics-title">Total Citing Papers</CardTitle>
              <BookOpen className="citation-metrics-icon" />
            </CardHeader>
            <CardContent>
              <div className="citation-metrics-value">{filteredCitations.length}</div>
              <p className="citation-metrics-description">Papers citing our platform</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="citation-metrics-card">
              <CardTitle className="citation-metrics-title">Total Citations</CardTitle>
              <BarChart3 className="citation-metrics-icon" />
            </CardHeader>
            <CardContent>
              <div className="citation-metrics-value">{filteredCitations.reduce((sum, c) => sum + c.citationCount, 0)}</div>
              <p className="citation-metrics-description">Combined citation count</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="citation-metrics-card">
              <CardTitle className="citation-metrics-title">H-Index</CardTitle>
              <TrendingUp className="citation-metrics-icon" />
            </CardHeader>
            <CardContent>
              <div className="citation-metrics-value">{hIndex}</div>
              <p className="citation-metrics-description">Based on citing publications</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="citation-metrics-card">
              <CardTitle className="citation-metrics-title">Avg. Impact Factor</CardTitle>
              <LineChart className="citation-metrics-icon" />
            </CardHeader>
            <CardContent>
              <div className="citation-metrics-value">
                {(filteredCitations.reduce((sum, c) => sum + c.impactFactor, 0) / filteredCitations.length).toFixed(2)}
              </div>
              <p className="citation-metrics-description">Across all citing journals</p>
            </CardContent>
          </Card>
        </div>

        {/* Metrics Tabs */}
        <Tabs defaultValue="trends" className="w-full">
          <TabsList>
            <TabsTrigger value="trends">Citation Trends</TabsTrigger>
            <TabsTrigger value="impact">Impact Analysis</TabsTrigger>
            <TabsTrigger value="authors">Author Analysis</TabsTrigger>
          </TabsList>

          {/* Citation Trends Tab */}
          <TabsContent value="trends" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Citation Growth Over Time</CardTitle>
                <CardDescription>Number of papers citing our knowledge base by year</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[250px] w-full">
                  <div className="flex h-full items-end gap-2">
                    {uniqueYears.map((year) => (
                      <div key={year} className="relative flex flex-1 flex-col items-center">
                        <div
                          className="w-full bg-primary rounded-t"
                          style={{
                            height: `${(metricsByYear[year].count / Math.max(...Object.values(metricsByYear).map((m) => m.count))) * 100}%`,
                            minHeight: "20px",
                          }}
                        />
                        <div className="absolute bottom-0 w-full">
                          <div
                            className="w-full bg-primary/30 rounded-t"
                            style={{
                              height: `${(metricsByYear[year].totalCitations / Math.max(...Object.values(metricsByYear).map((m) => m.totalCitations || 1))) * 80}%`,
                              minHeight: "5px",
                            }}
                          />
                        </div>
                        <div className="mt-2 text-center">
                          <span className="text-xs font-medium">{year}</span>
                          <div className="text-xs text-muted-foreground">{metricsByYear[year].count} papers</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex justify-center mt-4 items-center text-sm text-muted-foreground">
                  <div className="flex items-center mr-4">
                    <div className="w-3 h-3 bg-primary rounded mr-1"></div>
                    <span>Citing Papers</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-primary/30 rounded mr-1"></div>
                    <span>Total Citations Received</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Publication Types</CardTitle>
                  <CardDescription>Distribution by publication category</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {publicationTypes.map((type) => {
                      const count = citationsByType[type] || 0
                      const percentage =
                        filteredCitations.length > 0 ? Math.round((count / filteredCitations.length) * 100) : 0

                      return (
                        <div key={type} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{type}</span>
                            <span className="text-sm text-muted-foreground">
                              {count} ({percentage}%)
                            </span>
                          </div>
                          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${percentage}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Average Impact Factor Trend</CardTitle>
                  <CardDescription>How impact factor has changed over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[200px] w-full">
                    <div className="flex h-full items-end gap-2">
                      {uniqueYears.map((year) => {
                        const avgImpact = metricsByYear[year].avgImpact
                        const maxImpact = Math.max(
                          ...Object.values(metricsByYear).map((m) => m.avgImpact || 0),
                        )

                        return (
                          <div key={year} className="relative flex flex-1 flex-col items-center">
                            <div
                              className="w-full bg-primary/70 rounded-t"
                              style={{
                                height: `${(avgImpact / (maxImpact || 1)) * 100}%`,
                                minHeight: "20px",
                              }}
                            />
                            <div className="mt-2 text-center">
                              <span className="text-xs font-medium">{year}</span>
                              <div className="text-xs text-muted-foreground">IF: {avgImpact}</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Impact Analysis Tab */}
          <TabsContent value="impact" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Impact Factor Distribution</CardTitle>
                <CardDescription>Distribution of citations by journal impact factor</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[250px] w-full">
                  <div className="flex h-full items-end gap-2">
                    {impactFactorRanges.map((item) => (
                      <div key={item.range} className="relative flex flex-1 flex-col items-center">
                        <div
                          className="w-full bg-primary rounded-t"
                          style={{
                            height: `${(item.count / Math.max(...impactFactorRanges.map((r) => r.count || 1))) * 100}%`,
                            minHeight: "20px",
                          }}
                        />
                        <div className="mt-2 text-center">
                          <span className="text-xs font-medium">IF: {item.range}</span>
                          <div className="text-xs text-muted-foreground">{item.count} papers</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Most Cited Papers</CardTitle>
                  <CardDescription>Papers with the highest citation counts</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {filteredCitations
                      .sort((a, b) => b.citationCount - a.citationCount)
                      .slice(0, 5)
                      .map((citation, index) => (
                        <div key={citation.id} className="flex items-start space-x-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                            {index + 1}
                          </div>
                          <div className="space-y-1">
                            <Link
                              href={citation.doi}
                              className="text-sm font-medium hover:underline line-clamp-1"
                              target="_blank"
                            >
                              {citation.title}
                            </Link>
                            <div className="flex items-center text-xs text-muted-foreground">
                              <span>{citation.citationCount} citations</span>
                              <span className="mx-1">•</span>
                              <span>IF: {citation.impactFactor.toFixed(1)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>High Impact Papers</CardTitle>
                  <CardDescription>Papers from journals with highest impact factors</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {filteredCitations
                      .sort((a, b) => b.impactFactor - a.impactFactor)
                      .slice(0, 5)
                      .map((citation, index) => (
                        <div key={citation.id} className="flex items-start space-x-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                            {index + 1}
                          </div>
                          <div className="space-y-1">
                            <Link
                              href={citation.doi}
                              className="text-sm font-medium hover:underline line-clamp-1"
                              target="_blank"
                            >
                              {citation.title}
                            </Link>
                            <div className="flex items-center text-xs text-muted-foreground">
                              <span>IF: {citation.impactFactor.toFixed(1)}</span>
                              <span className="mx-1">•</span>
                              <span>{citation.journal}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Author Analysis Tab */}
          <TabsContent value="authors" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Top Citing Authors</CardTitle>
                <CardDescription>Authors who cite our knowledge base most frequently</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[250px] w-full">
                  <div className="flex h-full items-end gap-2">
                    {topAuthors.map((author) => (
                      <div key={author.name} className="relative flex flex-1 flex-col items-center">
                        <div
                          className="w-full bg-primary rounded-t"
                          style={{
                            height: `${(author.count / Math.max(...topAuthors.map((a) => a.count))) * 100}%`,
                            minHeight: "20px",
                          }}
                        />
                        <div className="mt-2 text-center">
                          <span className="text-xs font-medium">{author.name}</span>
                          <div className="text-xs text-muted-foreground">{author.count} papers</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Author Collaboration Network</CardTitle>
                <CardDescription>Frequent collaborators citing our knowledge base</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="h-[300px] w-full flex items-center justify-center relative bg-muted/20 rounded-lg">
                  {/* Center node representing your knowledge base */}
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
                    <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-lg">
                      <BookOpen className="h-8 w-8" />
                    </div>
                    <div className="text-center mt-2 font-medium text-sm">Knowledge Base</div>
                  </div>

                  {/* Author nodes */}
                  {topAuthors.map((author, index) => {
                    // Position nodes in a circle around the center
                    const angle = (index / topAuthors.length) * 2 * Math.PI
                    const radius = 100 // Distance from center
                    const x = Math.cos(angle) * radius
                    const y = Math.sin(angle) * radius

                    // Size based on citation count
                    const size = 30 + author.count * 5

                    return (
                      <div
                        key={author.name}
                        className="absolute transform -translate-x-1/2 -translate-y-1/2"
                        style={{
                          left: `calc(50% + ${x}px)`,
                          top: `calc(50% + ${y}px)`,
                        }}
                      >
                        {/* Line connecting to center */}
                        <div
                          className="absolute bg-muted"
                          style={{
                            width: `${Math.sqrt(x * x + y * y)}px`,
                            height: "2px",
                            transformOrigin: "0 0",
                            transform: `rotate(${Math.atan2(y, x)}rad)`,
                            left: "50%",
                            top: "50%",
                            zIndex: 0,
                          }}
                        />

                        {/* Author node */}
                        <div
                          className="rounded-full flex flex-col items-center justify-center p-2 shadow-md bg-card border"
                          style={{
                            height: `${size}px`,
                            width: `${size}px`,
                            zIndex: 5,
                            position: "relative",
                          }}
                        >
                          <Users className="h-4 w-4 mb-1 text-muted-foreground" />
                          <span className="text-xs text-center font-medium">{author.name}</span>
                          <span className="text-xs">{author.count}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="text-center mt-4 text-sm text-muted-foreground">
                  <p>This visualization shows the top authors who cite our knowledge base and their relationships.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Recent High-Impact Citations */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Recent High-Impact Citations</h2>
          <div className="space-y-4">
            {filteredCitations
              .filter((c) => c.impactFactor > 4)
              .sort((a, b) => b.year - a.year)
              .slice(0, 3)
              .map((citation) => (
                <Card key={citation.id}>
                  <CardContent className="p-6">
                    <div className="flex flex-col space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{citation.year}</Badge>
                          <Badge variant="secondary">{citation.type}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="flex items-center gap-1">
                            <BarChart3 className="h-3 w-3" data-icon="inline-start" />
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
                          className="text-xl font-semibold tracking-tight hover:underline flex items-center gap-1"
                        >
                          {citation.title}
                          <ExternalLink className="h-4 w-4 inline-block ml-1" />
                        </Link>
                        <p className="text-sm font-medium mt-1">{citation.authors}</p>
                        <p className="text-sm text-muted-foreground italic mt-1">{citation.journal}</p>
                      </div>

                      <p className="text-sm mt-2">{citation.abstract}</p>

                      <div className="flex items-center gap-2 mt-2">
                        <a
                          href={citation.doi}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={buttonVariants({ variant: "outline", size: "sm" })}
                        >
                          View Paper
                        </a>
                        <Button variant="outline" size="sm">
                          <Download className="h-3.5 w-3.5" data-icon="inline-start" />
                          Export Citation
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function calculateHIndex(citations: Citation[]): number {
  const sortedCitations = [...citations].sort((a, b) => b.citationCount - a.citationCount)
  let hIndex = 0
  for (let i = 0; i < sortedCitations.length; i++) {
    if (sortedCitations[i].citationCount >= i + 1) {
      hIndex = i + 1
    } else {
      break
    }
  }
  return hIndex
}

