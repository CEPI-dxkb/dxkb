"use client";

import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  FiInfo,
  FiUpload,
  FiFile,
  FiDatabase,
  FiSettings,
  FiFolder,
  FiSave,
  FiList,
  FiHelpCircle,
  FiChevronRight,
  FiSearch,
  FiFilter,
  FiBarChart2,
  FiPlay,
  FiDownload,
  FiMap,
  FiAlertTriangle,
  FiAlertCircle,
  FiShield,
  FiCpu,
  FiTarget,
} from "react-icons/fi";
import { BsLinkedin, BsTwitter, BsGithub } from "react-icons/bs";

interface File {
  id: number;
  name: string;
  type: string;
}

const MetagenomicReadMappingService = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedGeneSet, setSelectedGeneSet] = useState("card");
  const [mappingProgress, setMappingProgress] = useState(0);

  // Demo data for visualization
  const demoGeneMatchData = [
    { name: "Beta-lactam resistance", count: 48, percentage: 24 },
    { name: "Tetracycline resistance", count: 35, percentage: 17.5 },
    { name: "Quinolone resistance", count: 28, percentage: 14 },
    { name: "Aminoglycoside resistance", count: 22, percentage: 11 },
    { name: "Macrolide resistance", count: 18, percentage: 9 },
  ];

  // Function to handle file selection
  const handleFileSelection = (file: File) => {
    setSelectedFiles([...selectedFiles, file]);
  };

  // Function to remove a file from selection
  const removeFile = (index: number) => {
    const newFiles = [...selectedFiles];
    newFiles.splice(index, 1);
    setSelectedFiles(newFiles);
  };

  return (
    <div className="from-background-50 to-background-100 min-h-screen bg-gradient-to-b">
      <header className="container mx-auto py-6">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div>
            <h1 className="text-primary-700 flex items-center gap-2 text-3xl font-bold">
              <FiMap className="h-7 w-7" />
              Metagenomic Read Mapping
            </h1>
            <p className="text-muted-foreground mt-1">
              Map metagenomic reads to resistance genes and virulence factors
            </p>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="outline" className="gap-2" size="sm">
              <FiHelpCircle className="h-4 w-4" />
              Tutorial
            </Button>
            <div className="flex gap-2">
              <a href="#" aria-label="GitHub">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full"
                >
                  <BsGithub className="h-5 w-5" />
                </Button>
              </a>
              <a href="#" aria-label="LinkedIn">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full"
                >
                  <BsLinkedin className="h-5 w-5" />
                </Button>
              </a>
              <a href="#" aria-label="Twitter">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full"
                >
                  <BsTwitter className="h-5 w-5" />
                </Button>
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto pb-16">
        <Card className="overflow-hidden border shadow-lg">
          <CardHeader className="border-b pb-0">
            <CardDescription>
              The Metagenomic Read Mapping Service uses KMA to align reads
              against antibiotic resistance genes from CARD and virulence
              factors from VFDB. For further explanation, please see the
              <a href="#" className="text-primary-500 ml-1 hover:underline">
                Quick Reference Guide
              </a>{" "}
              and
              <a href="#" className="text-primary-500 ml-1 hover:underline">
                Tutorial
              </a>
              .
            </CardDescription>
          </CardHeader>

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="bg-background-100 grid h-12 w-full grid-cols-4 rounded-none">
              <TabsTrigger
                value="overview"
                className="flex items-center gap-2 rounded-none data-[state=active]:bg-white data-[state=active]:shadow-none"
              >
                <FiInfo className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="input"
                className="flex items-center gap-2 rounded-none data-[state=active]:bg-white data-[state=active]:shadow-none"
              >
                <FiUpload className="h-4 w-4" />
                Input Data
              </TabsTrigger>
              <TabsTrigger
                value="parameters"
                className="flex items-center gap-2 rounded-none data-[state=active]:bg-white data-[state=active]:shadow-none"
              >
                <FiSettings className="h-4 w-4" />
                Gene Sets
              </TabsTrigger>
              <TabsTrigger
                value="results"
                className="flex items-center gap-2 rounded-none data-[state=active]:bg-white data-[state=active]:shadow-none"
              >
                <FiBarChart2 className="h-4 w-4" />
                Results
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="p-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        What is Metagenomic Read Mapping?
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-start gap-4">
                        <div className="bg-primary-100 rounded-full p-3">
                          <FiMap className="text-primary-700 h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="mb-1 font-medium">
                            Map Reads to Reference Databases
                          </h3>
                          <p className="text-muted-foreground text-sm">
                            Metagenomic read mapping aligns your sequencing
                            reads directly to reference databases of antibiotic
                            resistance genes and virulence factors to identify
                            their presence in your samples.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-4">
                        <div className="bg-primary-100 rounded-full p-3">
                          <FiAlertCircle className="text-primary-700 h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="mb-1 font-medium">
                            Detect Resistance and Virulence
                          </h3>
                          <p className="text-muted-foreground text-sm">
                            This service helps identify antibiotic resistance
                            genes from the Comprehensive Antibiotic Resistance
                            Database (CARD) and virulence factors from the
                            Virulence Factor Database (VFDB).
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-4">
                        <div className="bg-primary-100 rounded-full p-3">
                          <FiDatabase className="text-primary-700 h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="mb-1 font-medium">
                            Fast and Accurate Analysis
                          </h3>
                          <p className="text-muted-foreground text-sm">
                            KMA (K-mer alignment) provides fast and accurate
                            mapping of raw reads to complex databases, making it
                            ideal for detecting genes in metagenomic samples.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div>
                  <Card className="bg-primary-50 border-primary-100">
                    <CardHeader>
                      <CardTitle className="text-lg">Quick Start</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="border-primary-200 relative border-l pb-8 pl-8">
                          <div className="bg-primary-100 absolute top-0 -left-3 rounded-full p-1.5">
                            <span className="bg-primary-500 flex h-4 w-4 items-center justify-center rounded-full text-xs font-bold text-white">
                              1
                            </span>
                          </div>
                          <h3 className="font-medium">Upload Read Files</h3>
                          <p className="text-muted-foreground text-sm">
                            Upload your FASTQ files or provide an SRA accession
                            number
                          </p>
                        </div>

                        <div className="border-primary-200 relative border-l pb-8 pl-8">
                          <div className="bg-primary-100 absolute top-0 -left-3 rounded-full p-1.5">
                            <span className="bg-primary-500 flex h-4 w-4 items-center justify-center rounded-full text-xs font-bold text-white">
                              2
                            </span>
                          </div>
                          <h3 className="font-medium">Select Gene Set</h3>
                          <p className="text-muted-foreground text-sm">
                            Choose CARD, VFDB, or upload your own FASTA file
                          </p>
                        </div>

                        <div className="relative pl-8">
                          <div className="bg-primary-100 absolute top-0 -left-3 rounded-full p-1.5">
                            <span className="bg-primary-500 flex h-4 w-4 items-center justify-center rounded-full text-xs font-bold text-white">
                              3
                            </span>
                          </div>
                          <h3 className="font-medium">Analyze Results</h3>
                          <p className="text-muted-foreground text-sm">
                            Review identified genes and their abundance
                          </p>
                        </div>
                      </div>

                      <Button
                        className="mt-4 w-full"
                        onClick={() => setActiveTab("input")}
                      >
                        Start Now
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <div className="mt-8">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Available Reference Databases
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <Card className="bg-background-50 border-l-4 border-l-red-500">
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <FiShield className="h-5 w-5 text-red-500" />
                            CARD (Antibiotic Resistance)
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                          <p className="text-muted-foreground mb-2 text-sm">
                            The Comprehensive Antibiotic Resistance Database
                            (CARD) is a curated resource containing antibiotic
                            resistance genes, their products, and associated
                            phenotypes.
                          </p>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Version:
                              </span>
                              <span>2023-12-01</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Genes:
                              </span>
                              <span>~4,800 sequences</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Categories:
                              </span>
                              <span>23 antibiotic classes</span>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3 w-full"
                            onClick={() => {
                              setActiveTab("input");
                              setSelectedGeneSet("card");
                            }}
                          >
                            Use CARD Database
                          </Button>
                        </CardContent>
                      </Card>

                      <Card className="bg-background-50 border-l-4 border-l-blue-500">
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <FiAlertTriangle className="h-5 w-5 text-blue-500" />
                            VFDB (Virulence Factors)
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                          <p className="text-muted-foreground mb-2 text-sm">
                            The Virulence Factor Database (VFDB) is a
                            comprehensive collection of virulence factors from
                            various bacterial pathogens.
                          </p>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Version:
                              </span>
                              <span>2023-10-15</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Genes:
                              </span>
                              <span>~3,200 sequences</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Categories:
                              </span>
                              <span>Multiple virulence mechanisms</span>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3 w-full"
                            onClick={() => {
                              setActiveTab("input");
                              setSelectedGeneSet("vfdb");
                            }}
                          >
                            Use VFDB Database
                          </Button>
                        </CardContent>
                      </Card>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Input Data Tab */}
            <TabsContent value="input" className="p-6">
              <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <FiUpload className="text-primary-500 h-5 w-5" />
                      Upload Read Files
                    </CardTitle>
                    <CardDescription>
                      Select your input sequencing data
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <Card className="bg-background-50/50 border-2 border-dashed">
                        <CardContent className="p-6">
                          <div className="flex flex-col items-center justify-center space-y-2 text-center">
                            <div className="bg-primary-100 rounded-full p-3">
                              <FiUpload className="text-primary-600 h-6 w-6" />
                            </div>
                            <h3 className="font-medium">Drag and drop files</h3>
                            <p className="text-muted-foreground text-sm">
                              Drop your FASTQ files here or browse your computer
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-2"
                            >
                              Browse Files
                            </Button>
                          </div>
                        </CardContent>
                      </Card>

                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="paired-read-1" className="text-sm">
                            Forward Reads (R1)
                          </Label>
                          <div className="mt-1 flex">
                            <Input
                              id="paired-read-1"
                              type="file"
                              className="rounded-r-none text-xs"
                            />
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="secondary"
                                    size="icon"
                                    className="h-10 rounded-l-none"
                                  >
                                    <FiInfo className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Select forward read file (FASTQ)</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="paired-read-2" className="text-sm">
                            Reverse Reads (R2)
                          </Label>
                          <div className="mt-1 flex">
                            <Input
                              id="paired-read-2"
                              type="file"
                              className="rounded-r-none text-xs"
                            />
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="secondary"
                                    size="icon"
                                    className="h-10 rounded-l-none"
                                  >
                                    <FiInfo className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Select reverse read file (FASTQ)</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          className="flex w-full items-center justify-center gap-2"
                          onClick={() =>
                            handleFileSelection({
                              id: Date.now(),
                              name: "Paired reads",
                              type: "paired",
                            })
                          }
                        >
                          <FiUpload className="h-4 w-4" />
                          Add Paired Reads
                        </Button>
                      </div>

                      <Separator />

                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="single-read" className="text-sm">
                            Single Read File
                          </Label>
                          <div className="mt-1 flex">
                            <Input
                              id="single-read"
                              type="file"
                              className="rounded-r-none text-xs"
                            />
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="secondary"
                                    size="icon"
                                    className="h-10 rounded-l-none"
                                  >
                                    <FiInfo className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Select single-end read file</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          className="flex w-full items-center justify-center gap-2"
                          onClick={() =>
                            handleFileSelection({
                              id: Date.now(),
                              name: "Single read",
                              type: "single",
                            })
                          }
                        >
                          <FiUpload className="h-4 w-4" />
                          Add Single Reads
                        </Button>
                      </div>

                      <Separator />

                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="sra-id" className="text-sm">
                            SRA Accession Number
                          </Label>
                          <div className="mt-1 flex">
                            <Input
                              id="sra-id"
                              placeholder="SRR"
                              className="rounded-r-none"
                            />
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="secondary"
                                    size="icon"
                                    className="h-10 rounded-l-none"
                                  >
                                    <FiSearch className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Search for SRA accession</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <p className="text-muted-foreground mt-1 text-xs">
                            Enter an SRA run accession (e.g., SRR12345678)
                          </p>
                        </div>

                        <Button
                          variant="outline"
                          className="flex w-full items-center justify-center gap-2"
                          onClick={() =>
                            handleFileSelection({
                              id: Date.now(),
                              name: "SRA accession",
                              type: "sra",
                            })
                          }
                        >
                          <FiUpload className="h-4 w-4" />
                          Add SRA Data
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <FiList className="text-primary-500 h-5 w-5" />
                      Selected Files
                    </CardTitle>
                    <CardDescription>
                      Files selected for read mapping
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {selectedFiles.length > 0 ? (
                      <ScrollArea className="h-[350px] pr-4">
                        <div className="space-y-2">
                          {selectedFiles.map((file, index) => (
                            <div
                              key={file.id}
                              className="bg-background-100 flex items-center justify-between rounded-md p-2"
                            >
                              <div className="flex items-center gap-2">
                                <div className="bg-primary-100 rounded-full p-1">
                                  <FiFile className="text-primary-700 h-3.5 w-3.5" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium">
                                    {file.name}
                                  </p>
                                  <p className="text-muted-foreground text-xs">
                                    {file.type}
                                  </p>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="hover:bg-destructive/10 hover:text-destructive h-7 w-7"
                                onClick={() => removeFile(index)}
                              >
                                <span className="sr-only">Remove</span>
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M18 6 6 18" />
                                  <path d="m6 6 12 12" />
                                </svg>
                              </Button>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    ) : (
                      <div className="flex h-[350px] flex-col items-center justify-center py-10 text-center">
                        <div className="bg-background-200 mb-3 rounded-full p-3">
                          <FiList className="text-muted-foreground h-6 w-6" />
                        </div>
                        <h3 className="text-sm font-medium">
                          No files selected
                        </h3>
                        <p className="text-muted-foreground mt-1 max-w-md text-xs">
                          Upload your files using the form on the left
                        </p>
                      </div>
                    )}

                    <div className="mt-4">
                      <Button
                        className="w-full gap-2"
                        disabled={selectedFiles.length === 0}
                        onClick={() => setActiveTab("parameters")}
                      >
                        <FiChevronRight className="h-4 w-4" />
                        Continue to Gene Sets
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Parameters Tab */}
            <TabsContent value="parameters" className="p-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <FiDatabase className="text-primary-500 h-5 w-5" />
                        Reference Gene Sets
                      </CardTitle>
                      <CardDescription>
                        Select the reference gene set to map your reads against
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <RadioGroup
                        defaultValue="predefined_list"
                        className="space-y-6"
                      >
                        <div className="space-y-2 rounded-md border p-4">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem
                              value="predefined_list"
                              id="predefined_list"
                            />
                            <Label
                              htmlFor="predefined_list"
                              className="text-base font-medium"
                            >
                              Predefined List
                            </Label>
                          </div>
                          <div className="space-y-4 pl-6">
                            <p className="text-muted-foreground text-sm">
                              Select from curated reference databases of
                              resistance genes and virulence factors
                            </p>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <div
                                className={`hover:bg-background-100 relative cursor-pointer rounded-lg border-2 p-4 transition-all ${selectedGeneSet === "card" ? "border-primary-500 bg-primary-50" : "border-border"}`}
                                onClick={() => setSelectedGeneSet("card")}
                              >
                                <div className="mb-2 flex items-center gap-3">
                                  <div className="rounded-full bg-red-100 p-2">
                                    <FiShield className="h-5 w-5 text-red-600" />
                                  </div>
                                  <h3 className="font-medium">CARD</h3>
                                </div>
                                <p className="text-muted-foreground text-sm">
                                  Antibiotic resistance genes database
                                </p>
                              </div>

                              <div
                                className={`hover:bg-background-100 relative cursor-pointer rounded-lg border-2 p-4 transition-all ${selectedGeneSet === "vfdb" ? "border-primary-500 bg-primary-50" : "border-border"}`}
                                onClick={() => setSelectedGeneSet("vfdb")}
                              >
                                <div className="mb-2 flex items-center gap-3">
                                  <div className="rounded-full bg-blue-100 p-2">
                                    <FiAlertTriangle className="h-5 w-5 text-blue-600" />
                                  </div>
                                  <h3 className="font-medium">VFDB</h3>
                                </div>
                                <p className="text-muted-foreground text-sm">
                                  Virulence factors database
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2 rounded-md border p-4">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem
                              value="fasta_file"
                              id="fasta_file"
                            />
                            <Label
                              htmlFor="fasta_file"
                              className="text-base font-medium"
                            >
                              FASTA File
                            </Label>
                          </div>
                          <div className="space-y-4 pl-6">
                            <p className="text-muted-foreground text-sm">
                              Upload your own FASTA file containing reference
                              sequences
                            </p>

                            <div className="mt-1 flex">
                              <Input
                                type="file"
                                className="rounded-r-none text-xs"
                              />
                              <Button
                                variant="secondary"
                                size="icon"
                                className="h-10 rounded-l-none"
                              >
                                <FiUpload className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2 rounded-md border p-4">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem
                              value="feature_group"
                              id="feature_group"
                            />
                            <Label
                              htmlFor="feature_group"
                              className="text-base font-medium"
                            >
                              Feature Group
                            </Label>
                          </div>
                          <div className="space-y-4 pl-6">
                            <p className="text-muted-foreground text-sm">
                              Use a previously created feature group
                            </p>

                            <Select>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select feature group" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="amr_genes">
                                  AMR Genes
                                </SelectItem>
                                <SelectItem value="virulence_genes">
                                  Virulence Genes
                                </SelectItem>
                                <SelectItem value="custom_set">
                                  Custom Gene Set
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </RadioGroup>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">
                        Selected Gene Set
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {selectedGeneSet === "card" && (
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <div className="rounded-full bg-red-100 p-2">
                              <FiShield className="h-5 w-5 text-red-600" />
                            </div>
                            <div>
                              <h3 className="font-medium">CARD Database</h3>
                              <p className="text-muted-foreground text-xs">
                                Antibiotic resistance genes
                              </p>
                            </div>
                          </div>

                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Version:
                              </span>
                              <span>2023-12-01</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Size:
                              </span>
                              <span>~4,800 genes</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Memory Required:
                              </span>
                              <span>2-4 GB</span>
                            </div>
                          </div>

                          <div className="pt-2">
                            <p className="text-muted-foreground text-xs">
                              Common antibiotic resistance mechanisms included:
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              <Badge
                                variant="outline"
                                className="bg-background-100"
                              >
                                β-lactamases
                              </Badge>
                              <Badge
                                variant="outline"
                                className="bg-background-100"
                              >
                                Efflux pumps
                              </Badge>
                              <Badge
                                variant="outline"
                                className="bg-background-100"
                              >
                                Target modifications
                              </Badge>
                            </div>
                          </div>
                        </div>
                      )}

                      {selectedGeneSet === "vfdb" && (
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <div className="rounded-full bg-blue-100 p-2">
                              <FiAlertTriangle className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <h3 className="font-medium">VFDB Database</h3>
                              <p className="text-muted-foreground text-xs">
                                Virulence factors database
                              </p>
                            </div>
                          </div>

                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Version:
                              </span>
                              <span>2023-10-15</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Size:
                              </span>
                              <span>~3,200 genes</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Memory Required:
                              </span>
                              <span>1-3 GB</span>
                            </div>
                          </div>

                          <div className="pt-2">
                            <p className="text-muted-foreground text-xs">
                              Common virulence mechanisms included:
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              <Badge
                                variant="outline"
                                className="bg-background-100"
                              >
                                Adhesins
                              </Badge>
                              <Badge
                                variant="outline"
                                className="bg-background-100"
                              >
                                Toxins
                              </Badge>
                              <Badge
                                variant="outline"
                                className="bg-background-100"
                              >
                                Secretion systems
                              </Badge>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">
                        Output Settings
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor="output-folder">Output Folder</Label>
                        <div className="mt-1 flex">
                          <Input
                            id="output-folder"
                            placeholder="Select output folder"
                            className="rounded-r-none"
                          />
                          <Button
                            variant="secondary"
                            size="icon"
                            className="rounded-l-none"
                          >
                            <FiFolder className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="output-name">Output Name</Label>
                        <Input
                          id="output-name"
                          placeholder="Output Name"
                          className="mt-1"
                        />
                      </div>

                      <div className="flex items-center space-x-2 pt-2">
                        <Switch id="extended-output" />
                        <Label htmlFor="extended-output" className="text-sm">
                          Include extended output files
                        </Label>
                      </div>

                      <Button
                        className="mt-2 w-full gap-2"
                        onClick={() => setActiveTab("results")}
                      >
                        <FiPlay className="h-4 w-4" />
                        Run Analysis
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Results Tab */}
            <TabsContent value="results" className="p-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Mapping Results</CardTitle>
                      <CardDescription>
                        Preview of expected output format
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        <div className="bg-background-50 rounded-md p-4">
                          <h3 className="mb-2 text-sm font-medium">
                            Analysis Status
                          </h3>
                          <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span>Progress:</span>
                              <span>{mappingProgress}% complete</span>
                            </div>
                            <Progress value={mappingProgress} className="h-2" />
                            <p className="text-muted-foreground mt-1 text-xs">
                              {mappingProgress === 0
                                ? "Analysis not started"
                                : mappingProgress < 100
                                  ? "Analysis in progress..."
                                  : "Analysis complete"}
                            </p>
                          </div>
                        </div>

                        {mappingProgress > 0 ? (
                          <div className="space-y-4">
                            <div>
                              <h3 className="mb-2 text-sm font-medium">
                                Top Gene Matches
                              </h3>
                              <div className="space-y-2">
                                {demoGeneMatchData.map((gene, index) => (
                                  <div
                                    key={index}
                                    className="flex items-center"
                                  >
                                    <div className="w-1/3 text-sm">
                                      {gene.name}
                                    </div>
                                    <div className="w-2/3">
                                      <div className="flex items-center gap-2">
                                        <div className="bg-background-200 h-2.5 w-full rounded-full">
                                          <div
                                            className="bg-primary-500 h-2.5 rounded-full"
                                            style={{
                                              width: `${gene.percentage}%`,
                                            }}
                                          ></div>
                                        </div>
                                        <span className="text-muted-foreground text-xs">
                                          {gene.count} reads
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                              <div className="rounded-md border p-4">
                                <h3 className="mb-3 text-sm font-medium">
                                  Resistance Class Distribution
                                </h3>
                                <div className="bg-background-100 flex h-40 w-full items-center justify-center rounded-md">
                                  <span className="text-muted-foreground text-xs">
                                    Pie chart preview
                                  </span>
                                </div>
                              </div>

                              <div className="rounded-md border p-4">
                                <h3 className="mb-3 text-sm font-medium">
                                  Coverage Depth
                                </h3>
                                <div className="bg-background-100 flex h-40 w-full items-center justify-center rounded-md">
                                  <span className="text-muted-foreground text-xs">
                                    Bar chart preview
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-10 text-center">
                            <div className="bg-background-200 mb-4 rounded-full p-4">
                              <FiBarChart2 className="text-muted-foreground h-8 w-8" />
                            </div>
                            <h3 className="text-base font-medium">
                              Analysis not started
                            </h3>
                            <p className="text-muted-foreground mt-1 max-w-md text-sm">
                              Configure your parameters and start the analysis
                              to see the results here
                            </p>
                            <div className="mt-6 flex gap-4">
                              <Button variant="outline">
                                View Sample Results
                              </Button>
                              <Button onClick={() => setMappingProgress(5)}>
                                Start Analysis
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">
                        Summary Statistics
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {mappingProgress > 0 ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-background-50 rounded-md p-3 text-center">
                              <p className="text-muted-foreground text-xs">
                                Total Reads
                              </p>
                              <p className="text-lg font-semibold">4.2M</p>
                            </div>
                            <div className="bg-background-50 rounded-md p-3 text-center">
                              <p className="text-muted-foreground text-xs">
                                Mapped Reads
                              </p>
                              <p className="text-lg font-semibold">528K</p>
                            </div>
                            <div className="bg-background-50 rounded-md p-3 text-center">
                              <p className="text-muted-foreground text-xs">
                                Mapping Rate
                              </p>
                              <p className="text-lg font-semibold">12.6%</p>
                            </div>
                            <div className="bg-background-50 rounded-md p-3 text-center">
                              <p className="text-muted-foreground text-xs">
                                Gene Matches
                              </p>
                              <p className="text-lg font-semibold">187</p>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">
                                Analysis Duration:
                              </span>
                              <span>14 minutes</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">
                                Average Coverage:
                              </span>
                              <span>32.4×</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">
                                Avg. Identity:
                              </span>
                              <span>97.8%</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-6 text-center">
                          <p className="text-muted-foreground text-sm">
                            Statistics will appear once analysis begins
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Output Files</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3 text-sm">
                        <p className="text-muted-foreground">
                          The analysis will generate:
                        </p>

                        <div className="flex items-start space-x-2">
                          <FiFile className="text-primary-500 mt-0.5 h-4 w-4" />
                          <div>
                            <p className="font-medium">Alignment Results</p>
                            <p className="text-muted-foreground text-xs">
                              Detailed read mapping information
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start space-x-2">
                          <FiFile className="text-primary-500 mt-0.5 h-4 w-4" />
                          <div>
                            <p className="font-medium">Gene Coverage</p>
                            <p className="text-muted-foreground text-xs">
                              Coverage depth for each gene
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start space-x-2">
                          <FiFile className="text-primary-500 mt-0.5 h-4 w-4" />
                          <div>
                            <p className="font-medium">Summary Report</p>
                            <p className="text-muted-foreground text-xs">
                              Overview of mapping statistics
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 flex gap-2">
                        <Button
                          variant="outline"
                          className="w-full"
                          disabled={mappingProgress === 0}
                        >
                          <FiDownload className="mr-2 h-4 w-4" />
                          Download Results
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <FiTarget className="text-primary-500 h-4 w-4" />
                        Analysis Settings
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Gene Set:
                          </span>
                          <span>
                            {selectedGeneSet === "card"
                              ? "CARD (Resistance Genes)"
                              : "VFDB (Virulence Factors)"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Mapper:</span>
                          <span>KMA</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Min. Coverage:
                          </span>
                          <span>1.5×</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Min. Identity:
                          </span>
                          <span>90%</span>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        className="mt-3 w-full text-xs"
                        onClick={() => setActiveTab("parameters")}
                      >
                        Edit Settings
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {mappingProgress > 0 && mappingProgress < 100 && (
                <div className="mt-6">
                  <Card className="border-primary-100">
                    <CardHeader className="py-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <FiCpu className="text-primary-500 h-5 w-5" />
                        Analysis Progress
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-3">
                      <div className="space-y-3">
                        <p className="text-sm">
                          Your analysis is currently running. This may take
                          10-30 minutes depending on your data size.
                        </p>

                        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                          <div className="bg-background-50 rounded-md p-2 text-center">
                            <p className="text-muted-foreground mb-1 text-xs">
                              Read Preprocessing
                            </p>
                            <Badge
                              variant="outline"
                              className="bg-green-100 text-green-700 hover:bg-green-100"
                            >
                              Completed
                            </Badge>
                          </div>
                          <div className="bg-background-50 rounded-md p-2 text-center">
                            <p className="text-muted-foreground mb-1 text-xs">
                              K-mer Matching
                            </p>
                            <Badge
                              variant="outline"
                              className="bg-primary-100 text-primary-700 hover:bg-primary-100"
                            >
                              In Progress
                            </Badge>
                          </div>
                          <div className="bg-background-50 rounded-md p-2 text-center">
                            <p className="text-muted-foreground mb-1 text-xs">
                              Alignment
                            </p>
                            <Badge
                              variant="outline"
                              className="bg-background-200 text-muted-foreground hover:bg-background-200"
                            >
                              Pending
                            </Badge>
                          </div>
                          <div className="bg-background-50 rounded-md p-2 text-center">
                            <p className="text-muted-foreground mb-1 text-xs">
                              Report Generation
                            </p>
                            <Badge
                              variant="outline"
                              className="bg-background-200 text-muted-foreground hover:bg-background-200"
                            >
                              Pending
                            </Badge>
                          </div>
                        </div>

                        <div className="flex justify-between text-sm">
                          <span>Overall Progress:</span>
                          <span>{mappingProgress}%</span>
                        </div>
                        <Progress value={mappingProgress} className="h-2" />

                        <div className="text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setMappingProgress(100)}
                          >
                            Skip to Results
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="flex items-center justify-between border-t p-6">
            <div className="text-muted-foreground flex items-center text-sm">
              <FiInfo className="mr-2 h-4 w-4" />
              <span>
                Need help? Check the{" "}
                <a href="#" className="text-primary-500 hover:underline">
                  documentation
                </a>{" "}
                or{" "}
                <a href="#" className="text-primary-500 hover:underline">
                  contact support
                </a>
              </span>
            </div>

            <div className="flex gap-2">
              <Button variant="outline">Reset</Button>
              <Button
                disabled={
                  selectedFiles.length === 0 ||
                  (activeTab === "results" && mappingProgress === 0)
                }
              >
                {activeTab === "results" ? "Run Analysis" : "Submit"}
              </Button>
            </div>
          </div>
        </Card>
      </main>

      <footer className="container mx-auto py-8">
        <div className="text-muted-foreground flex flex-col items-center justify-between gap-4 text-sm md:flex-row">
          <div>© 2025 Metagenomic Read Mapping Service</div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-primary">
              Terms of Service
            </a>
            <a href="#" className="hover:text-primary">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-primary">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default MetagenomicReadMappingService;
