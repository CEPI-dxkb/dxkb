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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  FiLayers,
} from "react-icons/fi";
import { BsLinkedin, BsTwitter, BsGithub } from "react-icons/bs";

interface File {
  id: number;
  name: string;
  type: string;
}

const TaxonomicClassificationService = () => {
  const [activeTab, setActiveTab] = useState("input");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

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
              <FiLayers className="h-7 w-7" />
              Taxonomic Classification
            </h1>
            <p className="text-muted-foreground mt-1">
              Compute taxonomic classification for read data
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
        <Card className="border shadow-lg">
          <CardHeader className="pb-0">
            <CardDescription>
              The Taxonomic Classification Service computes taxonomic
              classification for read data. For further explanation, please see
              the
              <a href="#" className="text-primary-500 ml-1 hover:underline">
                Quick Reference Guide
              </a>
              ,
              <a href="#" className="text-primary-500 ml-1 hover:underline">
                Tutorial
              </a>{" "}
              and
              <a href="#" className="text-primary-500 ml-1 hover:underline">
                Instructional Video
              </a>
              .
            </CardDescription>
          </CardHeader>

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <div className="px-6">
              <TabsList className="h-12 w-full justify-start rounded-none border-b bg-transparent p-0">
                <TabsTrigger
                  value="input"
                  className="data-[state=active]:border-primary flex items-center gap-2 rounded-none bg-transparent px-4 py-2 data-[state=active]:border-b-2 data-[state=active]:shadow-none"
                >
                  <FiUpload className="h-4 w-4" />
                  Input Files
                </TabsTrigger>
                <TabsTrigger
                  value="libraries"
                  className="data-[state=active]:border-primary flex items-center gap-2 rounded-none bg-transparent px-4 py-2 data-[state=active]:border-b-2 data-[state=active]:shadow-none"
                >
                  <FiList className="h-4 w-4" />
                  Selected Libraries
                </TabsTrigger>
                <TabsTrigger
                  value="parameters"
                  className="data-[state=active]:border-primary flex items-center gap-2 rounded-none bg-transparent px-4 py-2 data-[state=active]:border-b-2 data-[state=active]:shadow-none"
                >
                  <FiSettings className="h-4 w-4" />
                  Parameters
                </TabsTrigger>
                <TabsTrigger
                  value="output"
                  className="data-[state=active]:border-primary flex items-center gap-2 rounded-none bg-transparent px-4 py-2 data-[state=active]:border-b-2 data-[state=active]:shadow-none"
                >
                  <FiDownload className="h-4 w-4" />
                  Output
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="input" className="p-6 pt-4">
              <h2 className="mb-4 text-lg font-medium">
                Upload Sequence Files
              </h2>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="space-y-6">
                  {/* Paired Read Section */}
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-base">
                        Paired Read Library
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-4">
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          <div>
                            <Label htmlFor="read1" className="text-xs">
                              Read File 1
                            </Label>
                            <div className="mt-1 flex">
                              <Input
                                id="read1"
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
                            <Label htmlFor="read2" className="text-xs">
                              Read File 2
                            </Label>
                            <div className="mt-1 flex">
                              <Input
                                id="read2"
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
                        </div>

                        <div>
                          <Label htmlFor="paired-id" className="text-xs">
                            Sample Identifier
                          </Label>
                          <Input
                            id="paired-id"
                            placeholder="Sample ID"
                            className="mt-1"
                          />
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
                          Add to Library
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Single Read Section */}
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-base">
                        Single Read Library
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-4">
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="single-read" className="text-xs">
                            Read File
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

                        <div>
                          <Label htmlFor="single-id" className="text-xs">
                            Sample Identifier
                          </Label>
                          <Input
                            id="single-id"
                            placeholder="Sample ID"
                            className="mt-1"
                          />
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
                          Add to Library
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* SRA Section */}
                <div className="space-y-6">
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-base">
                        SRA Run Accession
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-4">
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="sra-id" className="text-xs">
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
                        </div>

                        <div>
                          <Label htmlFor="sra-sample-id" className="text-xs">
                            Sample Identifier
                          </Label>
                          <Input
                            id="sra-sample-id"
                            placeholder="Sample ID"
                            className="mt-1"
                          />
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
                          Add to Library
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* File Upload Zone */}
                  <Card className="bg-background-50/50 border-2 border-dashed">
                    <CardContent className="p-6">
                      <div className="flex flex-col items-center justify-center space-y-2 text-center">
                        <div className="bg-primary-100 rounded-full p-3">
                          <FiUpload className="text-primary-600 h-6 w-6" />
                        </div>
                        <h3 className="font-medium">Drag and drop files</h3>
                        <p className="text-muted-foreground text-sm">
                          Drop your FASTQ or FASTA files here or browse your
                          computer
                        </p>
                        <Button variant="outline" size="sm" className="mt-2">
                          Browse Files
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Quick Access */}
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-base">Recent Files</CardTitle>
                    </CardHeader>
                    <CardContent className="pb-4">
                      <ScrollArea className="h-28">
                        <div className="space-y-2">
                          {[
                            "sample_bacteria.fastq",
                            "metagenome_soil.fq",
                            "gut_microbiome.fq",
                          ].map((file, index) => (
                            <div
                              key={index}
                              className="hover:bg-background-200 flex items-center justify-between rounded-md p-2"
                            >
                              <div className="flex items-center">
                                <FiFile className="text-primary-500 mr-2 h-4 w-4" />
                                <span className="text-sm">{file}</span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                              >
                                <FiChevronRight className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="libraries" className="p-6 pt-4">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card className="h-min">
                  <CardHeader className="py-3">
                    <CardTitle className="text-base">
                      Selected Libraries
                    </CardTitle>
                    <CardDescription>
                      Files selected for analysis
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {selectedFiles.length > 0 ? (
                      <div className="space-y-2">
                        {selectedFiles.map((file, index) => (
                          <div
                            key={file.id}
                            className="bg-background-100 hover:bg-background-200 flex items-center justify-between rounded-md p-2"
                          >
                            <div className="flex items-center">
                              <div className="bg-primary-100 mr-2 rounded-full p-1">
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
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <div className="bg-background-200 mb-3 rounded-full p-3">
                          <FiList className="text-muted-foreground h-6 w-6" />
                        </div>
                        <h3 className="text-sm font-medium">
                          No libraries selected
                        </h3>
                        <p className="text-muted-foreground mt-1 max-w-md text-xs">
                          Add files from the Input Files tab to begin your
                          analysis
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-4"
                          onClick={() => setActiveTab("input")}
                        >
                          Add Files
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="h-min">
                  <CardHeader className="py-3">
                    <CardTitle className="text-base">Data Preview</CardTitle>
                    <CardDescription>
                      Sample information and quality metrics
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pb-4">
                    {selectedFiles.length > 0 ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <p className="text-sm font-medium">
                              Sample Quality
                            </p>
                            <div className="flex items-center space-x-2">
                              <div className="bg-background-200 h-2 w-32 overflow-hidden rounded-full">
                                <div className="bg-primary-500 h-full w-4/5 rounded-full" />
                              </div>
                              <span className="text-muted-foreground text-xs">
                                Good
                              </span>
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className="bg-primary-50 text-primary-700"
                          >
                            {selectedFiles.length} files
                          </Badge>
                        </div>

                        <div className="space-y-2">
                          <p className="text-sm font-medium">
                            File Information
                          </p>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Type:
                              </span>
                              <span className="font-medium">Paired-end</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Format:
                              </span>
                              <span className="font-medium">FASTQ</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Read Length:
                              </span>
                              <span className="font-medium">150 bp</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Quality Score:
                              </span>
                              <span className="font-medium">Q30+</span>
                            </div>
                          </div>
                        </div>

                        <div className="pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                          >
                            View Detailed Statistics
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <p className="text-muted-foreground text-sm">
                          No preview available
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="parameters" className="p-6 pt-4">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Analysis Parameters */}
                <Card className="lg:col-span-2">
                  <CardHeader className="py-3">
                    <CardTitle className="text-base">
                      Analysis Parameters
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Accordion
                      type="single"
                      collapsible
                      className="w-full"
                      defaultValue="sequencing"
                    >
                      <AccordionItem value="sequencing" className="border-b">
                        <AccordionTrigger className="py-3 hover:no-underline">
                          <div className="flex items-center gap-2">
                            <FiBarChart2 className="text-primary-500 h-4 w-4" />
                            <span>Sequencing Type</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-2 pb-4">
                          <RadioGroup defaultValue="wgs" className="space-y-3">
                            <div className="flex items-start space-x-2">
                              <RadioGroupItem
                                value="wgs"
                                id="wgs"
                                className="mt-1"
                              />
                              <div>
                                <Label htmlFor="wgs" className="font-medium">
                                  Whole Genome Sequencing (WGS)
                                </Label>
                                <p className="text-muted-foreground text-xs">
                                  Analyze complete genomic DNA sequence
                                </p>
                              </div>
                            </div>
                            <div className="flex items-start space-x-2">
                              <RadioGroupItem
                                value="16s"
                                id="16s"
                                className="mt-1"
                              />
                              <div>
                                <Label htmlFor="16s" className="font-medium">
                                  16S Ribosomal RNA
                                </Label>
                                <p className="text-muted-foreground text-xs">
                                  Taxonomic analysis based on 16S rRNA gene
                                </p>
                              </div>
                            </div>
                          </RadioGroup>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="analysis" className="border-b">
                        <AccordionTrigger className="py-3 hover:no-underline">
                          <div className="flex items-center gap-2">
                            <FiSearch className="text-primary-500 h-4 w-4" />
                            <span>Analysis Type</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-2 pb-4">
                          <div className="space-y-3">
                            <Select defaultValue="microbiome">
                              <SelectTrigger>
                                <SelectValue placeholder="Select analysis type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="microbiome">
                                  Microbiome Analysis
                                </SelectItem>
                                <SelectItem value="genomic">
                                  Genomic Analysis
                                </SelectItem>
                                <SelectItem value="metagenome">
                                  Metagenome Analysis
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="text-muted-foreground mt-1 text-xs">
                              Microbiome Analysis identifies and quantifies
                              microbial community composition
                            </p>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="database" className="border-b">
                        <AccordionTrigger className="py-3 hover:no-underline">
                          <div className="flex items-center gap-2">
                            <FiDatabase className="text-primary-500 h-4 w-4" />
                            <span>Reference Database</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-2 pb-4">
                          <div className="space-y-3">
                            <Select defaultValue="bvbrc">
                              <SelectTrigger>
                                <SelectValue placeholder="Select reference database" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="bvbrc">
                                  BV-BRC Database
                                </SelectItem>
                                <SelectItem value="silva">
                                  SILVA Database
                                </SelectItem>
                                <SelectItem value="greengenes">
                                  GreenGenes Database
                                </SelectItem>
                                <SelectItem value="ncbi">
                                  NCBI Database
                                </SelectItem>
                                <SelectItem value="custom">
                                  Custom Database
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="text-muted-foreground mt-1 text-xs">
                              BV-BRC Database offers comprehensive microbial
                              reference genomes
                            </p>
                            <div className="flex items-center space-x-2 pt-1">
                              <Switch id="latest-version" defaultChecked />
                              <Label
                                htmlFor="latest-version"
                                className="text-xs"
                              >
                                Use latest database version
                              </Label>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="filtering" className="border-b">
                        <AccordionTrigger className="py-3 hover:no-underline">
                          <div className="flex items-center gap-2">
                            <FiFilter className="text-primary-500 h-4 w-4" />
                            <span>Filtering Options</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-2 pb-4">
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="host-reads">
                                Filter Host Reads
                              </Label>
                              <Select defaultValue="none">
                                <SelectTrigger id="host-reads" className="mt-1">
                                  <SelectValue placeholder="Select filtering option" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">None</SelectItem>
                                  <SelectItem value="human">Human</SelectItem>
                                  <SelectItem value="mouse">Mouse</SelectItem>
                                  <SelectItem value="custom">
                                    Custom Genome
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div>
                              <Label htmlFor="confidence">
                                Confidence Interval
                              </Label>
                              <Select defaultValue="0.1">
                                <SelectTrigger id="confidence" className="mt-1">
                                  <SelectValue placeholder="Select confidence interval" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="0.1">0.1</SelectItem>
                                  <SelectItem value="0.05">0.05</SelectItem>
                                  <SelectItem value="0.01">0.01</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-sm">
                                  Save Classified Sequences
                                </Label>
                                <div className="flex items-center space-x-3">
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem
                                      value="class-no"
                                      id="class-no"
                                    />
                                    <Label
                                      htmlFor="class-no"
                                      className="text-sm"
                                    >
                                      No
                                    </Label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem
                                      value="class-yes"
                                      id="class-yes"
                                    />
                                    <Label
                                      htmlFor="class-yes"
                                      className="text-sm"
                                    >
                                      Yes
                                    </Label>
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <Label className="text-sm">
                                  Save Unclassified Sequences
                                </Label>
                                <div className="flex items-center space-x-3">
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem
                                      value="unclass-no"
                                      id="unclass-no"
                                    />
                                    <Label
                                      htmlFor="unclass-no"
                                      className="text-sm"
                                    >
                                      No
                                    </Label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem
                                      value="unclass-yes"
                                      id="unclass-yes"
                                    />
                                    <Label
                                      htmlFor="unclass-yes"
                                      className="text-sm"
                                    >
                                      Yes
                                    </Label>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </CardContent>
                </Card>

                {/* Output Settings */}
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-base">Output Settings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
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
                        <Label htmlFor="output-name">Output Prefix</Label>
                        <Input
                          id="output-name"
                          placeholder="Output Name"
                          className="mt-1"
                        />
                      </div>

                      <div className="space-y-3 pt-3">
                        <div className="flex items-center space-x-2">
                          <Switch id="compress-results" defaultChecked />
                          <Label htmlFor="compress-results" className="text-sm">
                            Compress results
                          </Label>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Switch id="generate-report" defaultChecked />
                          <Label htmlFor="generate-report" className="text-sm">
                            Generate HTML report
                          </Label>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Switch id="notify-email" />
                          <Label htmlFor="notify-email" className="text-sm">
                            Email notification when complete
                          </Label>
                        </div>
                      </div>

                      <div className="pt-4">
                        <Button className="w-full gap-2">
                          <FiPlay className="h-4 w-4" />
                          Run Analysis
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="lg:col-span-3">
                  <CardHeader className="py-3">
                    <CardTitle className="text-base">
                      Advanced Settings
                    </CardTitle>
                    <CardDescription>
                      Configure additional parameters for specialized analysis
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div>
                        <Label htmlFor="min-quality" className="text-sm">
                          Minimum Quality Score
                        </Label>
                        <Select defaultValue="20">
                          <SelectTrigger id="min-quality" className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10">Q10</SelectItem>
                            <SelectItem value="20">Q20</SelectItem>
                            <SelectItem value="30">Q30</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="min-length" className="text-sm">
                          Minimum Read Length
                        </Label>
                        <Input
                          id="min-length"
                          defaultValue="50"
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="threads" className="text-sm">
                          CPU Threads
                        </Label>
                        <Input
                          id="threads"
                          defaultValue="4"
                          type="number"
                          min="1"
                          max="32"
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="output" className="p-6 pt-4">
              <div className="flex flex-col gap-6">
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="flex items-center justify-between text-base">
                      <span>Output Configuration</span>
                      <Badge variant="secondary" className="ml-2">
                        Preview
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <div className="space-y-3">
                          <h3 className="text-sm font-medium">
                            Output Location
                          </h3>
                          <div className="flex items-center">
                            <Input
                              defaultValue="/home/user/taxonomy_results"
                              className="bg-background-50 rounded-r-none"
                              readOnly
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

                        <div className="space-y-3">
                          <h3 className="text-sm font-medium">Output Format</h3>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex items-center space-x-2">
                              <Checkbox id="format-tsv" defaultChecked />
                              <Label htmlFor="format-tsv" className="text-sm">
                                TSV
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox id="format-csv" defaultChecked />
                              <Label htmlFor="format-csv" className="text-sm">
                                CSV
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox id="format-json" />
                              <Label htmlFor="format-json" className="text-sm">
                                JSON
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox id="format-biom" />
                              <Label htmlFor="format-biom" className="text-sm">
                                BIOM
                              </Label>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h3 className="text-sm font-medium">
                          Visualization Options
                        </h3>
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                          <div className="flex items-center space-x-2">
                            <Checkbox id="vis-heatmap" defaultChecked />
                            <Label htmlFor="vis-heatmap" className="text-sm">
                              Taxonomy Heatmap
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox id="vis-krona" defaultChecked />
                            <Label htmlFor="vis-krona" className="text-sm">
                              Krona Chart
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox id="vis-tree" />
                            <Label htmlFor="vis-tree" className="text-sm">
                              Phylogenetic Tree
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox id="vis-bar" defaultChecked />
                            <Label htmlFor="vis-bar" className="text-sm">
                              Abundance Bar Chart
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox id="vis-pca" />
                            <Label htmlFor="vis-pca" className="text-sm">
                              PCA Plot
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox id="vis-rarefaction" />
                            <Label
                              htmlFor="vis-rarefaction"
                              className="text-sm"
                            >
                              Rarefaction Curve
                            </Label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <Card className="h-full">
                    <CardHeader className="py-3">
                      <CardTitle className="text-base">
                        Analysis Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <h3 className="mb-2 text-sm font-medium">
                            Selected Parameters
                          </h3>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Sequencing Type:
                              </span>
                              <span>Whole Genome Sequencing</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Analysis Type:
                              </span>
                              <span>Microbiome Analysis</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Database:
                              </span>
                              <span>BV-BRC Database</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Host Filtering:
                              </span>
                              <span>None</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Confidence Interval:
                              </span>
                              <span>0.1</span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h3 className="mb-2 text-sm font-medium">
                            Resources
                          </h3>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-background-100 rounded-md p-2">
                              <p className="text-muted-foreground text-xs">
                                CPU
                              </p>
                              <p className="text-sm font-medium">4 cores</p>
                            </div>
                            <div className="bg-background-100 rounded-md p-2">
                              <p className="text-muted-foreground text-xs">
                                Memory
                              </p>
                              <p className="text-sm font-medium">16 GB</p>
                            </div>
                            <div className="bg-background-100 rounded-md p-2">
                              <p className="text-muted-foreground text-xs">
                                Est. Storage
                              </p>
                              <p className="text-sm font-medium">~2.5 GB</p>
                            </div>
                            <div className="bg-background-100 rounded-md p-2">
                              <p className="text-muted-foreground text-xs">
                                Est. Runtime
                              </p>
                              <p className="text-sm font-medium">~45 min</p>
                            </div>
                          </div>
                        </div>

                        <Button className="w-full gap-2">
                          <FiPlay className="h-4 w-4" />
                          Start Analysis
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="h-full">
                    <CardHeader className="py-3">
                      <CardTitle className="text-base">
                        Output Preview
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex h-full flex-col items-center justify-center py-6 text-center">
                        <div className="bg-primary-100 mb-4 rounded-full p-4">
                          <FiBarChart2 className="text-primary-600 h-8 w-8" />
                        </div>
                        <h3 className="text-base font-medium">
                          Analysis not started
                        </h3>
                        <p className="text-muted-foreground mt-1 max-w-md text-sm">
                          Configure your parameters and start the analysis to
                          see the results here
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
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
              <Button disabled={selectedFiles.length === 0}>Submit</Button>
            </div>
          </div>
        </Card>
      </main>

      <footer className="container mx-auto py-8">
        <div className="text-muted-foreground flex flex-col items-center justify-between gap-4 text-sm md:flex-row">
          <div>© 2025 Taxonomic Classification Service</div>
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

export default TaxonomicClassificationService;
