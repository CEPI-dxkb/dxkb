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
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FiInfo,
  FiUpload,
  FiFile,
  FiDatabase,
  FiSettings,
  FiFolder,
  FiList,
  FiHelpCircle,
  FiSearch,
  FiBarChart2,
  FiPlay,
  FiLayers,
  FiBox,
  FiServer,
  FiCpu,
  FiMaximize2,
  FiMinimize2,
  FiTarget,
  FiCheckCircle,
} from "react-icons/fi";
import { BsLinkedin, BsTwitter, BsGithub } from "react-icons/bs";

interface File {
  id: number;
  name: string;
  type: string;
}

const MetagenomicBinningService = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedInputType, setSelectedInputType] = useState("reads");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [estimatedRuntime, setEstimatedRuntime] = useState("2-4 hours");

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

  // Function to update estimated runtime based on parameter changes
  const updateEstimatedRuntime = (newParams: { inputType: string }) => {
    // This would be a more complex calculation in reality
    setEstimatedRuntime(
      newParams.inputType === "reads" ? "3-6 hours" : "1-2 hours",
    );
  };

  return (
    <div className="from-background-50 to-background-100 min-h-screen bg-gradient-to-b">
      <header className="container mx-auto py-6">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div>
            <h1 className="text-primary-700 flex items-center gap-2 text-3xl font-bold">
              <FiBox className="h-7 w-7" />
              Metagenomic Binning
            </h1>
            <p className="text-muted-foreground mt-1">
              Reconstruct bacterial and archaeal genomes from metagenomic data
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
              The Metagenomic Binning Service accepts either reads or contigs,
              and attempts to "bin" the data into a set of genomes. For further
              explanation, please see the
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
            <TabsList className="bg-background-100 grid h-12 w-full grid-cols-4 rounded-none">
              <TabsTrigger
                value="overview"
                className="flex items-center gap-2 rounded-none data-[state=active]:bg-white data-[state=active]:shadow-none"
              >
                <FiList className="h-4 w-4" />
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
                Parameters
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
                        What is Metagenomic Binning?
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-start gap-4">
                        <div className="bg-primary-100 rounded-full p-3">
                          <FiBox className="text-primary-700 h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="mb-1 font-medium">
                            Genomic Reconstruction
                          </h3>
                          <p className="text-muted-foreground text-sm">
                            Metagenomic binning groups DNA sequences (contigs)
                            that likely belong to the same organism, allowing
                            researchers to reconstruct nearly complete genomes
                            from complex microbial communities.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-4">
                        <div className="bg-primary-100 rounded-full p-3">
                          <FiTarget className="text-primary-700 h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="mb-1 font-medium">
                            Environmental Samples
                          </h3>
                          <p className="text-muted-foreground text-sm">
                            This service is ideal for analyzing complex
                            environmental samples like soil, water, or
                            microbiome samples where traditional isolation
                            techniques are challenging.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-4">
                        <div className="bg-primary-100 rounded-full p-3">
                          <FiServer className="text-primary-700 h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="mb-1 font-medium">
                            Flexible Input Options
                          </h3>
                          <p className="text-muted-foreground text-sm">
                            You can start with either raw sequence reads (FASTQ)
                            or pre-assembled contigs (FASTA) depending on your
                            analysis needs and available data.
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
                          <h3 className="font-medium">Choose Input Type</h3>
                          <p className="text-muted-foreground text-sm">
                            Select whether to start with raw reads or assembled
                            contigs
                          </p>
                        </div>

                        <div className="border-primary-200 relative border-l pb-8 pl-8">
                          <div className="bg-primary-100 absolute top-0 -left-3 rounded-full p-1.5">
                            <span className="bg-primary-500 flex h-4 w-4 items-center justify-center rounded-full text-xs font-bold text-white">
                              2
                            </span>
                          </div>
                          <h3 className="font-medium">Upload Your Data</h3>
                          <p className="text-muted-foreground text-sm">
                            Upload FASTQ files or assembled contigs
                          </p>
                        </div>

                        <div className="border-primary-200 relative border-l pb-8 pl-8">
                          <div className="bg-primary-100 absolute top-0 -left-3 rounded-full p-1.5">
                            <span className="bg-primary-500 flex h-4 w-4 items-center justify-center rounded-full text-xs font-bold text-white">
                              3
                            </span>
                          </div>
                          <h3 className="font-medium">Set Parameters</h3>
                          <p className="text-muted-foreground text-sm">
                            Customize analysis settings or use defaults
                          </p>
                        </div>

                        <div className="relative pl-8">
                          <div className="bg-primary-100 absolute top-0 -left-3 rounded-full p-1.5">
                            <span className="bg-primary-500 flex h-4 w-4 items-center justify-center rounded-full text-xs font-bold text-white">
                              4
                            </span>
                          </div>
                          <h3 className="font-medium">Review Results</h3>
                          <p className="text-muted-foreground text-sm">
                            Analyze and download your binned genomes
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
                    <CardTitle className="text-lg">Sample Workflows</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <Card className="bg-background-50">
                        <CardHeader className="p-4">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <Badge className="bg-secondary-500">Beginner</Badge>
                            Soil Microbiome
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                          <p className="text-muted-foreground mb-3 text-sm">
                            Standard workflow for soil samples with moderate
                            diversity
                          </p>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Input:
                              </span>
                              <span>Paired-end reads</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Assembly:
                              </span>
                              <span>MetaSPAdes</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Target:
                              </span>
                              <span>Bacteria/Archaea</span>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3 w-full"
                            onClick={() => {
                              setActiveTab("input");
                              // Pre-set parameters for this workflow
                            }}
                          >
                            Use Workflow
                          </Button>
                        </CardContent>
                      </Card>

                      <Card className="bg-background-50">
                        <CardHeader className="p-4">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <Badge className="bg-secondary-500">
                              Intermediate
                            </Badge>
                            Marine Samples
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                          <p className="text-muted-foreground mb-3 text-sm">
                            Optimized for marine environments with higher salt
                            content
                          </p>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Input:
                              </span>
                              <span>Paired-end reads</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Assembly:
                              </span>
                              <span>MEGAHIT</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Target:
                              </span>
                              <span>Both</span>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3 w-full"
                            onClick={() => {
                              setActiveTab("input");
                              // Pre-set parameters for this workflow
                            }}
                          >
                            Use Workflow
                          </Button>
                        </CardContent>
                      </Card>

                      <Card className="bg-background-50">
                        <CardHeader className="p-4">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <Badge className="bg-secondary-500">Advanced</Badge>
                            Custom Assembly
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                          <p className="text-muted-foreground mb-3 text-sm">
                            Start with pre-assembled contigs for custom analysis
                          </p>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Input:
                              </span>
                              <span>Assembled contigs</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Assembly:
                              </span>
                              <span>User provided</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Target:
                              </span>
                              <span>User selected</span>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3 w-full"
                            onClick={() => {
                              setActiveTab("input");
                              setSelectedInputType("contigs");
                            }}
                          >
                            Use Workflow
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
                      <FiServer className="text-primary-500 h-5 w-5" />
                      Input Type
                    </CardTitle>
                    <CardDescription>
                      Select your starting data type
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div
                        className={`hover:bg-background-100 relative cursor-pointer rounded-lg border-2 p-4 transition-all ${selectedInputType === "reads" ? "border-primary-500 bg-primary-50" : "border-border"}`}
                        onClick={() => setSelectedInputType("reads")}
                      >
                        {selectedInputType === "reads" && (
                          <div className="text-primary-500 absolute top-2 right-2">
                            <FiCheckCircle className="h-5 w-5" />
                          </div>
                        )}
                        <div className="mb-2 flex items-center gap-3">
                          <div className="bg-secondary-100 rounded-full p-2">
                            <FiFile className="text-secondary-700 h-6 w-6" />
                          </div>
                          <h3 className="font-medium">Read Files</h3>
                        </div>
                        <p className="text-muted-foreground text-sm">
                          Start with raw sequencing reads (FASTQ format)
                        </p>
                        <div className="text-muted-foreground mt-3 text-xs">
                          <span className="bg-background-200 rounded px-2 py-0.5">
                            Recommended
                          </span>
                        </div>
                      </div>

                      <div
                        className={`hover:bg-background-100 relative cursor-pointer rounded-lg border-2 p-4 transition-all ${selectedInputType === "contigs" ? "border-primary-500 bg-primary-50" : "border-border"}`}
                        onClick={() => setSelectedInputType("contigs")}
                      >
                        {selectedInputType === "contigs" && (
                          <div className="text-primary-500 absolute top-2 right-2">
                            <FiCheckCircle className="h-5 w-5" />
                          </div>
                        )}
                        <div className="mb-2 flex items-center gap-3">
                          <div className="bg-secondary-100 rounded-full p-2">
                            <FiLayers className="text-secondary-700 h-6 w-6" />
                          </div>
                          <h3 className="font-medium">Assembled Contigs</h3>
                        </div>
                        <p className="text-muted-foreground text-sm">
                          Start with pre-assembled contigs (FASTA format)
                        </p>
                        <div className="text-muted-foreground mt-3 text-xs">
                          <span className="bg-background-200 rounded px-2 py-0.5">
                            Advanced
                          </span>
                        </div>
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
                      Files selected for binning analysis
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {selectedFiles.length > 0 ? (
                      <ScrollArea className="h-[200px] pr-4">
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
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <div className="bg-background-200 mb-3 rounded-full p-3">
                          <FiList className="text-muted-foreground h-6 w-6" />
                        </div>
                        <h3 className="text-sm font-medium">
                          No files selected
                        </h3>
                        <p className="text-muted-foreground mt-1 max-w-md text-xs">
                          Upload your files using the form below
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {selectedInputType === "reads" ? (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">
                        Paired Read Library
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <Label htmlFor="read1" className="text-xs">
                            Forward Reads (R1)
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
                            Reverse Reads (R2)
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

                      <Button
                        variant="outline"
                        className="flex w-full items-center justify-center gap-2"
                        onClick={() =>
                          handleFileSelection({
                            type: "paired",
                            name: "Paired reads",
                            id: Date.now(),
                          })
                        }
                      >
                        <FiUpload className="h-4 w-4" />
                        Add Paired Reads
                      </Button>
                    </CardContent>
                  </Card>

                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">
                          Single Read Library
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
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

                        <Button
                          variant="outline"
                          className="flex w-full items-center justify-center gap-2"
                          onClick={() =>
                            handleFileSelection({
                              type: "single",
                              name: "Single read",
                              id: Date.now(),
                            })
                          }
                        >
                          <FiUpload className="h-4 w-4" />
                          Add Single Reads
                        </Button>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">
                          SRA Run Accession
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
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

                        <Button
                          variant="outline"
                          className="flex w-full items-center justify-center gap-2"
                          onClick={() =>
                            handleFileSelection({
                              type: "sra",
                              name: "SRA accession",
                              id: Date.now(),
                            })
                          }
                        >
                          <FiUpload className="h-4 w-4" />
                          Add SRA Data
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Assembled Contigs
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="contigs-file" className="text-xs">
                        Contigs File (FASTA)
                      </Label>
                      <div className="mt-1 flex">
                        <Input
                          id="contigs-file"
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
                              <p>Select assembled contigs file (FASTA)</p>
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
                          type: "contigs",
                          name: "Assembled contigs",
                          id: Date.now(),
                        })
                      }
                    >
                      <FiUpload className="h-4 w-4" />
                      Add Contigs File
                    </Button>

                    <div className="flex items-center pt-2 text-sm">
                      <FiInfo className="text-muted-foreground mr-2 h-4 w-4" />
                      <span className="text-muted-foreground">
                        Optional: Upload read files used for assembly for more
                        accurate coverage estimation
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="mt-6 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setActiveTab("overview")}
                >
                  Back
                </Button>
                <Button
                  onClick={() => setActiveTab("parameters")}
                  disabled={selectedFiles.length === 0}
                >
                  Continue to Parameters
                </Button>
              </div>
            </TabsContent>

            {/* Parameters Tab */}
            <TabsContent value="parameters" className="p-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Main Parameters */}
                <div className="space-y-6 lg:col-span-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <FiSettings className="text-primary-500 h-5 w-5" />
                        Analysis Parameters
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        {selectedInputType === "reads" && (
                          <div>
                            <Label className="text-sm font-medium">
                              Assembly Strategy
                            </Label>
                            <RadioGroup
                              defaultValue="metaspades"
                              className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3"
                            >
                              <div className="border-border hover:bg-background-100 flex cursor-pointer flex-col items-center rounded-md border p-3">
                                <RadioGroupItem
                                  value="metaspades"
                                  id="metaspades"
                                  className="sr-only"
                                />
                                <Label
                                  htmlFor="metaspades"
                                  className="flex cursor-pointer flex-col items-center gap-2"
                                >
                                  <div className="bg-primary-100 rounded-full p-2">
                                    <FiLayers className="text-primary-700 h-5 w-5" />
                                  </div>
                                  <span className="font-medium">
                                    MetaSPAdes
                                  </span>
                                  <span className="text-muted-foreground text-center text-xs">
                                    Best for complex metagenomes
                                  </span>
                                </Label>
                              </div>

                              <div className="border-border hover:bg-background-100 flex cursor-pointer flex-col items-center rounded-md border p-3">
                                <RadioGroupItem
                                  value="megahit"
                                  id="megahit"
                                  className="sr-only"
                                />
                                <Label
                                  htmlFor="megahit"
                                  className="flex cursor-pointer flex-col items-center gap-2"
                                >
                                  <div className="bg-primary-100 rounded-full p-2">
                                    <FiMaximize2 className="text-primary-700 h-5 w-5" />
                                  </div>
                                  <span className="font-medium">MEGAHIT</span>
                                  <span className="text-muted-foreground text-center text-xs">
                                    Memory efficient option
                                  </span>
                                </Label>
                              </div>

                              <div className="border-border hover:bg-background-100 flex cursor-pointer flex-col items-center rounded-md border p-3">
                                <RadioGroupItem
                                  value="auto"
                                  id="auto"
                                  className="sr-only"
                                />
                                <Label
                                  htmlFor="auto"
                                  className="flex cursor-pointer flex-col items-center gap-2"
                                >
                                  <div className="bg-primary-100 rounded-full p-2">
                                    <FiCpu className="text-primary-700 h-5 w-5" />
                                  </div>
                                  <span className="font-medium">Auto</span>
                                  <span className="text-muted-foreground text-center text-xs">
                                    Automatically select best option
                                  </span>
                                </Label>
                              </div>
                            </RadioGroup>
                          </div>
                        )}

                        <div>
                          <Label className="text-sm font-medium">
                            Organisms of Interest
                          </Label>
                          <RadioGroup
                            defaultValue="bacteria_archaea"
                            className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3"
                          >
                            <div className="border-border hover:bg-background-100 flex cursor-pointer flex-col items-center rounded-md border p-3">
                              <RadioGroupItem
                                value="bacteria_archaea"
                                id="bacteria_archaea"
                                className="sr-only"
                              />
                              <Label
                                htmlFor="bacteria_archaea"
                                className="flex cursor-pointer flex-col items-center gap-2"
                              >
                                <div className="bg-secondary-100 rounded-full p-2">
                                  <FiDatabase className="text-secondary-700 h-5 w-5" />
                                </div>
                                <span className="font-medium">
                                  Bacteria/Archaea
                                </span>
                                <span className="text-muted-foreground text-center text-xs">
                                  Focus on prokaryotic genomes
                                </span>
                              </Label>
                            </div>

                            <div className="border-border hover:bg-background-100 flex cursor-pointer flex-col items-center rounded-md border p-3">
                              <RadioGroupItem
                                value="viruses"
                                id="viruses"
                                className="sr-only"
                              />
                              <Label
                                htmlFor="viruses"
                                className="flex cursor-pointer flex-col items-center gap-2"
                              >
                                <div className="bg-secondary-100 rounded-full p-2">
                                  <FiMinimize2 className="text-secondary-700 h-5 w-5" />
                                </div>
                                <span className="font-medium">Viruses</span>
                                <span className="text-muted-foreground text-center text-xs">
                                  Focus on viral genomes
                                </span>
                              </Label>
                            </div>

                            <div className="border-border hover:bg-background-100 flex cursor-pointer flex-col items-center rounded-md border p-3">
                              <RadioGroupItem
                                value="both"
                                id="both"
                                className="sr-only"
                              />
                              <Label
                                htmlFor="both"
                                className="flex cursor-pointer flex-col items-center gap-2"
                              >
                                <div className="bg-secondary-100 rounded-full p-2">
                                  <FiLayers className="text-secondary-700 h-5 w-5" />
                                </div>
                                <span className="font-medium">Both</span>
                                <span className="text-muted-foreground text-center text-xs">
                                  Analyze all organism types
                                </span>
                              </Label>
                            </div>
                          </RadioGroup>
                        </div>

                        <Accordion
                          type="single"
                          collapsible
                          className="w-full"
                          defaultValue="advanced"
                        >
                          <AccordionItem
                            value="advanced"
                            className="border-b-0"
                          >
                            <AccordionTrigger className="py-2 hover:no-underline">
                              <div className="flex items-center gap-2 text-sm font-medium">
                                <FiSettings className="text-primary-500 h-4 w-4" />
                                <span>Advanced Settings</span>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="pt-4 pb-2">
                              <div className="space-y-4">
                                <div className="flex items-center space-x-2">
                                  <Checkbox id="disable_search" />
                                  <Label
                                    htmlFor="disable_search"
                                    className="text-sm"
                                  >
                                    Disable search for dangling contigs
                                    (decreases memory use)
                                  </Label>
                                </div>

                                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                  <div>
                                    <Label
                                      htmlFor="min_contig_length"
                                      className="text-sm"
                                    >
                                      Minimum Contig Length
                                    </Label>
                                    <div className="mt-1 flex items-center gap-2">
                                      <Input
                                        id="min_contig_length"
                                        type="number"
                                        defaultValue="300"
                                        className="h-9"
                                      />
                                      <span className="text-muted-foreground text-sm">
                                        bp
                                      </span>
                                    </div>
                                    <p className="text-muted-foreground mt-1 text-xs">
                                      Recommended: 300-500 bp
                                    </p>
                                  </div>

                                  <div>
                                    <Label
                                      htmlFor="min_contig_coverage"
                                      className="text-sm"
                                    >
                                      Minimum Contig Coverage
                                    </Label>
                                    <div className="mt-1 flex items-center gap-2">
                                      <Input
                                        id="min_contig_coverage"
                                        type="number"
                                        defaultValue="5"
                                        className="h-9"
                                      />
                                      <span className="text-muted-foreground text-sm">
                                        ×
                                      </span>
                                    </div>
                                    <p className="text-muted-foreground mt-1 text-xs">
                                      Recommended: 2-5× for diverse samples
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Output Settings & Run */}
                <div className="space-y-6">
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

                      <div>
                        <Label htmlFor="genome-group">Genome Group Name</Label>
                        <Input
                          id="genome-group"
                          placeholder="My Genome Group"
                          className="mt-1"
                        />
                      </div>

                      <div className="flex items-center space-x-2 pt-2">
                        <Switch id="compress-results" defaultChecked />
                        <Label htmlFor="compress-results" className="text-sm">
                          Compress results
                        </Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Switch id="notify-email" />
                        <Label htmlFor="notify-email" className="text-sm">
                          Email when complete
                        </Label>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">
                        Run Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            Estimated Runtime:
                          </span>
                          <span className="font-medium">
                            {estimatedRuntime}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            Memory Usage:
                          </span>
                          <span className="font-medium">8-16 GB</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            Storage Required:
                          </span>
                          <span className="font-medium">~10 GB</span>
                        </div>
                      </div>

                      <Button className="w-full gap-2">
                        <FiPlay className="h-4 w-4" />
                        Start Analysis
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setActiveTab("input")}>
                  Back
                </Button>
                <Button onClick={() => setActiveTab("results")}>
                  Preview Results
                </Button>
              </div>
            </TabsContent>

            {/* Results Tab */}
            <TabsContent value="results" className="p-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        Analysis Results
                      </CardTitle>
                      <CardDescription>
                        Preview of expected output format
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <div className="bg-background-200 mb-4 rounded-full p-4">
                          <FiBarChart2 className="text-muted-foreground h-8 w-8" />
                        </div>
                        <h3 className="text-base font-medium">
                          Analysis not started
                        </h3>
                        <p className="text-muted-foreground mt-1 max-w-md text-sm">
                          Configure your parameters and start the analysis to
                          see the results here
                        </p>
                        <div className="mt-6 grid w-full max-w-md grid-cols-2 gap-4">
                          <Button variant="outline">View Sample Results</Button>
                          <Button>Start Analysis</Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div>
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
                          <FiFolder className="text-primary-500 mt-0.5 h-4 w-4" />
                          <div>
                            <p className="font-medium">Bin Directories</p>
                            <p className="text-muted-foreground text-xs">
                              Separate folder for each genome bin
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start space-x-2">
                          <FiFile className="text-primary-500 mt-0.5 h-4 w-4" />
                          <div>
                            <p className="font-medium">Genome Statistics</p>
                            <p className="text-muted-foreground text-xs">
                              Completeness, contamination, and coverage metrics
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start space-x-2">
                          <FiFile className="text-primary-500 mt-0.5 h-4 w-4" />
                          <div>
                            <p className="font-medium">
                              Taxonomic Classification
                            </p>
                            <p className="text-muted-foreground text-xs">
                              Predicted taxonomy for each genome bin
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start space-x-2">
                          <FiFile className="text-primary-500 mt-0.5 h-4 w-4" />
                          <div>
                            <p className="font-medium">Assembly Report</p>
                            <p className="text-muted-foreground text-xs">
                              Assembly quality and statistics
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-6">
                        <Label className="text-sm">Output Format</Label>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox id="format-fasta" defaultChecked />
                            <Label htmlFor="format-fasta" className="text-sm">
                              FASTA
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox id="format-genbank" />
                            <Label htmlFor="format-genbank" className="text-sm">
                              GenBank
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
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <div className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Visualization Preview
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                      <div className="flex flex-col items-center rounded-md border p-4">
                        <div className="bg-primary-100 mb-2 rounded-full p-2">
                          <FiBarChart2 className="text-primary-700 h-5 w-5" />
                        </div>
                        <h3 className="mb-1 text-sm font-medium">
                          Bin Quality Distribution
                        </h3>
                        <div className="bg-background-100 flex h-32 w-full items-center justify-center rounded-md">
                          <span className="text-muted-foreground text-xs">
                            Histogram preview
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-center rounded-md border p-4">
                        <div className="bg-secondary-100 mb-2 rounded-full p-2">
                          <FiTarget className="text-secondary-700 h-5 w-5" />
                        </div>
                        <h3 className="mb-1 text-sm font-medium">
                          Taxonomic Distribution
                        </h3>
                        <div className="bg-background-100 flex h-32 w-full items-center justify-center rounded-md">
                          <span className="text-muted-foreground text-xs">
                            Pie chart preview
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-center rounded-md border p-4">
                        <div className="bg-accent-100 mb-2 rounded-full p-2">
                          <FiLayers className="text-accent-700 h-5 w-5" />
                        </div>
                        <h3 className="mb-1 text-sm font-medium">
                          Genome Coverage
                        </h3>
                        <div className="bg-background-100 flex h-32 w-full items-center justify-center rounded-md">
                          <span className="text-muted-foreground text-xs">
                            Line chart preview
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setActiveTab("parameters")}
                >
                  Back to Parameters
                </Button>
                <Button>Submit Analysis</Button>
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
          <div>© 2025 Metagenomic Binning Service</div>
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

export default MetagenomicBinningService;
