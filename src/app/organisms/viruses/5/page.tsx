"use client";

import React, { useState } from "react";
import {
  PiVirus,
  PiInfo,
  PiDna,
  PiPuzzlePiece,
  PiCube,
  PiArrowSquareOut,
  PiDatabaseBold,
  PiBook,
  PiNewspaper,
  PiCaretDown,
  PiPlus,
  PiMagnifyingGlass,
  PiDownload,
} from "react-icons/pi";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";


export default function TaxonomyView() {
  const [searchQuery, setSearchQuery] = useState("");

  // Sample data for charts
  const hostData = [
    { name: "Human", value: 1857839, color: "#6366f1" },
    { name: "Mammal", value: 430063, color: "#10b981" },
    { name: "Avian", value: 406818, color: "#f59e0b" },
    { name: "Primates", value: 97112, color: "#ef4444" },
    { name: "Other", value: 273337, color: "#8b5cf6" },
  ];

  const yearData = [
    { name: "2020", count: 585870 },
    { name: "2021", count: 1432600 },
    { name: "2022", count: 2806402 },
    { name: "2023", count: 3238621 },
  ];

  const taxonomyStats = [
    {
      name: "Genomes",
      value: "12.4M",
      icon: <PiDna className="h-5 w-5" />,
      change: "+14% from 2023",
    },
    {
      name: "Species",
      value: "29,953",
      icon: <PiVirus className="h-5 w-5" />,
      change: "+218 new species",
    },
    {
      name: "Protein Structures",
      value: "47,106",
      icon: <PiCube className="h-5 w-5" />,
      change: "+8% from 2023",
    },
    {
      name: "Coding Genes",
      value: "238M",
      icon: <PiDna className="h-5 w-5" />,
      change: "+11M this year",
    },
  ];

  const recentArticles = [
    {
      id: 1,
      date: "2023 Apr 22",
      title:
        "The G2mL mutation can convert a highly pathogenic H5 2,3,4,6 virus to bind human-type receptors",
      authors: "Rios Carrasco M et al.",
      journal: "Proc Natl Acad Sci U S A",
      color: "bg-blue-100",
    },
    {
      id: 2,
      date: "2023 Apr 8",
      title:
        "Management of pain and other palliative needs in older people with HIV",
      authors: "Nguyen N et al.",
      journal: "Curr Opin HIV AIDS",
      color: "bg-green-100",
    },
    {
      id: 3,
      date: "2023 Apr 1",
      title:
        "Plastic Waste and COVID-19 Incidence Among Hospital Staff After Deescalation in PPE Use",
      authors: "Savic C",
      journal: "JAMA NetwOpen",
      color: "bg-purple-100",
    },
  ];

  const referenceGenomes = [
    {
      id: "DV1",
      type: "Reference",
      name: "Dengue virus 1",
      family: "Flaviviridae",
    },
    {
      id: "AMCA1",
      type: "Reference",
      name: "Amdoparvovirus sp. amdo-CA1",
      family: "Parvoviridae",
    },
    {
      id: "BAT1",
      type: "Reference",
      name: "Bat picornavirus 1 NC16A",
      family: "Picornaviridae",
    },
    {
      id: "BIMITI",
      type: "Reference",
      name: "Bimiti virus TRVL 8362",
      family: "Peribunyaviridae",
    },
    {
      id: "YBV1",
      type: "Reference",
      name: "Yongsan bunyavirus 1 YBV/16-0052/ROK/2016",
      family: "Hantaviridae",
    },
    {
      id: "KARUMBA",
      type: "Reference",
      name: "Karumba virus",
      family: "Rhabdoviridae",
    },
    {
      id: "POLY1",
      type: "Reference",
      name: "Polyomavirus sp. poly-CA1",
      family: "Polyomaviridae",
    },
  ];

  const locationData = [
    { country: "Germany", count: 945342 },
    { country: "Denmark", count: 515832 },
    { country: "United Kingdom", count: 426239 },
    { country: "United States", count: 1687123 },
    { country: "China", count: 574221 },
    { country: "Others", count: 357328 },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-white shadow-sm">
        <div className="container mx-auto">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 bg-indigo-100">
                <AvatarFallback className="text-indigo-600">
                  <PiVirus className="h-6 w-6" />
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="flex items-center gap-2 text-xl font-semibold">
                  VirusDB
                  <Badge variant="outline" className="ml-2 font-normal">
                    Beta
                  </Badge>
                </h1>
                <p className="text-muted-foreground text-sm">
                  Comprehensive viral taxonomy and genomics database
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative w-64">
                <Input
                  placeholder="Search viruses, genomes, genes..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <PiMagnifyingGlass className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
              </div>

              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon">
                      <PiDownload className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Export Data</TooltipContent>
                </UITooltip>
              </TooltipProvider>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-1">
                    Tools
                    <PiCaretDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <PiDna className="mr-2 h-4 w-4" />
                    Genome Browser
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <PiDna className="mr-2 h-4 w-4" />
                    Protein Analysis
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <PiDatabaseBold className="mr-2 h-4 w-4" />
                    BET Resources
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Breadcrumb and Stats */}
          <div className="flex items-center justify-between bg-indigo-50 px-4 py-2">
            <div className="flex items-center gap-1 text-sm">
              <span className="text-muted-foreground">Taxonomy:</span>
              <Badge variant="secondary" className="font-normal">
                Viruses
              </Badge>
              <span className="text-muted-foreground mx-1">|</span>
              <Badge variant="outline" className="bg-white font-normal">
                <span className="mr-1 font-medium text-indigo-500">
                  12,408,052
                </span>
                <span className="text-muted-foreground">Genomes</span>
              </Badge>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="bg-white">
                Updated: April 2023
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="mb-8">
          <h2 className="mb-6 text-2xl font-bold text-gray-800">
            Taxonomy Overview
          </h2>

          {/* Stats Cards */}
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {taxonomyStats.map((stat, i) => (
              <Card key={i} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex justify-between">
                    <CardTitle className="text-muted-foreground text-sm font-medium">
                      {stat.name}
                    </CardTitle>
                    {stat.icon}
                  </div>
                </CardHeader>
                <CardContent className="pb-2">
                  <div className="text-2xl font-bold">{stat.value}</div>
                </CardContent>
                <CardFooter className="pt-0">
                  <p className="text-muted-foreground text-xs">{stat.change}</p>
                </CardFooter>
              </Card>
            ))}
          </div>

          {/* Charts Row */}
          <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Host Distribution */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Host Distribution</CardTitle>
                <CardDescription>
                  Organisms hosting these viruses
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={hostData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        fill="#8884d8"
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) =>
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                        labelLine={false}
                      >
                        {hostData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Collection by Year */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Collection By Year</CardTitle>
                <CardDescription>
                  New genomes collected annually
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={yearData}>
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar
                        dataKey="count"
                        fill="#6366f1"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Geographic Distribution */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">
                  Geographic Distribution
                </CardTitle>
                <CardDescription>
                  Isolation locations by country
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={locationData}
                      layout="vertical"
                      margin={{ left: 80 }}
                    >
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="country" width={80} />
                      <Tooltip />
                      <Bar
                        dataKey="count"
                        fill="#10b981"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Data Tabs */}
          <Tabs defaultValue="reference" className="w-full">
            <TabsList className="mb-4 grid w-full grid-cols-3">
              <TabsTrigger value="reference" className="text-sm">
                <PiDna className="mr-2 h-4 w-4" />
                Reference Genomes
              </TabsTrigger>
              <TabsTrigger value="taxonomy" className="text-sm">
                <PiPuzzlePiece className="mr-2 h-4 w-4" />
                Taxonomy Details
              </TabsTrigger>
              <TabsTrigger value="publications" className="text-sm">
                <PiNewspaper className="mr-2 h-4 w-4" />
                Recent Publications
              </TabsTrigger>
            </TabsList>

            {/* Reference Genomes Tab Content */}
            <TabsContent value="reference" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Reference Genomes</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="text-xs">
                    <PiDownload className="mr-1 h-3 w-3" />
                    Export
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs">
                    <PiPlus className="mr-1 h-3 w-3" />
                    Filter
                  </Button>
                </div>
              </div>

              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="w-[80px]">ID</TableHead>
                        <TableHead className="w-[150px]">Type</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead className="w-[180px]">Family</TableHead>
                        <TableHead className="w-[120px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {referenceGenomes.map((genome, i) => (
                        <TableRow key={i} className="hover:bg-gray-50">
                          <TableCell className="font-mono text-xs">
                            {genome.id}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{genome.type}</Badge>
                          </TableCell>
                          <TableCell className="cursor-pointer font-medium text-indigo-600 hover:text-indigo-800 hover:underline">
                            {genome.name}
                          </TableCell>
                          <TableCell className="text-sm">
                            {genome.family}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                              >
                                <PiInfo className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                              >
                                <PiDna className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                              >
                                <PiArrowSquareOut className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
                <CardFooter className="flex items-center justify-between border-t px-6 py-3">
                  <div className="text-muted-foreground text-sm">
                    Showing 7 of 29,953 reference genomes
                  </div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" disabled>
                      Previous
                    </Button>
                    <Button variant="outline" size="sm">
                      Next
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            </TabsContent>

            {/* Taxonomy Detail Tab Content */}
            <TabsContent value="taxonomy" className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Taxonomy Classification</CardTitle>
                    <CardDescription>
                      Full taxonomic classification for Viruses
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between border-b py-2">
                        <span className="font-medium">Taxon ID</span>
                        <span>10239</span>
                      </div>
                      <div className="flex justify-between border-b py-2">
                        <span className="font-medium">Taxon Name</span>
                        <span>Viruses</span>
                      </div>
                      <div className="flex justify-between border-b py-2">
                        <span className="font-medium">Taxon Rank</span>
                        <span>superkingdom</span>
                      </div>
                      <div className="flex justify-between border-b py-2">
                        <span className="font-medium">Families</span>
                        <span>124</span>
                      </div>
                      <div className="flex justify-between border-b py-2">
                        <span className="font-medium">Genera</span>
                        <span>2,144</span>
                      </div>
                      <div className="flex justify-between border-b py-2">
                        <span className="font-medium">Species</span>
                        <span>29,953</span>
                      </div>
                      <div className="flex justify-between border-b py-2">
                        <span className="font-medium">Strains</span>
                        <span>284,885</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Genomic Data</CardTitle>
                    <CardDescription>
                      Genome sequence and protein statistics
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between border-b py-2">
                        <span className="font-medium">Genomes / Segments</span>
                        <span>12,408,052</span>
                      </div>
                      <div className="flex justify-between border-b py-2">
                        <span className="font-medium">
                          Protein Coding Genes (CDS)
                        </span>
                        <span>238,272,323</span>
                      </div>
                      <div className="flex justify-between border-b py-2">
                        <span className="font-medium">Mature Peptides</span>
                        <span>214,921,873</span>
                      </div>
                      <div className="flex justify-between border-b py-2">
                        <span className="font-medium">
                          3D Protein Structures (PDB)
                        </span>
                        <span>47,106</span>
                      </div>
                      <div className="flex justify-between border-b py-2">
                        <span className="font-medium">Average Genome Size</span>
                        <span>18.4 Kb</span>
                      </div>
                      <div className="flex justify-between border-b py-2">
                        <span className="font-medium">Total Base Pairs</span>
                        <span>228.3 Gb</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Publications Tab Content */}
            <TabsContent value="publications" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Recent Publications</h3>
                <Button variant="outline" size="sm" className="text-xs">
                  <PiBook className="mr-1 h-3 w-3" />
                  View All
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {recentArticles.map((article) => (
                  <Card
                    key={article.id}
                    className={`border-l-4 border-l-indigo-500 ${article.color}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex flex-col space-y-1">
                        <div className="flex items-start justify-between">
                          <span className="text-muted-foreground text-sm">
                            {article.date}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            New
                          </Badge>
                        </div>
                        <h4 className="cursor-pointer font-semibold text-indigo-700 hover:text-indigo-900 hover:underline">
                          {article.title}
                        </h4>
                        <div className="text-sm">{article.authors}</div>
                        <div className="text-muted-foreground text-sm italic">
                          {article.journal}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="mt-2 flex justify-center">
                <Button variant="ghost" size="sm" className="text-indigo-600">
                  Show more articles
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
