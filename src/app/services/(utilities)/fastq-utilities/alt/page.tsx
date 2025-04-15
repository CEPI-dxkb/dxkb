"use client";

import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  FiInfo,
  FiUpload,
  FiFile,
  FiDatabase,
  FiSettings,
  FiFolder,
  FiPlay,
  FiList,
  FiHelpCircle,
  FiChevronRight,
  FiSearch,
  FiFilter,
  FiBarChart2,
  FiDownload,
  FiTarget,
  FiScissors,
  FiCheck,
  FiFileText,
  FiZap,
  FiCode,
} from "react-icons/fi";
import { BsLinkedin, BsTwitter, BsGithub } from "react-icons/bs";

interface File {
  id: number;
  name: string;
  type: string;
}

const FastqUtilitiesService = () => {
  const [activeTab, setActiveTab] = useState("home");
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedAction, setSelectedAction] = useState(null);
  const [outputProgress, setOutputProgress] = useState(0);

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

  // Available FastQ tools
  const fastqTools = [
    {
      id: "trim",
      name: "Trimming",
      icon: <FiScissors className="h-6 w-6" />,
      description: "Remove low quality bases and adapter sequences",
      badgeColor: "bg-green-100 text-green-800",
    },
    {
      id: "align",
      name: "Alignment",
      icon: <FiCheck className="h-6 w-6" />,
      description: "Map reads to a reference genome",
      badgeColor: "bg-blue-100 text-blue-800",
    },
    {
      id: "quality",
      name: "Quality Control",
      icon: <FiCheck className="h-6 w-6" />,
      description: "Analyze and visualize base quality scores",
      badgeColor: "bg-purple-100 text-purple-800",
    },
    {
      id: "convert",
      name: "Format Conversion",
      icon: <FiFileText className="h-6 w-6" />,
      description: "Convert between different sequence file formats",
      badgeColor: "bg-orange-100 text-orange-800",
    },
    {
      id: "merge",
      name: "Merge Reads",
      icon: <FiZap className="h-6 w-6" />,
      description: "Combine paired-end reads into single sequences",
      badgeColor: "bg-pink-100 text-pink-800",
    },
    {
      id: "subsample",
      name: "Subsampling",
      icon: <FiCode className="h-6 w-6" />,
      description: "Randomly sample reads from larger datasets",
      badgeColor: "bg-yellow-100 text-yellow-800",
    },
  ];

  return (
    <div className="from-background-50 to-background-100 min-h-screen bg-gradient-to-b">
      <header className="container mx-auto py-6">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div>
            <h1 className="text-primary-700 flex items-center gap-2 text-3xl font-bold">
              <FiFileText className="h-7 w-7" />
              FastQ Utilities
            </h1>
            <p className="text-muted-foreground mt-1">
              Tools for managing, analyzing, and processing FastQ sequence files
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
              The FastQ Utilities Service provides capability for aligning,
              measuring base call quality, and trimming fastq read files. For
              further explanation, please see the
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
            <div className="px-6 pt-4">
              <TabsList className="h-12 w-full justify-start rounded-none border-b bg-transparent p-0">
                <TabsTrigger
                  value="home"
                  className="data-[state=active]:border-primary flex items-center gap-2 rounded-none bg-transparent px-4 py-2 data-[state=active]:border-b-2 data-[state=active]:shadow-none"
                >
                  <FiFileText className="h-4 w-4" />
                  Home
                </TabsTrigger>
                <TabsTrigger
                  value="tools"
                  className="data-[state=active]:border-primary flex items-center gap-2 rounded-none bg-transparent px-4 py-2 data-[state=active]:border-b-2 data-[state=active]:shadow-none"
                >
                  <FiSettings className="h-4 w-4" />
                  Tools
                </TabsTrigger>
                <TabsTrigger
                  value="files"
                  className="data-[state=active]:border-primary flex items-center gap-2 rounded-none bg-transparent px-4 py-2 data-[state=active]:border-b-2 data-[state=active]:shadow-none"
                >
                  <FiUpload className="h-4 w-4" />
                  Upload Files
                </TabsTrigger>
                <TabsTrigger
                  value="pipeline"
                  className="data-[state=active]:border-primary flex items-center gap-2 rounded-none bg-transparent px-4 py-2 data-[state=active]:border-b-2 data-[state=active]:shadow-none"
                >
                  <FiPlay className="h-4 w-4" />
                  Run Pipeline
                </TabsTrigger>
                <TabsTrigger
                  value="results"
                  className="data-[state=active]:border-primary flex items-center gap-2 rounded-none bg-transparent px-4 py-2 data-[state=active]:border-b-2 data-[state=active]:shadow-none"
                >
                  <FiBarChart2 className="h-4 w-4" />
                  Results
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Home Tab Content */}
            <TabsContent value="home" className="p-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <div className="md:col-span-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        Welcome to FastQ Utilities
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-muted-foreground">
                        FastQ Utilities is a comprehensive toolkit for working
                        with Next-Generation Sequencing (NGS) data in FASTQ
                        format. Our tools help you assess, improve, and
                        transform your sequence data for downstream analysis.
                      </p>

                      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="flex items-start gap-3">
                          <div className="rounded-full bg-green-100 p-2">
                            <FiScissors className="h-5 w-5 text-green-700" />
                          </div>
                          <div>
                            <h3 className="font-medium">
                              Trimming & Filtering
                            </h3>
                            <p className="text-muted-foreground text-sm">
                              Remove adapters, low quality bases, and filter
                              reads based on quality metrics
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className="rounded-full bg-blue-100 p-2">
                            <FiCheck className="h-5 w-5 text-blue-700" />
                          </div>
                          <div>
                            <h3 className="font-medium">Alignment</h3>
                            <p className="text-muted-foreground text-sm">
                              Map reads to reference genomes with configurable
                              alignment parameters
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className="rounded-full bg-purple-100 p-2">
                            <FiBarChart2 className="h-5 w-5 text-purple-700" />
                          </div>
                          <div>
                            <h3 className="font-medium">Quality Assessment</h3>
                            <p className="text-muted-foreground text-sm">
                              Generate comprehensive reports on sequence quality
                              metrics
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className="rounded-full bg-orange-100 p-2">
                            <FiFileText className="h-5 w-5 text-orange-700" />
                          </div>
                          <div>
                            <h3 className="font-medium">Format Conversion</h3>
                            <p className="text-muted-foreground text-sm">
                              Convert between different sequence file formats
                              (FASTQ, FASTA, etc.)
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 flex justify-center">
                        <Button
                          className="gap-2"
                          onClick={() => setActiveTab("tools")}
                        >
                          <FiChevronRight className="h-4 w-4" />
                          Explore Tools
                        </Button>
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
                          <h3 className="font-medium">Select a Tool</h3>
                          <p className="text-muted-foreground text-sm">
                            Choose from our suite of FastQ utilities
                          </p>
                        </div>

                        <div className="border-primary-200 relative border-l pb-8 pl-8">
                          <div className="bg-primary-100 absolute top-0 -left-3 rounded-full p-1.5">
                            <span className="bg-primary-500 flex h-4 w-4 items-center justify-center rounded-full text-xs font-bold text-white">
                              2
                            </span>
                          </div>
                          <h3 className="font-medium">Upload Files</h3>
                          <p className="text-muted-foreground text-sm">
                            Upload your FastQ files or provide SRA accessions
                          </p>
                        </div>

                        <div className="border-primary-200 relative border-l pb-8 pl-8">
                          <div className="bg-primary-100 absolute top-0 -left-3 rounded-full p-1.5">
                            <span className="bg-primary-500 flex h-4 w-4 items-center justify-center rounded-full text-xs font-bold text-white">
                              3
                            </span>
                          </div>
                          <h3 className="font-medium">Configure Pipeline</h3>
                          <p className="text-muted-foreground text-sm">
                            Set your parameters and reference genomes
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
                            Analyze your outputs and download processed files
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 flex justify-center gap-2">
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => setActiveTab("tools")}
                        >
                          <FiSettings className="mr-2 h-4 w-4" />
                          View Tools
                        </Button>
                        <Button
                          className="w-full"
                          onClick={() => setActiveTab("files")}
                        >
                          <FiUpload className="mr-2 h-4 w-4" />
                          Upload Files
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="mt-6">
                    <CardHeader className="py-3">
                      <CardTitle className="text-base">
                        Recent Activity
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="py-0">
                      <div className="space-y-3">
                        <div className="bg-background-50 rounded-md p-2">
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-sm font-medium">
                              Quality Control
                            </span>
                            <Badge className="bg-green-100 text-green-800">
                              Completed
                            </Badge>
                          </div>
                          <p className="text-muted-foreground text-xs">
                            sample_reads.fastq (2 hours ago)
                          </p>
                        </div>
                        <div className="bg-background-50 rounded-md p-2">
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-sm font-medium">
                              Adapter Trimming
                            </span>
                            <Badge className="bg-green-100 text-green-800">
                              Completed
                            </Badge>
                          </div>
                          <p className="text-muted-foreground text-xs">
                            ecoli_R1.fastq (yesterday)
                          </p>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs"
                      >
                        View All Activity
                      </Button>
                    </CardFooter>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Tools Tab Content */}
            <TabsContent value="tools" className="p-6">
              <div className="mb-6">
                <h2 className="mb-2 text-lg font-medium">Select a Tool</h2>
                <p className="text-muted-foreground">
                  Choose a utility to process your FastQ files
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                {fastqTools.map((tool) => (
                  <Card
                    key={tool.id}
                    className={`hover:border-primary-200 cursor-pointer transition-all ${selectedTool === tool.id ? "border-primary bg-primary-50" : ""}`}
                    onClick={() => setSelectedTool(tool.id)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <Badge className={tool.badgeColor}>{tool.name}</Badge>
                        <div className="bg-background-100 rounded-full p-2">
                          {tool.icon}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground text-sm">
                        {tool.description}
                      </p>
                    </CardContent>
                    <CardFooter className="pt-0">
                      <Button
                        variant={
                          selectedTool === tool.id ? "default" : "outline"
                        }
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          setSelectedTool(tool.id);
                          setActiveTab("files");
                        }}
                      >
                        Select
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>

              {selectedTool && (
                <div className="mt-6 flex justify-end">
                  <Button onClick={() => setActiveTab("files")}>
                    Continue to Upload Files
                    <FiChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* Upload Files Tab Content */}
            <TabsContent value="files" className="p-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        Upload Sequence Files
                      </CardTitle>
                      <CardDescription>
                        Select FastQ files from your computer or provide SRA
                        accession numbers
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="border-border rounded-lg border-2 border-dashed p-6">
                        <div className="flex flex-col items-center text-center">
                          <div className="bg-background-100 mb-3 rounded-full p-3">
                            <FiUpload className="text-primary-600 h-6 w-6" />
                          </div>
                          <h3 className="mb-1 text-base font-medium">
                            Drag and drop files
                          </h3>
                          <p className="text-muted-foreground mb-3 text-sm">
                            or click to select files from your computer
                          </p>
                          <Button variant="outline" size="sm">
                            Browse Files
                          </Button>
                          <p className="text-muted-foreground mt-3 text-xs">
                            Supported formats: FASTQ, FASTQ.GZ, FASTA
                          </p>
                        </div>
                      </div>

                      <Separator>
                        <span className="text-muted-foreground px-2 text-xs">
                          OR
                        </span>
                      </Separator>

                      <div>
                        <h3 className="mb-3 text-sm font-medium">
                          Paired-End Reads
                        </h3>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <Label htmlFor="read1">Forward Reads (R1)</Label>
                            <Input id="read1" type="file" className="mt-1" />
                          </div>
                          <div>
                            <Label htmlFor="read2">Reverse Reads (R2)</Label>
                            <Input id="read2" type="file" className="mt-1" />
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          className="mt-3 w-full"
                          onClick={() =>
                            handleFileSelection({
                              id: Date.now(),
                              name: "Paired-end reads",
                              type: "paired",
                            })
                          }
                        >
                          Add Paired Reads
                        </Button>
                      </div>

                      <Separator />

                      <div>
                        <h3 className="mb-3 text-sm font-medium">
                          Single-End Reads
                        </h3>
                        <div className="space-y-3">
                          <div>
                            <Label htmlFor="platform">
                              Sequencing Platform
                            </Label>
                            <Select defaultValue="illumina">
                              <SelectTrigger id="platform" className="mt-1">
                                <SelectValue placeholder="Select platform" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="illumina">
                                  Illumina
                                </SelectItem>
                                <SelectItem value="nanopore">
                                  Oxford Nanopore
                                </SelectItem>
                                <SelectItem value="pacbio">PacBio</SelectItem>
                                <SelectItem value="ion_torrent">
                                  Ion Torrent
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="single-read">Read File</Label>
                            <Input
                              id="single-read"
                              type="file"
                              className="mt-1"
                            />
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          className="mt-3 w-full"
                          onClick={() =>
                            handleFileSelection({
                              id: Date.now(),
                              name: "Single-end reads",
                              type: "single",
                            })
                          }
                        >
                          Add Single Reads
                        </Button>
                      </div>

                      <Separator />

                      <div>
                        <h3 className="mb-3 text-sm font-medium">
                          SRA Accessions
                        </h3>
                        <div>
                          <Label htmlFor="sra-accession">
                            SRA Run Accession Number
                          </Label>
                          <div className="mt-1 flex">
                            <Input
                              id="sra-accession"
                              placeholder="e.g. SRR12345678"
                              className="rounded-r-none"
                            />
                            <Button type="submit" className="rounded-l-none">
                              <FiSearch className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="text-muted-foreground mt-1 text-xs">
                            Enter SRA run accession to fetch data directly from
                            NCBI SRA
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          className="mt-3 w-full"
                          onClick={() =>
                            handleFileSelection({
                              id: Date.now(),
                              name: "SRA accession",
                              type: "sra",
                            })
                          }
                        >
                          Add SRA Data
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Selected Files</CardTitle>
                      <CardDescription>
                        Files ready for processing
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {selectedFiles.length > 0 ? (
                        <ScrollArea className="h-[300px]">
                          <div className="space-y-2">
                            {selectedFiles.map((file, index) => (
                              <div
                                key={file.id}
                                className="bg-background-50 flex items-center justify-between rounded-md p-3"
                              >
                                <div className="flex items-center">
                                  <div className="bg-primary-100 mr-3 rounded-full p-1.5">
                                    <FiFile className="text-primary-700 h-4 w-4" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium">
                                      {file.name}
                                    </p>
                                    <p className="text-muted-foreground text-xs">
                                      {file.type === "paired"
                                        ? "Paired-end"
                                        : file.type === "single"
                                          ? "Single-end"
                                          : "SRA"}
                                    </p>
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
                                  onClick={() => removeFile(index)}
                                >
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
                                  <span className="sr-only">Remove</span>
                                </Button>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                          <div className="bg-background-100 mb-3 rounded-full p-3">
                            <FiList className="text-muted-foreground h-6 w-6" />
                          </div>
                          <h3 className="mb-1 text-base font-medium">
                            No files selected
                          </h3>
                          <p className="text-muted-foreground text-sm">
                            Upload files or provide SRA accessions to get
                            started
                          </p>
                        </div>
                      )}
                    </CardContent>
                    {selectedFiles.length > 0 && (
                      <CardFooter>
                        <Button
                          className="w-full"
                          onClick={() => setActiveTab("pipeline")}
                        >
                          Continue to Pipeline Setup
                          <FiChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                      </CardFooter>
                    )}
                  </Card>

                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="flex items-center text-base">
                        <FiInfo className="text-primary-500 mr-2 h-4 w-4" />
                        File Requirements
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="py-0">
                      <div className="space-y-2 text-sm">
                        <p className="text-muted-foreground">
                          For optimal performance:
                        </p>
                        <ul className="text-muted-foreground list-disc space-y-1 pl-5">
                          <li>Maximum file size: 10GB per file</li>
                          <li>
                            Supported formats: FASTQ, FASTA, compressed (.gz)
                          </li>
                          <li>Paired files should have matching read counts</li>
                          <li>SRA accessions must be valid and accessible</li>
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Pipeline Tab Content */}
            <TabsContent value="pipeline" className="p-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        Configure Pipeline
                      </CardTitle>
                      <CardDescription>
                        Set up your processing parameters
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div>
                        <h3 className="mb-3 text-base font-medium">
                          Selected Tool:{" "}
                          {selectedTool
                            ? fastqTools.find((t) => t.id === selectedTool)
                                ?.name
                            : "None"}
                        </h3>
                        <div className="bg-background-50 rounded-md p-3">
                          {selectedTool === "trim" && (
                            <div className="space-y-4">
                              <h4 className="text-sm font-medium">
                                Trimming Options
                              </h4>
                              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                  <Label htmlFor="quality-threshold">
                                    Quality Threshold
                                  </Label>
                                  <Input
                                    id="quality-threshold"
                                    type="number"
                                    placeholder="20"
                                    className="mt-1"
                                  />
                                  <p className="text-muted-foreground mt-1 text-xs">
                                    Min. quality score (Phred) to keep
                                  </p>
                                </div>
                                <div>
                                  <Label htmlFor="min-length">
                                    Minimum Length
                                  </Label>
                                  <Input
                                    id="min-length"
                                    type="number"
                                    placeholder="50"
                                    className="mt-1"
                                  />
                                  <p className="text-muted-foreground mt-1 text-xs">
                                    Min. read length after trimming
                                  </p>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center space-x-2">
                                  <Checkbox id="trim-adapters" defaultChecked />
                                  <Label htmlFor="trim-adapters">
                                    Automatically detect and trim adapters
                                  </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Checkbox id="trim-poly" />
                                  <Label htmlFor="trim-poly">
                                    Trim poly-A/T tails
                                  </Label>
                                </div>
                              </div>
                            </div>
                          )}

                          {selectedTool === "align" && (
                            <div className="space-y-4">
                              <h4 className="text-sm font-medium">
                                Alignment Options
                              </h4>
                              <div>
                                <Label htmlFor="reference-genome">
                                  Reference Genome
                                </Label>
                                <div className="mt-1 flex items-center">
                                  <Checkbox
                                    id="use-ref-genome"
                                    className="mr-2"
                                  />
                                  <Input
                                    id="reference-genome"
                                    placeholder="e.g. Mycobacterium tuberculosis H37Rv"
                                  />
                                </div>
                                <p className="text-muted-foreground mt-1 text-xs">
                                  Select reference genome from database or
                                  upload your own
                                </p>
                              </div>
                              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                  <Label htmlFor="aligner">
                                    Alignment Tool
                                  </Label>
                                  <Select defaultValue="bwa">
                                    <SelectTrigger
                                      id="aligner"
                                      className="mt-1"
                                    >
                                      <SelectValue placeholder="Select aligner" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="bwa">
                                        BWA-MEM
                                      </SelectItem>
                                      <SelectItem value="bowtie2">
                                        Bowtie2
                                      </SelectItem>
                                      <SelectItem value="minimap2">
                                        Minimap2
                                      </SelectItem>
                                      <SelectItem value="hisat2">
                                        HISAT2
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label htmlFor="output-format">
                                    Output Format
                                  </Label>
                                  <Select defaultValue="bam">
                                    <SelectTrigger
                                      id="output-format"
                                      className="mt-1"
                                    >
                                      <SelectValue placeholder="Select format" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="sam">SAM</SelectItem>
                                      <SelectItem value="bam">BAM</SelectItem>
                                      <SelectItem value="cram">CRAM</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </div>
                          )}

                          {selectedTool === "quality" && (
                            <div className="space-y-4">
                              <h4 className="text-sm font-medium">
                                Quality Control Options
                              </h4>
                              <div className="space-y-2">
                                <div className="flex items-center space-x-2">
                                  <Checkbox id="base-quality" defaultChecked />
                                  <Label htmlFor="base-quality">
                                    Base quality distribution
                                  </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Checkbox
                                    id="sequence-content"
                                    defaultChecked
                                  />
                                  <Label htmlFor="sequence-content">
                                    Sequence content analysis
                                  </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Checkbox
                                    id="duplicate-analysis"
                                    defaultChecked
                                  />
                                  <Label htmlFor="duplicate-analysis">
                                    Duplication level analysis
                                  </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Checkbox
                                    id="adapter-content"
                                    defaultChecked
                                  />
                                  <Label htmlFor="adapter-content">
                                    Adapter content analysis
                                  </Label>
                                </div>
                              </div>
                              <div>
                                <Label htmlFor="report-format">
                                  Report Format
                                </Label>
                                <Select defaultValue="html">
                                  <SelectTrigger
                                    id="report-format"
                                    className="mt-1"
                                  >
                                    <SelectValue placeholder="Select format" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="html">HTML</SelectItem>
                                    <SelectItem value="pdf">PDF</SelectItem>
                                    <SelectItem value="json">JSON</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          )}

                          {!selectedTool && (
                            <div className="flex flex-col items-center justify-center py-6 text-center">
                              <p className="text-muted-foreground">
                                Please select a tool from the Tools tab
                              </p>
                              <Button
                                variant="outline"
                                size="sm"
                                className="mt-2"
                                onClick={() => setActiveTab("tools")}
                              >
                                Go to Tools
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>

                      <Separator />

                      <div>
                        <h3 className="mb-3 text-base font-medium">
                          Output Settings
                        </h3>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                            <Label htmlFor="output-name">
                              Output Name Prefix
                            </Label>
                            <Input
                              id="output-name"
                              placeholder="my_project"
                              className="mt-1"
                            />
                          </div>
                        </div>

                        <div className="mt-4 space-y-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox id="compress-output" defaultChecked />
                            <Label htmlFor="compress-output">
                              Compress output files
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox id="create-summary" defaultChecked />
                            <Label htmlFor="create-summary">
                              Create summary report
                            </Label>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">
                        Pipeline Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            Selected Tool:
                          </span>
                          <span className="font-medium">
                            {selectedTool
                              ? fastqTools.find((t) => t.id === selectedTool)
                                  ?.name
                              : "None"}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            Input Files:
                          </span>
                          <span className="font-medium">
                            {selectedFiles.length} file(s)
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            Estimated Runtime:
                          </span>
                          <span className="font-medium">5-10 minutes</span>
                        </div>
                      </div>

                      {selectedFiles.length > 0 && selectedTool && (
                        <Button
                          className="w-full"
                          onClick={() => setActiveTab("results")}
                        >
                          <FiPlay className="mr-2 h-4 w-4" />
                          Run Pipeline
                        </Button>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-base">
                        Selected Files
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="py-0">
                      {selectedFiles.length > 0 ? (
                        <div className="space-y-2">
                          {selectedFiles.slice(0, 3).map((file, index) => (
                            <div
                              key={file.id}
                              className="flex items-center py-1 text-sm"
                            >
                              <FiFile className="text-primary-500 mr-2 h-3.5 w-3.5" />
                              <span className="truncate">{file.name}</span>
                            </div>
                          ))}
                          {selectedFiles.length > 3 && (
                            <div className="text-muted-foreground text-xs">
                              +{selectedFiles.length - 3} more files
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm">
                          No files selected
                        </p>
                      )}
                    </CardContent>
                    {selectedFiles.length > 0 && (
                      <CardFooter className="py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-xs"
                          onClick={() => setActiveTab("files")}
                        >
                          Edit Files
                        </Button>
                      </CardFooter>
                    )}
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Results Tab Content */}
            <TabsContent value="results" className="p-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Results</CardTitle>
                      <CardDescription>
                        Processing status and outputs
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-background-50 mb-6 rounded-md p-4">
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Progress:</span>
                            <span>{outputProgress}% complete</span>
                          </div>
                          <Progress value={outputProgress} className="h-2" />
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2"
                            onClick={() =>
                              setOutputProgress(
                                Math.min(100, outputProgress + 25),
                              )
                            }
                          >
                            {outputProgress < 100
                              ? "Simulate Progress"
                              : "Restart"}
                          </Button>
                        </div>
                      </div>

                      {outputProgress === 100 ? (
                        <div className="space-y-6">
                          <div>
                            <h3 className="mb-3 text-base font-medium">
                              Output Files
                            </h3>
                            <div className="space-y-2">
                              <div className="bg-background-100 flex items-center justify-between rounded-md p-3">
                                <div className="flex items-center">
                                  <FiFile className="text-primary-500 mr-2 h-4 w-4" />
                                  <span className="text-sm">
                                    trimmed_sample_R1.fastq.gz
                                  </span>
                                </div>
                                <Button size="sm" variant="ghost">
                                  <FiDownload className="h-4 w-4" />
                                </Button>
                              </div>
                              <div className="bg-background-100 flex items-center justify-between rounded-md p-3">
                                <div className="flex items-center">
                                  <FiFile className="text-primary-500 mr-2 h-4 w-4" />
                                  <span className="text-sm">
                                    trimmed_sample_R2.fastq.gz
                                  </span>
                                </div>
                                <Button size="sm" variant="ghost">
                                  <FiDownload className="h-4 w-4" />
                                </Button>
                              </div>
                              <div className="bg-background-100 flex items-center justify-between rounded-md p-3">
                                <div className="flex items-center">
                                  <FiFile className="text-primary-500 mr-2 h-4 w-4" />
                                  <span className="text-sm">
                                    trimming_report.html
                                  </span>
                                </div>
                                <Button size="sm" variant="ghost">
                                  <FiDownload className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>

                          <div>
                            <h3 className="mb-3 text-base font-medium">
                              Quality Metrics
                            </h3>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                              <div className="rounded-md border p-3">
                                <h4 className="mb-2 text-sm font-medium">
                                  Original vs. Trimmed Read Length
                                </h4>
                                <div className="bg-background-50 flex h-32 items-center justify-center">
                                  <span className="text-muted-foreground text-xs">
                                    Bar chart visualization
                                  </span>
                                </div>
                              </div>
                              <div className="rounded-md border p-3">
                                <h4 className="mb-2 text-sm font-medium">
                                  Quality Score Distribution
                                </h4>
                                <div className="bg-background-50 flex h-32 items-center justify-center">
                                  <span className="text-muted-foreground text-xs">
                                    Line chart visualization
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div>
                            <h3 className="mb-3 text-base font-medium">
                              Processing Summary
                            </h3>
                            <div className="space-y-2 text-sm">
                              <div className="bg-background-50 rounded-md p-3">
                                <p className="font-medium">Input Statistics</p>
                                <div className="mt-1 grid grid-cols-2 gap-2">
                                  <div>
                                    <span className="text-muted-foreground">
                                      Total reads:
                                    </span>
                                    <span className="ml-2">4,523,890</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">
                                      Read length:
                                    </span>
                                    <span className="ml-2">150 bp</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">
                                      GC content:
                                    </span>
                                    <span className="ml-2">42.6%</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">
                                      Q30 bases:
                                    </span>
                                    <span className="ml-2">92.3%</span>
                                  </div>
                                </div>
                              </div>

                              <div className="bg-background-50 rounded-md p-3">
                                <p className="font-medium">Output Statistics</p>
                                <div className="mt-1 grid grid-cols-2 gap-2">
                                  <div>
                                    <span className="text-muted-foreground">
                                      Reads after processing:
                                    </span>
                                    <span className="ml-2">4,378,245</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">
                                      Reads filtered:
                                    </span>
                                    <span className="ml-2">145,645 (3.2%)</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">
                                      Avg. length after trim:
                                    </span>
                                    <span className="ml-2">143.8 bp</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">
                                      Q30 bases after trim:
                                    </span>
                                    <span className="ml-2">98.1%</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                          <div className="bg-background-100 mb-4 rounded-full p-4">
                            <FiBarChart2 className="text-muted-foreground h-8 w-8" />
                          </div>
                          <h3 className="text-base font-medium">
                            Processing in progress
                          </h3>
                          <p className="text-muted-foreground mt-1 max-w-md text-sm">
                            Your files are being processed. This may take a few
                            minutes depending on file size.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Job Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Task:</span>
                          <span className="font-medium">
                            {selectedTool
                              ? fastqTools.find((t) => t.id === selectedTool)
                                  ?.name
                              : "None"}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            Started:
                          </span>
                          <span className="font-medium">Just now</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Status:</span>
                          <Badge
                            className={
                              outputProgress < 100
                                ? "bg-blue-100 text-blue-800"
                                : "bg-green-100 text-green-800"
                            }
                          >
                            {outputProgress < 100 ? "Running" : "Completed"}
                          </Badge>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            Files processed:
                          </span>
                          <span className="font-medium">
                            {selectedFiles.length}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            CPU time:
                          </span>
                          <span className="font-medium">
                            {outputProgress < 100
                              ? `${Math.floor(outputProgress / 10)} min`
                              : "10 min"}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 border-t pt-3">
                        <Button variant="outline" size="sm" className="w-full">
                          <FiDownload className="mr-2 h-4 w-4" />
                          Download All Results
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-base">Log Output</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <ScrollArea className="h-48 rounded-md bg-black p-2 font-mono text-xs text-white">
                        <div className="space-y-1 p-2">
                          <p>[INFO] Starting job: fastq_trimming_01</p>
                          <p>[INFO] Loading input files...</p>
                          <p>[INFO] Found 2 FASTQ files for processing</p>
                          <p>[INFO] Initializing trimming tool</p>
                          <p>[INFO] Analyzing sequence quality distribution</p>
                          <p>[INFO] Detected Illumina universal adapters</p>
                          <p>[INFO] Starting trimming process</p>
                          <p>[INFO] Processing read pair 1/4523890</p>
                          <p>[INFO] Processing read pair 500000/4523890</p>
                          <p>[INFO] Processing read pair 1000000/4523890</p>
                          {outputProgress >= 50 && (
                            <>
                              <p>[INFO] Processing read pair 2000000/4523890</p>
                              <p>[INFO] Processing read pair 3000000/4523890</p>
                            </>
                          )}
                          {outputProgress >= 75 && (
                            <>
                              <p>[INFO] Processing read pair 4000000/4523890</p>
                              <p>[INFO] Completed processing all read pairs</p>
                            </>
                          )}
                          {outputProgress >= 100 && (
                            <>
                              <p>[INFO] Writing output files...</p>
                              <p>[INFO] Generating QC report</p>
                              <p>[INFO] Job completed successfully</p>
                              <p>[INFO] Total time: 10 minutes 23 seconds</p>
                            </>
                          )}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-base">Next Steps</CardTitle>
                    </CardHeader>
                    <CardContent className="py-0">
                      <div className="space-y-3">
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5 rounded-full bg-green-100 p-1">
                            <FiCheck className="h-3 w-3 text-green-700" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              Download Results
                            </p>
                            <p className="text-muted-foreground text-xs">
                              Save processed files and reports
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="bg-background-100 mt-0.5 rounded-full p-1">
                            <FiBarChart2 className="text-muted-foreground h-3 w-3" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              Analyze Results
                            </p>
                            <p className="text-muted-foreground text-xs">
                              Review quality metrics and visualizations
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="bg-background-100 mt-0.5 rounded-full p-1">
                            <FiPlay className="text-muted-foreground h-3 w-3" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              Continue Processing
                            </p>
                            <p className="text-muted-foreground text-xs">
                              Use processed files in downstream analysis
                            </p>
                          </div>
                        </div>
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
              <Button>
                {activeTab === "home"
                  ? "Get Started"
                  : activeTab === "tools"
                    ? "Select Tool"
                    : activeTab === "files"
                      ? "Continue"
                      : activeTab === "pipeline"
                        ? "Run Pipeline"
                        : "Submit"}
              </Button>
            </div>
          </div>
        </Card>
      </main>

      <footer className="container mx-auto py-8">
        <div className="text-muted-foreground flex flex-col items-center justify-between gap-4 text-sm md:flex-row">
          <div>© 2025 FastQ Utilities Service</div>
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

export default FastqUtilitiesService;
