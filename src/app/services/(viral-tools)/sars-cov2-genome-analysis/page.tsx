"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Info,
  Upload,
  FileText,
  ArrowRight,
  X,
  HelpCircle,
} from "lucide-react";

export default function GenomeAnalysis() {
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);

  const addFile = () => {
    setSelectedFiles([
      ...selectedFiles,
      `READ FILE ${selectedFiles.length + 1}`,
    ]);
  };

  const removeFile = (index: number) => {
    const newFiles = [...selectedFiles];
    newFiles.splice(index, 1);
    setSelectedFiles(newFiles);
  };

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      {/* Header Section */}
      <div className="mb-8 text-center">
        <div className="mb-2 flex items-center justify-center gap-2">
          <h1 className="text-2xl font-bold">SARS-CoV-2 Genome Analysis</h1>
          <div className="flex gap-1">
            <Badge variant="outline" className="bg-primary-50 text-primary-700">
              v5.3.2
            </Badge>
            <Badge variant="outline" className="bg-primary-50 text-primary-700">
              <a href="#" className="flex items-center gap-1">
                <Info className="h-4 w-4" />
                <span>Info</span>
              </a>
            </Badge>
          </div>
        </div>
        <p className="text-muted-foreground mx-auto max-w-2xl text-sm">
          The SARS-CoV-2 Genome Analysis Service provides a streamlined
          "meta-service" that accepts raw reads and performs genome assembly,
          annotation, and variation analysis. For further explanation, please
          see the
          <a href="#" className="text-primary-600 mx-1 hover:underline">
            SARS-CoV-2 Genome Analysis Service Quick Reference Guide
          </a>
          and
          <a href="#" className="text-primary-600 ml-1 hover:underline">
            Tutorial
          </a>
          .
        </p>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Start With Section */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                Start With:
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="text-muted-foreground h-4 w-4" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="w-64">Choose how to start your analysis</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <Button
                variant="outline"
                className="flex h-10 w-full items-center justify-start gap-2"
              >
                <FileText className="h-4 w-4" />
                READ FILE
              </Button>
              <Button
                variant="outline"
                className="flex h-10 w-full items-center justify-start gap-2"
              >
                <Upload className="h-4 w-4" />
                ASSEMBLY/CONTIGS
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Input File Section */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                Input File
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="text-muted-foreground h-4 w-4" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="w-64">Select input files for analysis</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs defaultValue="paired">
              <TabsList className="w-full">
                <TabsTrigger value="paired" className="flex-1">
                  PAIRED READ LIBRARY
                </TabsTrigger>
                <TabsTrigger value="single" className="flex-1">
                  SINGLE READ LIBRARY
                </TabsTrigger>
                <TabsTrigger value="sra" className="flex-1">
                  SRA RUN ACCESSION
                </TabsTrigger>
              </TabsList>

              <TabsContent value="paired" className="mt-4 space-y-3">
                {selectedFiles.length > 0 ? (
                  selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input value={file} readOnly className="flex-1" />
                      <Select>
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Select a platform..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="illumina">Illumina</SelectItem>
                          <SelectItem value="nanopore">Nanopore</SelectItem>
                          <SelectItem value="pacbio">PacBio</SelectItem>
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
                  ))
                ) : (
                  <div className="rounded-md border border-dashed p-6 text-center">
                    <p className="text-muted-foreground text-sm">
                      No files selected
                    </p>
                    <Button
                      variant="outline"
                      className="mt-2"
                      onClick={addFile}
                    >
                      Add File
                    </Button>
                  </div>
                )}

                {selectedFiles.length > 0 && (
                  <Button variant="outline" className="mt-2" onClick={addFile}>
                    Add Another File
                  </Button>
                )}
              </TabsContent>

              <TabsContent value="single" className="mt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Input placeholder="READ FILE" className="flex-1" />
                  <Select>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Select a platform..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="illumina">Illumina</SelectItem>
                      <SelectItem value="nanopore">Nanopore</SelectItem>
                      <SelectItem value="pacbio">PacBio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              <TabsContent value="sra" className="mt-4">
                <Input placeholder="SRA" className="w-full" />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Selected Libraries Section */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                Selected Libraries
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="text-muted-foreground h-4 w-4" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="w-64">
                        Place read files here using the arrow buttons
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex h-48 items-center justify-center rounded-md border border-dashed p-8">
              <p className="text-muted-foreground text-sm">
                No libraries selected
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Parameters Section */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                Parameters
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="text-muted-foreground h-4 w-4" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="w-64">Configure analysis parameters</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-muted-foreground text-sm font-medium">
                  STRATEGY
                </label>
                <Select defaultValue="codex">
                  <SelectTrigger>
                    <SelectValue placeholder="Select a strategy" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="codex">One Codex</SelectItem>
                    <SelectItem value="other">Other Strategy</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-muted-foreground text-sm font-medium">
                  VERSION
                </label>
                <Select defaultValue="v5.3.2">
                  <SelectTrigger>
                    <SelectValue placeholder="Select version" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="v5.3.2">V5.3.2</SelectItem>
                    <SelectItem value="v5.2.0">V5.2.0</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-muted-foreground text-sm font-medium">
                  PRIMER
                </label>
                <Select defaultValue="artic">
                  <SelectTrigger>
                    <SelectValue placeholder="Select primer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="artic">ARTIC</SelectItem>
                    <SelectItem value="other">Other Primer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <label className="text-muted-foreground text-sm font-medium">
                    TAXONOMY NAME
                  </label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <HelpCircle className="text-muted-foreground h-4 w-4" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="w-64">Select the taxonomy name</p>
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
                    <SelectItem value="other">Other Taxonomy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <label className="text-muted-foreground text-sm font-medium">
                    TAXONOMY ID
                  </label>
                </div>
                <Select defaultValue="2697049">
                  <SelectTrigger>
                    <SelectValue placeholder="Select taxonomy ID" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2697049">2697049</SelectItem>
                    <SelectItem value="other">Other ID</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-muted-foreground text-sm font-medium">
                  MY LABEL
                </label>
                <Input placeholder="My identifier123" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-muted-foreground text-sm font-medium">
                  OUTPUT FOLDER
                </label>
                <Input placeholder="/output/path" />
              </div>

              <div className="space-y-2">
                <label className="text-muted-foreground text-sm font-medium">
                  OUTPUT NAME
                </label>
                <Input placeholder="Taxonomy + My Label" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="mt-8 flex justify-end gap-4">
        <Button variant="outline">Reset</Button>
        <Button>Submit</Button>
      </div>
    </div>
  );
}
