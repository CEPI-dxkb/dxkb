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
  Droplet,
  FilePlus2,
  AlertCircle,
  Check,
  ChevronRight,
  Calendar,
  Beaker,
  MoveRight,
  Microscope,
  FileSpreadsheet,
  BarChart4,
  DownloadCloud,
} from "lucide-react";

export default function WastewaterAnalysisCreative() {
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("upload");
  const [analysisStatus, setAnalysisStatus] = useState("idle"); // idle, processing, complete
  const [processingStep, setProcessingStep] = useState(0);

  const addFile = () => {
    setSelectedFiles([
      ...selectedFiles,
      `Wastewater_Sample_${selectedFiles.length + 1}.fastq`,
    ]);
  };

  const removeFile = (index: number) => {
    const newFiles = [...selectedFiles];
    newFiles.splice(index, 1);
    setSelectedFiles(newFiles);
  };

  const submitAnalysis = () => {
    setAnalysisStatus("processing");
    setProcessingStep(1);

    // Simulate processing steps
    const processingSteps = [1, 2, 3, 4];
    let currentStep = 0;

    const interval = setInterval(() => {
      currentStep++;
      if (currentStep < processingSteps.length) {
        setProcessingStep(processingSteps[currentStep]);
      } else {
        setAnalysisStatus("complete");
        clearInterval(interval);
      }
    }, 2000);
  };

  const renderProcessingStatus = () => {
    const steps = [
      { icon: <Upload className="h-5 w-5" />, label: "Uploading files" },
      {
        icon: <Beaker className="h-5 w-5" />,
        label: "Running initial quality control",
      },
      {
        icon: <Microscope className="h-5 w-5" />,
        label: "Assembling genome sequences",
      },
      {
        icon: <BarChart4 className="h-5 w-5" />,
        label: "Performing variant analysis",
      },
    ];

    return (
      <div className="mx-auto w-full max-w-md">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isActive = processingStep === stepNumber;
          const isComplete = processingStep > stepNumber;

          return (
            <div key={index} className="mb-4 flex items-start gap-3">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isComplete ? "bg-green-100 text-green-600" : isActive ? "animate-pulse bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-400"}`}
              >
                {isComplete ? <Check className="h-4 w-4" /> : step.icon}
              </div>
              <div className="flex-1">
                <p
                  className={`text-sm font-medium ${isActive ? "text-blue-600" : isComplete ? "text-green-600" : "text-gray-500"}`}
                >
                  {step.label}
                </p>
                {isActive && (
                  <Progress
                    value={Math.floor(Math.random() * 100)}
                    className="mt-1 h-1"
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-800 py-6 text-white">
        <div className="container mx-auto px-6">
          <div className="flex flex-col justify-between md:flex-row md:items-center">
            <div className="mb-4 flex items-center gap-3 md:mb-0">
              <div className="rounded-lg bg-white/20 p-2">
                <Droplet className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold md:text-2xl">
                  SARS-CoV-2 Wastewater Analysis
                </h1>
                <p className="text-sm text-blue-100">
                  Variant tracking and surveillance
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge className="border-none bg-white/20 text-white transition-colors hover:bg-white/30">
                <a href="#" className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  <span>Documentation</span>
                </a>
              </Badge>
              <Badge className="border-none bg-white/20 text-white transition-colors hover:bg-white/30">
                <a href="#" className="flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5" />
                  <span>Tutorial</span>
                </a>
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {analysisStatus === "idle" ? (
          <>
            {/* Tabs Navigation */}
            <div className="mb-8 flex justify-center">
              <Tabs
                defaultValue="upload"
                className="w-full max-w-3xl"
                onValueChange={setActiveTab}
              >
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger
                    value="upload"
                    className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700"
                  >
                    <FilePlus2 className="mr-2 h-4 w-4" />
                    Upload Files
                  </TabsTrigger>
                  <TabsTrigger
                    value="configure"
                    className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700"
                  >
                    <Beaker className="mr-2 h-4 w-4" />
                    Configure Analysis
                  </TabsTrigger>
                  <TabsTrigger
                    value="review"
                    className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700"
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Review & Submit
                  </TabsTrigger>
                </TabsList>

                {/* Upload Files Tab */}
                <TabsContent value="upload" className="mt-6">
                  <div className="space-y-6">
                    <Card>
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <FilePlus2 className="h-5 w-5 text-blue-600" />
                          Input Files
                        </CardTitle>
                        <CardDescription>
                          Upload sequencing data from wastewater samples
                        </CardDescription>
                      </CardHeader>

                      <CardContent>
                        <Tabs defaultValue="paired">
                          <TabsList className="mb-4 w-full">
                            <TabsTrigger value="paired" className="flex-1">
                              Paired Reads
                            </TabsTrigger>
                            <TabsTrigger value="single" className="flex-1">
                              Single Reads
                            </TabsTrigger>
                            <TabsTrigger value="sra" className="flex-1">
                              SRA Accession
                            </TabsTrigger>
                          </TabsList>

                          <TabsContent value="paired">
                            {selectedFiles.length === 0 ? (
                              <div
                                className="cursor-pointer rounded-lg border-2 border-dashed border-blue-200 p-12 transition-colors hover:bg-blue-50"
                                onClick={addFile}
                              >
                                <div className="flex flex-col items-center text-center">
                                  <div className="mb-4 rounded-full bg-blue-100 p-3">
                                    <Upload className="h-6 w-6 text-blue-600" />
                                  </div>
                                  <h3 className="mb-2 font-medium">
                                    Drop your paired-end read files here
                                  </h3>
                                  <p className="max-w-md text-sm text-gray-500">
                                    Upload FASTQ files from wastewater samples
                                    for variant analysis
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {selectedFiles.map((file, index) => (
                                  <div
                                    key={index}
                                    className="flex items-center rounded-md border border-blue-100 bg-blue-50 p-3"
                                  >
                                    <div className="mr-3 rounded bg-blue-100 p-2">
                                      <FileText className="h-5 w-5 text-blue-600" />
                                    </div>
                                    <div className="flex-1">
                                      <p className="text-sm font-medium">
                                        {file}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        4.3 MB • Paired-end reads • FASTQ
                                      </p>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
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

                          <TabsContent value="single">
                            <div className="cursor-pointer rounded-lg border-2 border-dashed border-blue-200 p-12 transition-colors hover:bg-blue-50">
                              <div className="flex flex-col items-center text-center">
                                <div className="mb-4 rounded-full bg-blue-100 p-3">
                                  <Upload className="h-6 w-6 text-blue-600" />
                                </div>
                                <h3 className="mb-2 font-medium">
                                  Drop your single-end read file here
                                </h3>
                                <p className="max-w-md text-sm text-gray-500">
                                  Upload FASTQ file from wastewater sample for
                                  variant analysis
                                </p>
                              </div>
                            </div>
                          </TabsContent>

                          <TabsContent value="sra">
                            <div className="space-y-4">
                              <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
                                <div className="flex items-start gap-3">
                                  <Info className="mt-0.5 h-5 w-5 text-amber-500" />
                                  <p className="text-sm text-amber-700">
                                    Enter an SRA accession number to fetch data
                                    directly from NCBI. This may take longer
                                    depending on the size of the dataset.
                                  </p>
                                </div>
                              </div>
                              <div className="flex gap-3">
                                <Input
                                  placeholder="e.g. SRR12345678"
                                  className="flex-1"
                                />
                                <Button>Fetch Data</Button>
                              </div>
                            </div>
                          </TabsContent>
                        </Tabs>
                      </CardContent>

                      <CardFooter className="flex justify-between border-t pt-2">
                        <div></div>
                        <Button
                          onClick={() => setActiveTab("configure")}
                          disabled={selectedFiles.length === 0}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          Continue to Configuration
                          <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                      </CardFooter>
                    </Card>
                  </div>
                </TabsContent>

                {/* Configure Analysis Tab */}
                <TabsContent value="configure" className="mt-6">
                  <div className="space-y-6">
                    <Card>
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Beaker className="h-5 w-5 text-blue-600" />
                          Sample Information
                        </CardTitle>
                        <CardDescription>
                          Provide details about your wastewater samples
                        </CardDescription>
                      </CardHeader>

                      <CardContent>
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Sample Identifier</Label>
                              <Input placeholder="e.g. WW-NYC-20250412" />
                              <p className="text-xs text-gray-500">
                                A unique identifier for this wastewater sample
                              </p>
                            </div>

                            <div className="space-y-2">
                              <Label>Sample Collection Date</Label>
                              <div className="flex items-center gap-2">
                                <Input type="date" className="flex-1" />
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <div className="rounded-md bg-gray-100 p-2">
                                        <Calendar className="h-4 w-4 text-gray-600" />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Date when sample was collected</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Collection Location</Label>
                              <Input placeholder="e.g. Downtown Wastewater Treatment Plant" />
                            </div>

                            <div className="space-y-2">
                              <Label>Sample Volume (L)</Label>
                              <Input
                                type="number"
                                min="0"
                                step="0.1"
                                placeholder="e.g. 0.5"
                              />
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Beaker className="h-5 w-5 text-blue-600" />
                          Analysis Parameters
                        </CardTitle>
                        <CardDescription>
                          Configure how your samples will be analyzed
                        </CardDescription>
                      </CardHeader>

                      <CardContent>
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Analysis Pipeline</Label>
                              <Select defaultValue="onecodex">
                                <SelectTrigger>
                                  <SelectValue placeholder="Select analysis method" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="onecodex">
                                    One Codex
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
                                    v5.3.2 (Latest)
                                  </SelectItem>
                                  <SelectItem value="v5.2.1">v5.2.1</SelectItem>
                                  <SelectItem value="v5.1.0">v5.1.0</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label>Primers</Label>
                              <Select defaultValue="artic">
                                <SelectTrigger>
                                  <SelectValue placeholder="Select primers" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="artic">ARTIC</SelectItem>
                                  <SelectItem value="swift">Swift</SelectItem>
                                  <SelectItem value="midnight">
                                    Midnight
                                  </SelectItem>
                                  <SelectItem value="custom">Custom</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Output Folder</Label>
                              <div className="flex gap-2">
                                <Input
                                  placeholder="/path/to/output"
                                  className="flex-1"
                                />
                                <Button variant="outline" size="icon">
                                  <FileText className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label>Output Name</Label>
                              <Input placeholder="e.g. WW_Analysis_April2025" />
                              <p className="text-xs text-gray-500">
                                Files will be saved with this name prefix
                              </p>
                            </div>

                            <div className="flex items-center justify-between pt-2">
                              <Label
                                htmlFor="advanced-settings"
                                className="cursor-pointer"
                              >
                                Advanced Settings
                              </Label>
                              <Switch id="advanced-settings" />
                            </div>
                          </div>
                        </div>
                      </CardContent>

                      <CardFooter className="flex justify-between border-t pt-4">
                        <Button
                          variant="outline"
                          onClick={() => setActiveTab("upload")}
                        >
                          Back to Files
                        </Button>
                        <Button
                          onClick={() => setActiveTab("review")}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          Continue to Review
                          <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                      </CardFooter>
                    </Card>
                  </div>
                </TabsContent>

                {/* Review & Submit Tab */}
                <TabsContent value="review" className="mt-6">
                  <Card>
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Check className="h-5 w-5 text-blue-600" />
                        Review & Submit
                      </CardTitle>
                      <CardDescription>
                        Confirm your analysis details before submission
                      </CardDescription>
                    </CardHeader>

                    <CardContent>
                      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                        <div>
                          <h3 className="mb-3 border-b border-blue-100 pb-1 font-medium text-blue-800">
                            Input Files
                          </h3>
                          {selectedFiles.length > 0 ? (
                            <div className="space-y-2">
                              {selectedFiles.map((file, index) => (
                                <div
                                  key={index}
                                  className="flex items-center gap-2 text-sm"
                                >
                                  <FileText className="h-4 w-4 text-blue-500" />
                                  <span>{file}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500 italic">
                              No files selected
                            </p>
                          )}

                          <h3 className="mt-6 mb-3 border-b border-blue-100 pb-1 font-medium text-blue-800">
                            Sample Info
                          </h3>
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500">Sample ID:</span>
                              <span className="font-medium">
                                WW-NYC-20250412
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500">
                                Collection Date:
                              </span>
                              <span className="font-medium">
                                April 12, 2025
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500">Location:</span>
                              <span className="font-medium">
                                Downtown Treatment Plant
                              </span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h3 className="mb-3 border-b border-blue-100 pb-1 font-medium text-blue-800">
                            Analysis Settings
                          </h3>
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500">Pipeline:</span>
                              <span className="font-medium">One Codex</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500">Version:</span>
                              <span className="font-medium">v5.3.2</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500">Primers:</span>
                              <span className="font-medium">ARTIC</span>
                            </div>
                          </div>

                          <h3 className="mt-6 mb-3 border-b border-blue-100 pb-1 font-medium text-blue-800">
                            Output
                          </h3>
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500">
                                Output Folder:
                              </span>
                              <span className="font-medium">
                                /path/to/output
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500">
                                Output Name:
                              </span>
                              <span className="font-medium">
                                WW_Analysis_April2025
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <Alert className="mt-6 border border-amber-100 bg-amber-50">
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                        <AlertDescription className="text-amber-700">
                          Analysis may take 30-60 minutes to complete depending
                          on sample complexity. You'll receive an email
                          notification when results are ready.
                        </AlertDescription>
                      </Alert>
                    </CardContent>

                    <CardFooter className="flex justify-between border-t pt-4">
                      <Button
                        variant="outline"
                        onClick={() => setActiveTab("configure")}
                      >
                        Back to Configuration
                      </Button>
                      <Button
                        onClick={submitAnalysis}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        Submit Analysis
                      </Button>
                    </CardFooter>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </>
        ) : (
          <div className="mx-auto mt-8 max-w-2xl rounded-lg border bg-white p-6 shadow-sm">
            {analysisStatus === "processing" ? (
              <div className="space-y-6">
                <div className="mb-6 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                    <Microscope className="h-8 w-8 text-blue-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-800">
                    Processing Your Wastewater Analysis
                  </h2>
                  <p className="mt-2 text-gray-500">
                    Please wait while we analyze your samples
                  </p>
                </div>

                {renderProcessingStatus()}

                <div className="mt-8 border-t border-gray-100 pt-6">
                  <p className="text-center text-sm text-gray-500">
                    You can close this window. We'll email you when your results
                    are ready.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6 text-center">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
                  <Check className="h-10 w-10 text-green-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    Analysis Complete!
                  </h2>
                  <p className="mt-2 text-gray-500">
                    Your wastewater analysis results are ready
                  </p>
                </div>

                <div className="mx-auto max-w-md rounded-lg border border-green-100 bg-green-50 p-4">
                  <div className="flex items-start gap-3">
                    <div>
                      <FileSpreadsheet className="h-8 w-8 text-green-600" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-medium text-green-800">
                        WW_Analysis_April2025
                      </h3>
                      <p className="text-sm text-green-700">
                        Completed April 15, 2025 at 10:42 AM
                      </p>
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" className="h-8 text-xs">
                          View Results
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex h-8 items-center gap-1 text-xs"
                        >
                          <DownloadCloud className="h-3 w-3" />
                          Download
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <Button
                    variant="link"
                    onClick={() => {
                      setAnalysisStatus("idle");
                      setSelectedFiles([]);
                      setActiveTab("upload");
                    }}
                  >
                    Start a New Analysis
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
