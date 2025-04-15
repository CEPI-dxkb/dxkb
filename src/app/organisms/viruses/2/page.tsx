"use client";

import { useState } from "react";
import { Search, Filter, Download, ChevronDown, Menu } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "@/components/ui/card";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function BrucellaGenomeViewer() {
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState("genomes");
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
    },
    // More data would be here
  ];

  const toggleRowSelection = (id: number) => {
    if (selectedRows.includes(id)) {
      setSelectedRows(selectedRows.filter((rowId) => rowId !== id));
    } else {
      setSelectedRows([...selectedRows, id]);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="flex h-16 items-center justify-between px-4">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              className="mr-2 md:hidden"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center">
              <div className="mr-2 rounded bg-green-600 px-3 py-1 font-bold text-white">
                BRC
              </div>
              <h1 className="text-xl font-semibold text-gray-900">
                Genome Browser
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative w-64">
              <Search className="absolute top-2.5 left-2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search all genomes..."
                className="pr-4 pl-8"
              />
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
        {/* Sidebar for Taxonomy Browser */}
        <div
          className={`border-r border-gray-200 bg-gray-50 ${sidebarOpen ? "block" : "hidden"} md:block`}
          style={{ width: "280px" }}
        >
          <div className="border-b border-gray-200 p-4">
            <h2 className="text-lg font-medium">Taxonomy Browser</h2>
          </div>
          <div className="p-2">
            <ul className="space-y-1">
              <li className="cursor-pointer rounded-md px-2 py-1 text-blue-600 hover:bg-gray-100">
                Bacteria
              </li>
              <li className="cursor-pointer rounded-md px-2 py-1 pl-4 text-blue-600 hover:bg-gray-100">
                › Pseudomonadota
              </li>
              <li className="cursor-pointer rounded-md px-2 py-1 pl-6 text-blue-600 hover:bg-gray-100">
                › Alphaproteobacteria
              </li>
              <li className="cursor-pointer rounded-md px-2 py-1 pl-8 text-blue-600 hover:bg-gray-100">
                › Hyphomicrobiales
              </li>
              <li className="cursor-pointer rounded-md px-2 py-1 pl-10 text-blue-600 hover:bg-gray-100">
                › Brucellaceae
              </li>
              <li className="cursor-pointer rounded-md bg-blue-100 px-2 py-1 pl-12 font-medium text-blue-600">
                › Brucella (1791 Genomes)
              </li>
            </ul>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Tabs Navigation */}
          <Tabs
            defaultValue="genomes"
            className="w-full"
            value={activeTab}
            onValueChange={setActiveTab}
          >
            <div className="border-b border-gray-200 bg-gray-50">
              <TabsList className="h-10 bg-transparent">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="phylogeny">Phylogeny</TabsTrigger>
                <TabsTrigger value="taxonomy">Taxonomy</TabsTrigger>
                <TabsTrigger
                  value="genomes"
                  className="border-b-2 border-blue-600 bg-white"
                >
                  Genomes
                </TabsTrigger>
                <TabsTrigger value="amr">AMR Phenotypes</TabsTrigger>
                <TabsTrigger value="sequences">Sequences</TabsTrigger>
                <TabsTrigger value="features">Features</TabsTrigger>
                <TabsTrigger value="proteins">Proteins</TabsTrigger>
                <TabsTrigger value="structures">Protein Structures</TabsTrigger>
                <TabsTrigger value="genes">Specialty Genes</TabsTrigger>
                <TabsTrigger value="domains">Domains and Motifs</TabsTrigger>
                <TabsTrigger value="epitopes">Epitopes</TabsTrigger>
                <TabsTrigger value="pathways">Pathways</TabsTrigger>
                <TabsTrigger value="subsystems">Subsystems</TabsTrigger>
                <TabsTrigger value="experiments">Experiments</TabsTrigger>
                <TabsTrigger value="interactions">Interactions</TabsTrigger>
              </TabsList>
            </div>

            {/* Genomes Tab Content */}
            <TabsContent value="genomes" className="flex-1 overflow-hidden">
              <div className="border-b border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-sm">
                      1791 Genomes
                    </Badge>
                    <Badge variant="secondary" className="text-sm">
                      Page 1 of 90
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="gap-1">
                      <Filter className="h-4 w-4" />
                      <span>Filter</span>
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1">
                      <Download className="h-4 w-4" />
                      <span>Download</span>
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1">
                          <span>Columns</span>
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem>
                          <Checkbox
                            id="strain"
                            className="mr-2"
                            defaultChecked
                          />
                          <label htmlFor="strain">Strain</label>
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Checkbox
                            id="genbank"
                            className="mr-2"
                            defaultChecked
                          />
                          <label htmlFor="genbank">GenBank Accessions</label>
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Checkbox id="size" className="mr-2" defaultChecked />
                          <label htmlFor="size">Size</label>
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Checkbox id="cds" className="mr-2" defaultChecked />
                          <label htmlFor="cds">CDS</label>
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Checkbox id="year" className="mr-2" defaultChecked />
                          <label htmlFor="year">Collection Year</label>
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Checkbox
                            id="country"
                            className="mr-2"
                            defaultChecked
                          />
                          <label htmlFor="country">Isolation Country</label>
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Checkbox id="host" className="mr-2" defaultChecked />
                          <label htmlFor="host">Host Common Name</label>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-auto">
                {/* Custom Table Implementation */}
                <div className="min-w-full divide-y divide-gray-200">
                  {/* Table Header */}
                  <div className="sticky top-0 bg-white">
                    <div className="flex border-b border-gray-200">
                      <div className="w-10 px-4 py-3 text-left">
                        <Checkbox />
                      </div>
                      <div className="w-1/4 px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        Genome Name
                      </div>
                      <div className="w-1/6 px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        Strain
                      </div>
                      <div className="w-1/6 px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        GenBank Accessions
                      </div>
                      <div className="w-1/12 px-4 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                        Size
                      </div>
                      <div className="w-1/12 px-4 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                        CDS
                      </div>
                      <div className="w-1/12 px-4 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                        Collection Year
                      </div>
                      <div className="w-1/8 px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        Isolation Country
                      </div>
                      <div className="w-1/8 px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        Host Common Name
                      </div>
                    </div>
                  </div>

                  {/* Table Body */}
                  <div className="divide-y divide-gray-200 bg-white">
                    {genomeData.map((genome) => (
                      <div key={genome.id} className="flex hover:bg-gray-50">
                        <div className="w-10 px-4 py-4 whitespace-nowrap">
                          <Checkbox
                            checked={selectedRows.includes(genome.id)}
                            onCheckedChange={() =>
                              toggleRowSelection(genome.id)
                            }
                          />
                        </div>
                        <div className="w-1/4 px-4 py-4 whitespace-nowrap">
                          <div className="cursor-pointer font-medium text-blue-600 hover:underline">
                            {genome.name}
                          </div>
                        </div>
                        <div className="w-1/6 px-4 py-4 text-sm whitespace-nowrap text-gray-900">
                          {genome.strain}
                        </div>
                        <div className="w-1/6 px-4 py-4 text-sm whitespace-nowrap text-gray-900">
                          {genome.genbank}
                        </div>
                        <div className="w-1/12 px-4 py-4 text-right text-sm whitespace-nowrap text-gray-900">
                          {genome.size.toLocaleString()}
                        </div>
                        <div className="w-1/12 px-4 py-4 text-right text-sm whitespace-nowrap text-gray-900">
                          {genome.cds}
                        </div>
                        <div className="w-1/12 px-4 py-4 text-right text-sm whitespace-nowrap text-gray-900">
                          {genome.year}
                        </div>
                        <div className="w-1/8 px-4 py-4 text-sm whitespace-nowrap text-gray-900">
                          {genome.country}
                        </div>
                        <div className="w-1/8 px-4 py-4 text-sm whitespace-nowrap text-gray-900">
                          {genome.host}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    Showing 1-20 of 1791 results
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
                      90
                    </Button>
                    <Button variant="outline" size="sm">
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Other tab contents would go here */}
            <TabsContent value="overview">
              <Card className="m-4">
                <CardHeader>
                  <CardTitle>Brucella Overview</CardTitle>
                  <CardDescription>
                    Summary information about the Brucella genus
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p>Overview content would appear here</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Side panel for filters - hidden by default */}
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              className="fixed right-4 bottom-4 h-12 w-12 rounded-full shadow-lg md:hidden"
            >
              <Filter className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right">
            <div className="flex h-full flex-col">
              <div className="border-b py-4">
                <h3 className="text-lg font-medium">Filter Options</h3>
              </div>
              <ScrollArea className="flex-1">
                <div className="space-y-4 py-4">
                  <div>
                    <h4 className="mb-2 font-medium">Collection Year</h4>
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <Checkbox id="y2017" className="mr-2" />
                        <label htmlFor="y2017">2017 (24)</label>
                      </div>
                      <div className="flex items-center">
                        <Checkbox id="y2015" className="mr-2" />
                        <label htmlFor="y2015">2015 (6)</label>
                      </div>
                      <div className="flex items-center">
                        <Checkbox id="y2014" className="mr-2" />
                        <label htmlFor="y2014">2014 (8)</label>
                      </div>
                      <div className="flex items-center">
                        <Checkbox id="y2012" className="mr-2" />
                        <label htmlFor="y2012">2012 (5)</label>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="mb-2 font-medium">Isolation Country</h4>
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <Checkbox id="cTunisia" className="mr-2" />
                        <label htmlFor="cTunisia">Tunisia (18)</label>
                      </div>
                      <div className="flex items-center">
                        <Checkbox id="cFrance" className="mr-2" />
                        <label htmlFor="cFrance">France (8)</label>
                      </div>
                      <div className="flex items-center">
                        <Checkbox id="cUK" className="mr-2" />
                        <label htmlFor="cUK">United Kingdom (4)</label>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="mb-2 font-medium">Host</h4>
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <Checkbox id="hHuman" className="mr-2" />
                        <label htmlFor="hHuman">Human (22)</label>
                      </div>
                      <div className="flex items-center">
                        <Checkbox id="hDolphin" className="mr-2" />
                        <label htmlFor="hDolphin">Dolphin (6)</label>
                      </div>
                      <div className="flex items-center">
                        <Checkbox id="hSeal" className="mr-2" />
                        <label htmlFor="hSeal">Grey Seal (4)</label>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>
              <div className="flex justify-end gap-2 border-t py-4">
                <Button variant="outline">Reset</Button>
                <Button>Apply Filters</Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
