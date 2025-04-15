"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Info,
  Upload,
  FileText,
  ArrowRight,
  X,
  HelpCircle,
  Dna,
  FilePlus2,
  AlertCircle,
  Check,
  ChevronRight,
  Atom,
  Beaker,
} from "lucide-react";

export default function GenomeAnalysisCreative() {
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [activeStep, setActiveStep] = useState(1);
  const [processState, setProcessState] = useState("initial"); // initial, uploading, analyzing, complete

  const addFile = () => {
    setSelectedFiles([
      ...selectedFiles,
      `Sample_${selectedFiles.length + 1}.fastq`,
    ]);
  };

  const removeFile = (index: number) => {
    const newFiles = [...selectedFiles];
    newFiles.splice(index, 1);
    setSelectedFiles(newFiles);
  };

  const nextStep = () => {
    if (activeStep < 3) {
      setActiveStep(activeStep + 1);
    } else {
      // Start the submission process
      setProcessState("uploading");
      setTimeout(() => {
        setProcessState("analyzing");
        setTimeout(() => {
          setProcessState("complete");
        }, 3000);
      }, 2000);
    }
  };

  const prevStep = () => {
    if (activeStep > 1) {
      setActiveStep(activeStep - 1);
    }
  };

  return (
    <div className="from-background-50 to-background-200 min-h-screen bg-gradient-to-b">
      {/* Header */}
      <header className="bg-primary-600 px-4 py-6 text-white">
        <div className="container mx-auto max-w-6xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Dna className="h-8 w-8" />
              <div>
                <h1 className="text-2xl font-bold">
                  SARS-CoV-2 Genome Analysis
                </h1>
                <p className="text-sm opacity-90">
                  Advanced sequence analysis platform
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge className="text-primary-700 bg-white">v5.3.2</Badge>
              <Button
                variant="outline"
                className="hover:text-primary-700 border-white text-white hover:bg-white"
              >
                Documentation
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto max-w-6xl px-4 py-8">
        {processState === "initial" ? (
          <>
            {/* Progress Steps */}
            <div className="mb-8">
              <div className="mx-auto mb-2 flex max-w-3xl items-center justify-between">
                <div
                  className={`flex flex-col items-center ${activeStep >= 1 ? "text-primary-600" : "text-muted-foreground"}`}
                >
                  <div
                    className={`mb-2 flex h-10 w-10 items-center justify-center rounded-full ${activeStep >= 1 ? "bg-primary-100 text-primary-600 border-primary-500 border-2" : "bg-muted border"}`}
                  >
                    <FilePlus2 className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-medium">Input Files</span>
                </div>
                <div
                  className={`h-1 w-24 ${activeStep >= 2 ? "bg-primary-500" : "bg-muted"}`}
                ></div>
                <div
                  className={`flex flex-col items-center ${activeStep >= 2 ? "text-primary-600" : "text-muted-foreground"}`}
                >
                  <div
                    className={`mb-2 flex h-10 w-10 items-center justify-center rounded-full ${activeStep >= 2 ? "bg-primary-100 text-primary-600 border-primary-500 border-2" : "bg-muted border"}`}
                  >
                    <Beaker className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-medium">Parameters</span>
                </div>
                <div
                  className={`h-1 w-24 ${activeStep >= 3 ? "bg-primary-500" : "bg-muted"}`}
                ></div>
                <div
                  className={`flex flex-col items-center ${activeStep >= 3 ? "text-primary-600" : "text-muted-foreground"}`}
                >
                  <div
                    className={`mb-2 flex h-10 w-10 items-center justify-center rounded-full ${activeStep >= 3 ? "bg-primary-100 text-primary-600 border-primary-500 border-2" : "bg-muted border"}`}
                  >
                    <Check className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-medium">Review</span>
                </div>
              </div>
            </div>

            {/* Step 1: Input Files */}
            {activeStep === 1 && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-3">
                  <Card className="border-none shadow-lg">
                    <CardHeader className="bg-primary-50 rounded-t-lg">
                      <CardTitle className="text-primary-700 flex items-center gap-2">
                        <FilePlus2 className="h-5 w-5" />
                        Input Files
                      </CardTitle>
                      <CardDescription>
                        Upload raw sequencing data for analysis
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="space-y-6">
                        <Tabs defaultValue="paired" className="w-full">
                          <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="paired">
                              Paired Reads
                            </TabsTrigger>
                            <TabsTrigger value="single">
                              Single Reads
                            </TabsTrigger>
                            <TabsTrigger value="sra">SRA Accession</TabsTrigger>
                          </TabsList>

                          <TabsContent value="paired" className="pt-4">
                            {selectedFiles.length === 0 ? (
                              <div
                                className="border-muted-foreground/20 hover:bg-muted/50 cursor-pointer rounded-lg border-2 border-dashed p-12 text-center transition-colors"
                                onClick={addFile}
                              >
                                <div className="bg-primary-50 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
                                  <Upload className="text-primary-500 h-6 w-6" />
                                </div>
                                <h3 className="mb-2 text-lg font-medium">
                                  Drop your files here or click to browse
                                </h3>
                                <p className="text-muted-foreground mx-auto max-w-md text-sm">
                                  Support for FASTQ, FASTA, BAM, or SRA
                                  accession numbers
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {selectedFiles.map((file, index) => (
                                  <div
                                    key={index}
                                    className="bg-background-100 flex items-center gap-3 rounded-md p-3"
                                  >
                                    <div className="bg-primary-100 rounded p-2">
                                      <FileText className="text-primary-600 h-5 w-5" />
                                    </div>
                                    <div className="flex-1">
                                      <p className="text-sm font-medium">
                                        {file}
                                      </p>
                                      <p className="text-muted-foreground text-xs">
                                        3.2 MB • FASTQ
                                      </p>
                                    </div>
                                    <Select defaultValue="illumina">
                                      <SelectTrigger className="w-32">
                                        <SelectValue placeholder="Platform" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="illumina">
                                          Illumina
                                        </SelectItem>
                                        <SelectItem value="nanopore">
                                          Nanopore
                                        </SelectItem>
                                        <SelectItem value="pacbio">
                                          PacBio
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeFile(index)}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ))}

                                <Button
                                  variant="outline"
                                  className="mt-4 flex items-center gap-2"
                                  onClick={addFile}
                                >
                                  <FilePlus2 className="h-4 w-4" />
                                  Add Another File
                                </Button>
                              </div>
                            )}
                          </TabsContent>

                          <TabsContent value="single" className="pt-4">
                            <div className="space-y-3">
                              <div className="border-muted-foreground/20 hover:bg-muted/50 cursor-pointer rounded-lg border-2 border-dashed p-12 text-center transition-colors">
                                <div className="bg-primary-50 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
                                  <Upload className="text-primary-500 h-6 w-6" />
                                </div>
                                <h3 className="mb-2 text-lg font-medium">
                                  Drop your single-read file here
                                </h3>
                                <p className="text-muted-foreground mx-auto max-w-md text-sm">
                                  Support for FASTQ, FASTA formats
                                </p>
                              </div>
                            </div>
                          </TabsContent>

                          <TabsContent value="sra" className="pt-4">
                            <div className="space-y-4">
                              <div className="bg-primary-50 rounded-md p-4">
                                <p className="text-sm">
                                  Enter an SRA accession number (e.g.,
                                  SRR12345678) to fetch data directly from NCBI
                                </p>
                              </div>
                              <div className="flex items-center gap-3">
                                <Input
                                  placeholder="SRR or ERR accession number"
                                  className="flex-1"
                                />
                                <Button>Validate</Button>
                              </div>
                            </div>
                          </TabsContent>
                        </Tabs>
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-between border-t p-6">
                      <Button variant="ghost" disabled>
                        Back
                      </Button>
                      <Button
                        onClick={nextStep}
                        disabled={selectedFiles.length === 0}
                      >
                        Continue
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    </CardFooter>
                  </Card>
                </div>
              </div>
            )}

            {/* Step 2: Parameters */}
            {activeStep === 2 && (
              <div className="grid grid-cols-1 gap-6">
                <Card className="border-none shadow-lg">
                  <CardHeader className="bg-primary-50 rounded-t-lg">
                    <CardTitle className="text-primary-700 flex items-center gap-2">
                      <Beaker className="h-5 w-5" />
                      Analysis Parameters
                    </CardTitle>
                    <CardDescription>
                      Configure genome analysis settings
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                      <div className="space-y-6">
                        <div>
                          <h3 className="text-primary-700 mb-4 text-base font-medium">
                            Analysis Strategy
                          </h3>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Pipeline</Label>
                              <Select defaultValue="codex">
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a strategy" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="codex">
                                    One Codex
                                  </SelectItem>
                                  <SelectItem value="artic">
                                    ARTIC Network
                                  </SelectItem>
                                  <SelectItem value="custom">
                                    Custom Pipeline
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label>Pipeline Version</Label>
                              <Select defaultValue="v5.3.2">
                                <SelectTrigger>
                                  <SelectValue placeholder="Select version" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="v5.3.2">
                                    V5.3.2 (Latest)
                                  </SelectItem>
                                  <SelectItem value="v5.2.0">V5.2.0</SelectItem>
                                  <SelectItem value="v5.1.0">V5.1.0</SelectItem>
                                </SelectContent>
                              </Select>
                              <p className="text-muted-foreground mt-1 text-xs">
                                Released: March 15, 2025
                              </p>
                            </div>

                            <div className="space-y-2">
                              <Label>Primer Scheme</Label>
                              <Select defaultValue="artic">
                                <SelectTrigger>
                                  <SelectValue placeholder="Select primer" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="artic">
                                    ARTIC v4.1
                                  </SelectItem>
                                  <SelectItem value="midnight">
                                    Midnight v3
                                  </SelectItem>
                                  <SelectItem value="custom">
                                    Custom Primers
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>

                        <Separator />

                        <div>
                          <h3 className="text-primary-700 mb-4 text-base font-medium">
                            Taxonomy
                          </h3>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label>Taxonomy Name</Label>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <HelpCircle className="text-muted-foreground h-4 w-4" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="w-64">
                                        Specify the organism name
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                              <Select defaultValue="sars">
                                <SelectTrigger>
                                  <SelectValue placeholder="Select taxonomy" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="sars">
                                    Severe acute respiratory syndrome
                                  </SelectItem>
                                  <SelectItem value="sars2">
                                    SARS-CoV-2
                                  </SelectItem>
                                  <SelectItem value="other">
                                    Other coronavirus
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label>Taxonomy ID</Label>
                              <Select defaultValue="2697049">
                                <SelectTrigger>
                                  <SelectValue placeholder="Select taxonomy ID" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="2697049">
                                    2697049
                                  </SelectItem>
                                  <SelectItem value="other">
                                    Other ID
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div>
                          <h3 className="text-primary-700 mb-4 text-base font-medium">
                            Output Options
                          </h3>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Sample Label</Label>
                              <Input placeholder="My identifier123" />
                              <p className="text-muted-foreground mt-1 text-xs">
                                A unique identifier for this analysis
                              </p>
                            </div>

                            <div className="space-y-2">
                              <Label>Output Folder</Label>
                              <div className="flex gap-2">
                                <Input
                                  placeholder="/output/path"
                                  className="flex-1"
                                />
                                <Button variant="outline" size="icon">
                                  <FileText className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label>Output Name</Label>
                              <Input placeholder="Taxonomy + My Label" />
                            </div>

                            <div className="flex items-center justify-between space-x-2 pt-2">
                              <Label
                                htmlFor="advanced-options"
                                className="flex items-center gap-2"
                              >
                                <span>Advanced Options</span>
                              </Label>
                              <Switch id="advanced-options" />
                            </div>
                          </div>
                        </div>

                        <Alert className="border-blue-100 bg-blue-50 text-blue-800">
                          <Info className="h-4 w-4" />
                          <AlertDescription>
                            Analysis typically takes 15-45 minutes depending on
                            file size and selected parameters.
                          </AlertDescription>
                        </Alert>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between border-t p-6">
                    <Button variant="ghost" onClick={prevStep}>
                      Back
                    </Button>
                    <Button onClick={nextStep}>
                      Continue
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            )}

            {/* Step 3: Review */}
            {activeStep === 3 && (
              <div className="grid grid-cols-1 gap-6">
                <Card className="border-none shadow-lg">
                  <CardHeader className="bg-primary-50 rounded-t-lg">
                    <CardTitle className="text-primary-700 flex items-center gap-2">
                      <Check className="h-5 w-5" />
                      Review and Submit
                    </CardTitle>
                    <CardDescription>
                      Confirm your analysis configuration
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                      <div className="space-y-6">
                        <div>
                          <h3 className="text-primary-700 mb-4 text-base font-medium">
                            Input Files
                          </h3>
                          <div className="space-y-2">
                            {selectedFiles.map((file, index) => (
                              <div
                                key={index}
                                className="bg-background-100 flex items-center gap-3 rounded-md p-2"
                              >
                                <FileText className="text-primary-600 h-4 w-4" />
                                <p className="text-sm">{file}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h3 className="text-primary-700 mb-4 text-base font-medium">
                            Analysis Strategy
                          </h3>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between border-b py-1">
                              <span className="text-muted-foreground">
                                Pipeline:
                              </span>
                              <span className="font-medium">One Codex</span>
                            </div>
                            <div className="flex justify-between border-b py-1">
                              <span className="text-muted-foreground">
                                Version:
                              </span>
                              <span className="font-medium">V5.3.2</span>
                            </div>
                            <div className="flex justify-between border-b py-1">
                              <span className="text-muted-foreground">
                                Primer Scheme:
                              </span>
                              <span className="font-medium">ARTIC v4.1</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div>
                          <h3 className="text-primary-700 mb-4 text-base font-medium">
                            Taxonomy
                          </h3>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between border-b py-1">
                              <span className="text-muted-foreground">
                                Name:
                              </span>
                              <span className="font-medium">
                                Severe acute respiratory syndrome
                              </span>
                            </div>
                            <div className="flex justify-between border-b py-1">
                              <span className="text-muted-foreground">ID:</span>
                              <span className="font-medium">2697049</span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-primary-700 mb-4 text-base font-medium">
                            Output
                          </h3>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between border-b py-1">
                              <span className="text-muted-foreground">
                                Label:
                              </span>
                              <span className="font-medium">
                                My identifier123
                              </span>
                            </div>
                            <div className="flex justify-between border-b py-1">
                              <span className="text-muted-foreground">
                                Folder:
                              </span>
                              <span className="font-medium">/output/path</span>
                            </div>
                            <div className="flex justify-between border-b py-1">
                              <span className="text-muted-foreground">
                                Filename:
                              </span>
                              <span className="font-medium">
                                SARS_My_identifier123
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-4">
                      <AlertCircle className="mt-0.5 h-5 w-5 text-amber-500" />
                      <div>
                        <h4 className="font-medium text-amber-800">
                          Important Note
                        </h4>
                        <p className="text-sm text-amber-700">
                          By submitting this analysis, you confirm that you have
                          the necessary rights to process this genomic data and
                          agree to our terms of service regarding the storage
                          and processing of biological sequence information.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between border-t p-6">
                    <Button variant="ghost" onClick={prevStep}>
                      Back
                    </Button>
                    <Button onClick={nextStep}>Submit Analysis</Button>
                  </CardFooter>
                </Card>
              </div>
            )}
          </>
        ) : (
          <div className="mx-auto mt-12 max-w-2xl text-center">
            {processState === "uploading" && (
              <div className="space-y-6">
                <div className="bg-primary-100 mx-auto flex h-16 w-16 items-center justify-center rounded-full">
                  <Upload className="text-primary-600 h-8 w-8 animate-pulse" />
                </div>
                <h2 className="text-2xl font-bold">Uploading Files</h2>
                <Progress value={65} className="h-2 w-full" />
                <p className="text-muted-foreground">
                  Transferring sequence data to analysis servers...
                </p>
              </div>
            )}

            {processState === "analyzing" && (
              <div className="space-y-6">
                <div className="bg-primary-100 mx-auto flex h-16 w-16 items-center justify-center rounded-full">
                  <Dna className="text-primary-600 h-8 w-8 animate-spin" />
                </div>
                <h2 className="text-2xl font-bold">Processing Genome</h2>
                <Progress value={40} className="h-2 w-full" />
                <p className="text-muted-foreground">
                  Running variant calling pipeline...
                </p>
              </div>
            )}

            {processState === "complete" && (
              <div className="space-y-6">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <Check className="h-8 w-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold">Analysis Complete!</h2>
                <p className="text-muted-foreground mb-6">
                  Your genome analysis has been successfully processed.
                </p>
                <div className="flex flex-col items-center gap-3">
                  <Button className="w-full max-w-xs">View Results</Button>
                  <Button variant="outline" className="w-full max-w-xs">
                    Download Report (PDF)
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
