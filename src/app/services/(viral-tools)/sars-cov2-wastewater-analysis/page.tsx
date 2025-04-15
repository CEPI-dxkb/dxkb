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
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Info,
  Upload,
  FileText,
  ArrowRight,
  X,
  HelpCircle,
  Droplets,
  Link2,
} from "lucide-react";

export default function WastewaterAnalysis() {
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

  const moveFileToSelected = (file: string) => {
    // Implementation would move a file to the selected libraries section
  };

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      {/* Header Section */}
      <div className="mb-8 text-center">
        <div className="mb-2 flex items-center justify-center gap-2">
          <h1 className="text-2xl font-bold">SARS-CoV-2 Wastewater Analysis</h1>
          <div className="flex gap-1">
            <Badge variant="outline" className="bg-primary-50 text-primary-700">
              v5.3.2
            </Badge>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="bg-primary-50 text-primary-700 inline-flex h-6 w-6 items-center justify-center rounded-full">
                    <Info className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="w-64">Information about this service</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <a
              href="#"
              className="bg-primary-50 text-primary-700 inline-flex h-6 w-6 items-center justify-center rounded-full"
            >
              <Link2 className="h-4 w-4" />
            </a>
          </div>
        </div>
        <p className="text-muted-foreground mx-auto max-w-2xl text-sm">
          The SARS-CoV-2 Wastewater Analysis assembles raw reads with the Sara
          One Codex pipeline and performs variant analysis with Freyja. For
          further explanation, please see the
          <a href="#" className="text-primary-600 mx-1 hover:underline">
            SARS-CoV-2 Wastewater Analysis Service Quick Reference Guide
          </a>
          ,
          <a href="#" className="text-primary-600 mr-1 ml-1 hover:underline">
            Tutorial
          </a>
          and
          <a href="#" className="text-primary-600 ml-1 hover:underline">
            Instructional Video
          </a>
          .
        </p>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Input Library Section */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                Input Library Selection
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
            <div className="bg-muted flex items-start rounded-md p-3">
              <span className="text-muted-foreground text-xs font-medium uppercase">
                Send to Selected Libraries
              </span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="text-muted-foreground ml-2 h-4 w-4" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="w-64">
                      Files selected here will be sent to the Selected Libraries
                      section
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

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
                <div className="flex items-center gap-2">
                  <Input value="READ FILE 1" readOnly className="flex-1" />
                  <Button variant="ghost" size="icon" className="shrink-0">
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Input value="READ FILE 2" readOnly className="flex-1" />
                  <Button variant="ghost" size="icon" className="shrink-0">
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="single" className="mt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Input value="READ FILE" readOnly className="flex-1" />
                  <Button variant="ghost" size="icon" className="shrink-0">
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="sra" className="mt-4">
                <Input placeholder="SRA" className="w-full" />
              </TabsContent>
            </Tabs>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Primers</Label>
                <Label>Version</Label>
              </div>

              <div className="flex items-center gap-3">
                <Select defaultValue="artic">
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select primers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="artic">ARTIC</SelectItem>
                    <SelectItem value="other">Other Primers</SelectItem>
                  </SelectContent>
                </Select>

                <Select defaultValue="v5.3.2">
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Version" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="v5.3.2">V5.3.2</SelectItem>
                    <SelectItem value="v5.2.0">V5.2.0</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Sample Identifier</Label>
              <Input placeholder="SAMPLE ID" />
            </div>

            <div className="space-y-3">
              <Label>Sample Date</Label>
              <Input placeholder="MM/DD/YYYY" type="date" />
            </div>
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
            <div className="flex h-64 items-center justify-center rounded-md border border-dashed p-8">
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
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <Label>Strategy</Label>
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
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <Label>Output Folder</Label>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Select output folder"
                    className="flex-1"
                  />
                  <Button variant="outline" size="icon">
                    <FileText className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Output Name</Label>
                <Input placeholder="Output Name" />
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
