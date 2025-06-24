"use client";

import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import {
  PiVirus,
  PiInfo,
  PiDna,
  PiPuzzlePiece,
  PiCube,
  PiTestTube,
} from "react-icons/pi";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#A569BD"];

export default function TaxonomyView() {
  const [selectedTab, setSelectedTab] = useState("overview");

  // Sample data for pie charts
  const hostData = [
    { name: "Human", value: 1857839 },
    { name: "Mammal", value: 430063 },
    { name: "Avian", value: 406818 },
    { name: "Others", value: 273337 },
    { name: "Primates", value: 97112 },
  ];

  const isolationData = [
    { name: "Germany", value: 945342 },
    { name: "Denmark", value: 515832 },
    { name: "United Kingdom", value: 426239 },
    { name: "Others", value: 2618672 },
  ];

  const yearData = [
    { name: "2020", value: 585870 },
    { name: "2021", value: 2432600 },
    { name: "2022", value: 2806402 },
    { name: "2023", value: 8238621 },
  ];

  const referenceGenomes = [
    { type: "Reference", name: "Dengue virus 1" },
    { type: "Reference", name: "Amdoparvovirus sp. amdo-CA1" },
    { type: "Reference", name: "Bat picornavirus 1 NC16A" },
    { type: "Reference", name: "Bimiti virus TRVL 8362" },
    { type: "Reference", name: "Bimiti virus TRVL 8362" },
    { type: "Reference", name: "Yongsan bunyavirus 1 YBV/16-0052/ROK/2016" },
    { type: "Reference", name: "Karumba virus" },
    { type: "Reference", name: "Polyomavirus sp. poly-CA1" },
  ];

  const taxonomyInfo = {
    "Taxon ID": "10239",
    "Taxon Name": "Viruses",
    "Taxon Rank": "superkingdom",
    Families: "124",
    Genera: "2144",
    Species: "29953",
    Strains: "284885",
    "Genomes / Segments": "12408052",
    "Protein Coding Genes (CDS)": "238272323",
    "Mature Peptides": "214921873",
    "3D Protein Structures (PDB)": "47106",
  };

  const recentArticles = [
    {
      date: "2023 Apr 22",
      title:
        "The G2mL mutation can convert a highly pathogenic H5 2,3,4,6 virus to bind human-type receptors",
      authors: "Rios Carrasco M et al.",
      journal: "Proc Natl Acad Sci U S A",
    },
    {
      date: "2023 Apr 8",
      title:
        "Management of pain and other palliative needs in older people with HIV",
      authors: "Nguyen N et al.",
      journal: "Curr Opin HIV AIDS",
    },
    {
      date: "2023 Apr 1",
      title:
        "Plastic Waste and COVID-19 Incidence Among Hospital Staff After Deescalation in PPE Use",
      authors: "Savic C",
      journal: "JAMA NetwOpen",
    },
  ];

  return (
    <div className="bg-background text-foreground min-h-screen">
      <header className="border-b bg-white p-4">
        <div className="flex items-center gap-2">
          <PiVirus className="text-primary h-8 w-8" />
          <div>
            <h1 className="text-xl font-semibold">Taxon View</h1>
            <p className="text-muted-foreground text-sm">
              <span className="text-primary">Viruses</span> |{" "}
              <span className="text-muted-foreground">(12408052 Genomes)</span>
            </p>
          </div>
        </div>
      </header>

      <Tabs
        defaultValue="overview"
        value={selectedTab}
        onValueChange={setSelectedTab}
        className="w-full"
      >
        <TabsList className="bg-background grid w-full grid-cols-8 rounded-none border-b">
          <TabsTrigger
            value="overview"
            className="data-[state=active]:bg-white"
          >
            <PiInfo className="mr-2 h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="taxonomy"
            className="data-[state=active]:bg-white"
          >
            <PiPuzzlePiece className="mr-2 h-4 w-4" />
            Taxonomy
          </TabsTrigger>
          <TabsTrigger value="genomes" className="data-[state=active]:bg-white">
            <PiDna className="mr-2 h-4 w-4" />
            Genomes
          </TabsTrigger>
          <TabsTrigger
            value="features"
            className="data-[state=active]:bg-white"
          >
            <PiInfo className="mr-2 h-4 w-4" />
            Features
          </TabsTrigger>
          <TabsTrigger
            value="proteins"
            className="data-[state=active]:bg-white"
          >
            <PiDna className="mr-2 h-4 w-4" />
            Proteins
          </TabsTrigger>
          <TabsTrigger
            value="structures"
            className="data-[state=active]:bg-white"
          >
            <PiVirus className="mr-2 h-4 w-4" />
            Protein Structures
          </TabsTrigger>
          <TabsTrigger value="domains" className="data-[state=active]:bg-white">
            <PiCube className="mr-2 h-4 w-4" />
            Domains and Motifs
          </TabsTrigger>
          <TabsTrigger
            value="experiments"
            className="data-[state=active]:bg-white"
          >
            <PiTestTube className="mr-2 h-4 w-4" />
            Experiments
          </TabsTrigger>
        </TabsList>

        <div className="container mx-auto p-4">
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="col-span-2">
                <CardHeader className="bg-primary py-2">
                  <CardTitle className="text-sm font-medium text-white">
                    Taxonomy Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableBody>
                      {Object.entries(taxonomyInfo).map(
                        ([key, value], index) => (
                          <TableRow
                            key={index}
                            className={
                              index % 2 === 0 ? "bg-background/20" : ""
                            }
                          >
                            <TableCell className="w-1/3 font-medium">
                              {key}
                            </TableCell>
                            <TableCell className="text-right">
                              {value}
                            </TableCell>
                          </TableRow>
                        ),
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card>
                  <CardHeader className="bg-primary py-2">
                    <CardTitle className="text-sm font-medium text-white">
                      External Tools
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                      >
                        BET Resources
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="bg-primary py-2">
                    <CardTitle className="text-sm font-medium text-white">
                      Recent PubMed Articles
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-2">
                    <ScrollArea className="h-72">
                      {recentArticles.map((article, index) => (
                        <div
                          key={index}
                          className="hover:bg-background/20 mb-3 rounded p-2"
                        >
                          <div className="text-muted-foreground text-xs">
                            {article.date}
                          </div>
                          <div className="text-primary text-sm font-medium">
                            {article.title}
                          </div>
                          <div className="text-xs">{article.authors}</div>
                          <div className="text-muted-foreground text-xs italic">
                            {article.journal}
                          </div>
                        </div>
                      ))}
                      <Button variant="link" className="w-full text-xs">
                        Show more »
                      </Button>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </div>

            <Card>
              <CardHeader className="bg-primary py-2">
                <CardTitle className="text-sm font-medium text-white">
                  Genomes By Metadata
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <h3 className="mb-2 text-center text-sm font-semibold">
                      Host
                    </h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={hostData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          fill="#8884d8"
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, percent }) =>
                            `${name} ${(percent * 100).toFixed(0)}%`
                          }
                          labelLine={false}
                        >
                          {hostData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    <h3 className="mb-2 text-center text-sm font-semibold">
                      Isolation Country
                    </h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={isolationData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          fill="#8884d8"
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, percent }) =>
                            `${name} ${(percent * 100).toFixed(0)}%`
                          }
                          labelLine={false}
                        >
                          {isolationData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    <h3 className="mb-2 text-center text-sm font-semibold">
                      Collection Year
                    </h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={yearData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          fill="#8884d8"
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, percent }) =>
                            `${name} ${(percent * 100).toFixed(0)}%`
                          }
                          labelLine={false}
                        >
                          {yearData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="bg-primary py-2">
                <CardTitle className="flex justify-between text-sm font-medium text-white">
                  <span>Reference/Representative Genomes</span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="text-primary h-6 bg-white px-2 text-xs hover:bg-gray-100"
                    >
                      Full
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="text-primary h-6 bg-white px-2 text-xs hover:bg-gray-100"
                    >
                      List
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-background/20">
                      <TableHead className="w-1/6">Type</TableHead>
                      <TableHead>Genome Name</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {referenceGenomes.map((genome, index) => (
                      <TableRow key={index}>
                        <TableCell>{genome.type}</TableCell>
                        <TableCell>
                          <span className="text-primary cursor-pointer hover:underline">
                            {genome.name}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Other tabs would be implemented similarly, but showing as placeholder for brevity */}
          {[
            "taxonomy",
            "genomes",
            "features",
            "proteins",
            "structures",
            "domains",
            "experiments",
          ].map((tab) => (
            <TabsContent key={tab} value={tab}>
              <Card>
                <CardContent className="pt-6">
                  <p>This is the {tab} content panel.</p>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  );
}
