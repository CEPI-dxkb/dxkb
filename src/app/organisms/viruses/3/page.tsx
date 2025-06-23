"use client";

import { useState } from "react";
import {
  Search,
  Filter,
  Download,
  BarChart2,
  Grid,
  List,
  Map,
  RefreshCw,
  ChevronRight,
  Info,
  X,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";

export default function BrucellaGenomeViewerAlt() {
  const [viewType, setViewType] = useState("list");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedRows, setSelectedRows] = useState<number[]>([]);

  // Sample data - in production would come from API
  const genomeData = [
    {
      id: 1,
      name: "Brucella ceti 05-684-1144-F2TM",
      strain: "05-684-1144-F2TM",
      genbank: "CA/NY0000000000",
      size: 3306660,
      cds: 3348,
      year: 2005,
      country: "France",
      host: "",
      type: "ceti",
    },
    {
      id: 2,
      name: "Brucella ceti 14-901",
      strain: "14-901",
      genbank: "CA/NZ0000000000",
      size: 3352819,
      cds: 3742,
      year: 2014,
      country: "Finland",
      host: "grey seal",
      type: "ceti",
    },
    {
      id: 3,
      name: "Brucella ceti 12-1944-6(9/186)",
      strain: "12-1944-6(9/186)",
      genbank: "CA/NY/0000000000",
      size: 3353515,
      cds: 3330,
      year: 2012,
      country: "United Kingdom",
      host: "",
      type: "ceti",
    },
    {
      id: 4,
      name: "Brucella ceti 15-1717-6/196",
      strain: "15-1717-6/196",
      genbank: "CA/PG/0000000000",
      size: 3299777,
      cds: 3351,
      year: 2015,
      country: "France",
      host: "Dolphin",
      type: "ceti",
    },
    {
      id: 5,
      name: "Brucella melitensis A1659_R12",
      strain: "A1659_R12",
      genbank: "JAKUF/0000000000",
      size: 3286742,
      cds: 3389,
      year: 2017,
      country: "Tunisia",
      host: "Human",
      type: "melitensis",
    },
    {
      id: 6,
      name: "Brucella melitensis A1659_R6",
      strain: "A1659_R6",
      genbank: "JAKUF/0000000000",
      size: 3284852,
      cds: 3391,
      year: 2017,
      country: "Tunisia",
      host: "Human",
      type: "melitensis",
    },
  ];

  const genomeStats = {
    totalGenomes: 1791,
    speciesCount: {
      melitensis: 840,
      abortus: 612,
      suis: 204,
      canis: 65,
      ceti: 42,
      ovis: 28,
    },
    hostDistribution: {
      human: 943,
      cattle: 412,
      dolphin: 38,
      seal: 29,
      pig: 192,
      other: 177,
    },
    yearDistribution: {
      "2017": 324,
      "2016": 256,
      "2015": 243,
      "2014": 212,
      "2013": 195,
      "2012": 178,
      older: 383,
    },
  };

  const colors = {
    melitensis: "bg-red-100 text-red-800 border-red-200",
    abortus: "bg-blue-100 text-blue-800 border-blue-200",
    suis: "bg-green-100 text-green-800 border-green-200",
    canis: "bg-yellow-100 text-yellow-800 border-yellow-200",
    ceti: "bg-purple-100 text-purple-800 border-purple-200",
    ovis: "bg-orange-100 text-orange-800 border-orange-200",
  } as const;

  const toggleRowSelection = (id: number) => {
    if (selectedRows.includes(id)) {
      setSelectedRows(selectedRows.filter((rowId) => rowId !== id));
    } else {
      setSelectedRows([...selectedRows, id]);
    }
  };

  const getColorForSpecies = (type: keyof typeof colors) => {
    return colors[type] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="flex h-16 items-center justify-between px-4">
          <div className="flex items-center">
            <div className="flex items-center">
              <div className="mr-2 rounded bg-green-600 px-3 py-1 font-bold text-white">
                BRC
              </div>
              <h1 className="text-xl font-semibold text-gray-900">
                Brucella Genome Explorer
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative w-64">
              <Search className="absolute top-2.5 left-2 h-4 w-4 text-gray-500" />
              <Input placeholder="Search genomes..." className="pr-4 pl-8" />
            </div>
            <Button variant="outline" size="sm">
              Help
            </Button>
            <Button variant="outline" size="sm">
              About
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Taxonomy and Filters */}
        <div
          className={`border-r border-gray-200 bg-white ${filterOpen ? "w-72" : "w-16"} transition-all duration-300`}
        >
          <div className="flex items-center justify-between border-b border-gray-200 p-3">
            {filterOpen && <h2 className="text-sm font-medium">Explorer</h2>}
            <Button
              variant="ghost"
              size="sm"
              className={filterOpen ? "" : "mx-auto"}
              onClick={() => setFilterOpen(!filterOpen)}
            >
              {filterOpen ? (
                <X className="h-4 w-4" />
              ) : (
                <Filter className="h-4 w-4" />
              )}
            </Button>
          </div>

          {filterOpen ? (
            <ScrollArea className="h-full">
              <div className="p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-medium">Taxonomy</h3>
                </div>

                <div className="mb-6 space-y-1 text-sm">
                  <div className="flex items-center justify-between py-1 pl-2 text-blue-600">
                    Bacteria
                    <ChevronRight className="h-4 w-4" />
                  </div>
                  <div className="flex items-center justify-between py-1 pl-4 text-blue-600">
                    Pseudomonadota
                    <ChevronRight className="h-4 w-4" />
                  </div>
                  <div className="flex items-center justify-between py-1 pl-6 text-blue-600">
                    Alphaproteobacteria
                    <ChevronRight className="h-4 w-4" />
                  </div>
                  <div className="flex items-center justify-between py-1 pl-8 text-blue-600">
                    Hyphomicrobiales
                    <ChevronRight className="h-4 w-4" />
                  </div>
                  <div className="flex items-center justify-between py-1 pl-10 text-blue-600">
                    Brucellaceae
                    <ChevronRight className="h-4 w-4" />
                  </div>
                  <div className="rounded bg-blue-100 py-1.5 pl-12 font-medium text-blue-700">
                    Brucella (1791)
                  </div>
                </div>

                <Separator className="my-4" />

                <Accordion
                  type="multiple"
                  className="w-full"
                  defaultValue={["species", "host"]}
                >
                  <AccordionItem value="species">
                    <AccordionTrigger className="py-2 text-sm">
                      Species
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 pl-2">
                        <div className="flex items-center">
                          <Checkbox id="sp1" className="mr-2" />
                          <label htmlFor="sp1" className="flex-1 text-sm">
                            B. melitensis
                          </label>
                          <span className="text-xs text-gray-500">840</span>
                        </div>
                        <div className="flex items-center">
                          <Checkbox id="sp2" className="mr-2" />
                          <label htmlFor="sp2" className="flex-1 text-sm">
                            B. abortus
                          </label>
                          <span className="text-xs text-gray-500">612</span>
                        </div>
                        <div className="flex items-center">
                          <Checkbox id="sp3" className="mr-2" />
                          <label htmlFor="sp3" className="flex-1 text-sm">
                            B. suis
                          </label>
                          <span className="text-xs text-gray-500">204</span>
                        </div>
                        <div className="flex items-center">
                          <Checkbox id="sp4" className="mr-2" />
                          <label htmlFor="sp4" className="flex-1 text-sm">
                            B. canis
                          </label>
                          <span className="text-xs text-gray-500">65</span>
                        </div>
                        <div className="flex items-center">
                          <Checkbox id="sp5" className="mr-2" defaultChecked />
                          <label htmlFor="sp5" className="flex-1 text-sm">
                            B. ceti
                          </label>
                          <span className="text-xs text-gray-500">42</span>
                        </div>
                        <div className="flex items-center">
                          <Checkbox id="sp6" className="mr-2" />
                          <label htmlFor="sp6" className="flex-1 text-sm">
                            B. ovis
                          </label>
                          <span className="text-xs text-gray-500">28</span>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="host">
                    <AccordionTrigger className="py-2 text-sm">
                      Host
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 pl-2">
                        <div className="flex items-center">
                          <Checkbox id="h1" className="mr-2" />
                          <label htmlFor="h1" className="flex-1 text-sm">
                            Human
                          </label>
                          <span className="text-xs text-gray-500">943</span>
                        </div>
                        <div className="flex items-center">
                          <Checkbox id="h2" className="mr-2" />
                          <label htmlFor="h2" className="flex-1 text-sm">
                            Cattle
                          </label>
                          <span className="text-xs text-gray-500">412</span>
                        </div>
                        <div className="flex items-center">
                          <Checkbox id="h3" className="mr-2" defaultChecked />
                          <label htmlFor="h3" className="flex-1 text-sm">
                            Dolphin
                          </label>
                          <span className="text-xs text-gray-500">38</span>
                        </div>
                        <div className="flex items-center">
                          <Checkbox id="h4" className="mr-2" defaultChecked />
                          <label htmlFor="h4" className="flex-1 text-sm">
                            Grey Seal
                          </label>
                          <span className="text-xs text-gray-500">29</span>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="year">
                    <AccordionTrigger className="py-2 text-sm">
                      Year
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 px-2">
                        <div>
                          <div className="mb-2 flex justify-between">
                            <span className="text-xs">2005</span>
                            <span className="text-xs">2017</span>
                          </div>
                          <Slider
                            defaultValue={[2010, 2017]}
                            min={2005}
                            max={2017}
                            step={1}
                          />
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(genomeStats.yearDistribution).map(
                            ([year, count]) => (
                              <Badge
                                key={year}
                                variant="outline"
                                className="cursor-pointer text-xs hover:bg-gray-100"
                              >
                                {year} ({count})
                              </Badge>
                            ),
                          )}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="countries">
                    <AccordionTrigger className="py-2 text-sm">
                      Countries
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 pl-2">
                        <div className="flex items-center">
                          <Checkbox id="c1" className="mr-2" />
                          <label htmlFor="c1" className="flex-1 text-sm">
                            Tunisia
                          </label>
                          <span className="text-xs text-gray-500">324</span>
                        </div>
                        <div className="flex items-center">
                          <Checkbox id="c2" className="mr-2" defaultChecked />
                          <label htmlFor="c2" className="flex-1 text-sm">
                            France
                          </label>
                          <span className="text-xs text-gray-500">215</span>
                        </div>
                        <div className="flex items-center">
                          <Checkbox id="c3" className="mr-2" defaultChecked />
                          <label htmlFor="c3" className="flex-1 text-sm">
                            Finland
                          </label>
                          <span className="text-xs text-gray-500">86</span>
                        </div>
                        <div className="flex items-center">
                          <Checkbox id="c4" className="mr-2" defaultChecked />
                          <label htmlFor="c4" className="flex-1 text-sm">
                            United Kingdom
                          </label>
                          <span className="text-xs text-gray-500">92</span>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="genome-size">
                    <AccordionTrigger className="py-2 text-sm">
                      Genome Size
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 px-2">
                        <div>
                          <div className="mb-2 flex justify-between">
                            <span className="text-xs">3.2Mb</span>
                            <span className="text-xs">3.5Mb</span>
                          </div>
                          <Slider
                            defaultValue={[3.2, 3.5]}
                            min={3.2}
                            max={3.5}
                            step={0.1}
                          />
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                <div className="mt-6 flex justify-end gap-2">
                  <Button variant="outline" size="sm">
                    Reset
                  </Button>
                  <Button size="sm">Apply</Button>
                </div>
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center space-y-6 py-4">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <BarChart2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Map className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Dashboard Header */}
          <div className="border-b bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold">Brucella Genomes</h1>
                <div className="text-sm text-gray-500">
                  1,791 genomes available, last updated April 2025
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  <Download className="mr-1 h-4 w-4" />
                  Export
                </Button>
                <div className="flex rounded-md border border-gray-200">
                  <Button
                    variant={viewType === "list" ? "secondary" : "ghost"}
                    size="sm"
                    className="rounded-r-none"
                    onClick={() => setViewType("list")}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewType === "grid" ? "secondary" : "ghost"}
                    size="sm"
                    className="rounded-l-none"
                    onClick={() => setViewType("grid")}
                  >
                    <Grid className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="p-4">
                  <h3 className="mb-2 text-sm font-medium">
                    Species Distribution
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(genomeStats.speciesCount).map(
                      ([species, count]) => (
                        <div key={species} className="flex items-center gap-2">
                          <div
                            className={`h-2 w-2 rounded-full ${getColorForSpecies(
                              species as keyof typeof colors,
                            )
                              .split(" ")[0]
                              .replace("bg-", "bg-")}`}
                          ></div>
                          <div className="flex-1 text-xs">B. {species}</div>
                          <div className="text-xs font-medium">{count}</div>
                          <Progress
                            value={(count / genomeStats.totalGenomes) * 100}
                            className="h-1 w-20"
                          />
                        </div>
                      ),
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <h3 className="mb-2 text-sm font-medium">
                    Host Distribution
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(genomeStats.hostDistribution).map(
                      ([host, count]) => (
                        <div key={host} className="flex items-center gap-2">
                          <div
                            className={`h-2 w-2 rounded-full ${
                              host === "human"
                                ? "bg-red-500"
                                : host === "cattle"
                                  ? "bg-blue-500"
                                  : host === "dolphin"
                                    ? "bg-purple-500"
                                    : host === "seal"
                                      ? "bg-cyan-500"
                                      : host === "pig"
                                        ? "bg-pink-500"
                                        : "bg-gray-500"
                            }`}
                          ></div>
                          <div className="flex-1 text-xs capitalize">
                            {host}
                          </div>
                          <div className="text-xs font-medium">{count}</div>
                          <Progress
                            value={(count / genomeStats.totalGenomes) * 100}
                            className="h-1 w-20"
                          />
                        </div>
                      ),
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <h3 className="mb-2 text-sm font-medium">Collection Years</h3>
                  <div className="space-y-2">
                    {Object.entries(genomeStats.yearDistribution).map(
                      ([year, count]) => (
                        <div key={year} className="flex items-center gap-2">
                          <div className="flex-1 text-xs">{year}</div>
                          <div className="text-xs font-medium">{count}</div>
                          <Progress
                            value={(count / genomeStats.totalGenomes) * 100}
                            className="h-1 w-20"
                          />
                        </div>
                      ),
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Active Filters */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="flex items-center gap-1">
                <span>Species: B. ceti</span>
                <X className="h-3 w-3 cursor-pointer" />
              </Badge>
              <Badge variant="secondary" className="flex items-center gap-1">
                <span>Host: Dolphin, Grey Seal</span>
                <X className="h-3 w-3 cursor-pointer" />
              </Badge>
              <Badge variant="secondary" className="flex items-center gap-1">
                <span>Country: France, Finland, UK</span>
                <X className="h-3 w-3 cursor-pointer" />
              </Badge>
              <Badge
                variant="outline"
                className="flex items-center gap-1 text-blue-600"
              >
                <span>Clear All Filters</span>
              </Badge>
            </div>
          </div>

          {/* Genome Content */}
          <div className="flex-1 overflow-auto p-4">
            {viewType === "grid" ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {genomeData.map((genome) => (
                  <Card
                    key={genome.id}
                    className="overflow-hidden transition-shadow hover:shadow-md"
                  >
                    <CardHeader className="p-4 pb-2">
                      <Badge
                        className={`mb-2 ${getColorForSpecies(genome.type as keyof typeof colors)} border text-xs`}
                      >
                        B. {genome.type}
                      </Badge>
                      <CardTitle className="text-md">{genome.name}</CardTitle>
                      <CardDescription className="text-xs">
                        Strain: {genome.strain}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-2">
                      <div className="grid grid-cols-2 gap-y-2 text-sm">
                        <div className="text-gray-500">GenBank:</div>
                        <div className="truncate text-right">
                          {genome.genbank}
                        </div>
                        <div className="text-gray-500">Size:</div>
                        <div className="text-right">
                          {(genome.size / 1000000).toFixed(2)} Mb
                        </div>
                        <div className="text-gray-500">CDS:</div>
                        <div className="text-right">{genome.cds}</div>
                        <div className="text-gray-500">Year:</div>
                        <div className="text-right">{genome.year}</div>
                        <div className="text-gray-500">Country:</div>
                        <div className="text-right">{genome.country}</div>
                        {genome.host && (
                          <>
                            <div className="text-gray-500">Host:</div>
                            <div className="text-right">{genome.host}</div>
                          </>
                        )}
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-between bg-gray-50 p-2">
                      <Checkbox
                        checked={selectedRows.includes(genome.id)}
                        onCheckedChange={() => toggleRowSelection(genome.id)}
                      />
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                        >
                          <Info className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                        >
                          <BarChart2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-gray-200 bg-white">
                <div className="flex border-b text-xs font-medium text-gray-500 uppercase">
                  <div className="flex w-10 items-center justify-center p-3">
                    <Checkbox />
                  </div>
                  <div className="flex-1 p-3">Genome</div>
                  <div className="w-32 p-3 text-right">Size</div>
                  <div className="w-24 p-3 text-right">CDS</div>
                  <div className="w-24 p-3 text-right">Year</div>
                  <div className="w-32 p-3">Country</div>
                  <div className="w-32 p-3">Host</div>
                  <div className="w-24 p-3"></div>
                </div>

                {genomeData.map((genome) => (
                  <div
                    key={genome.id}
                    className="flex border-b hover:bg-gray-50"
                  >
                    <div className="flex w-10 items-center justify-center p-3">
                      <Checkbox
                        checked={selectedRows.includes(genome.id)}
                        onCheckedChange={() => toggleRowSelection(genome.id)}
                      />
                    </div>
                    <div className="flex-1 p-3">
                      <div className="flex items-center gap-2">
                        <Badge
                          className={`${getColorForSpecies(genome.type as keyof typeof colors)} border text-xs`}
                        >
                          B. {genome.type}
                        </Badge>
                        <div>
                          <div className="font-medium text-blue-600">
                            {genome.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            Strain: {genome.strain}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="w-32 p-3 text-right">
                      {(genome.size / 1000000).toFixed(2)} Mb
                    </div>
                    <div className="w-24 p-3 text-right">{genome.cds}</div>
                    <div className="w-24 p-3 text-right">{genome.year}</div>
                    <div className="w-32 p-3">{genome.country}</div>
                    <div className="w-32 p-3">{genome.host || "—"}</div>
                    <div className="flex w-24 gap-1 p-3">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <Info className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pagination Footer */}
          <div className="border-t bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Showing 6 of 42 results
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled>
                  Previous
                </Button>
                <Button variant="outline" size="sm" className="px-3">
                  1
                </Button>
                <Button variant="outline" size="sm" className="px-3">
                  2
                </Button>
                <Button variant="outline" size="sm" className="px-3">
                  3
                </Button>
                <span>...</span>
                <Button variant="outline" size="sm" className="px-3">
                  7
                </Button>
                <Button variant="outline" size="sm">
                  Next
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
