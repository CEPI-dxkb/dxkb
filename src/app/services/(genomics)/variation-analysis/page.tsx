"use client";

import { useState } from "react";
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
  FileDown,
  Search,
  Plus,
  ArrowRight,
  CircleX,
  ExternalLink,
  FileText,
  Dna,
} from "lucide-react";

interface Library {
  id: string;
  type: "paired" | "single" | "sra";
  name: string;
}

const VariationAnalysisInterface = () => {
  const [selectedLibraries, setSelectedLibraries] = useState<Library[]>([]);

  const addLibrary = (type: Library["type"], name?: string) => {
    const newLibrary: Library = {
      id: `lib_${selectedLibraries.length + 1}`,
      type,
      name: name || `Sample_${Math.floor(Math.random() * 9000) + 1000}.fastq`,
    };

    setSelectedLibraries([...selectedLibraries, newLibrary]);
  };

  const removeLibrary = (id: string) => {
    setSelectedLibraries(selectedLibraries.filter((lib) => lib.id !== id));
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-indigo-800">
          Variation Analysis
        </h1>
        <div className="mb-4 flex items-center space-x-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-5 w-5 text-gray-500" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-md">
                  Identify and annotate sequence variations
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <a href="#" className="text-indigo-600 hover:text-indigo-800">
            <ExternalLink className="h-5 w-5" />
          </a>
        </div>
        <p className="max-w-4xl text-gray-600">
          The Variation Analysis Service can be used to identify and annotate
          sequence variations. For further explanation, please see the Variation
          Analysis Service
          <a href="#" className="mx-1 text-indigo-600 hover:text-indigo-800">
            Quick Reference Guide
          </a>{" "}
          and
          <a href="#" className="ml-1 text-indigo-600 hover:text-indigo-800">
            Tutorial
          </a>
          .
        </p>
      </div>

      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-2">
        {/* Input File Section */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center">
              <CardTitle className="text-lg">Input File</CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger className="ml-2">
                    <Info className="h-4 w-4 text-gray-500" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-md">Select input files for analysis</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Paired Read Library */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-medium text-gray-700">
                  PAIRED READ LIBRARY
                </Label>
                <CircleX className="h-4 w-4 text-gray-400" />
              </div>
              <div className="flex space-x-2">
                <Input placeholder="READ FILE 1" className="flex-1" />
                <Button variant="outline" className="ml-2" size="icon">
                  <FileDown className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex space-x-2">
                <Input placeholder="READ FILE 2" className="flex-1" />
                <Button variant="outline" className="ml-2" size="icon">
                  <FileDown className="h-4 w-4" />
                </Button>
                <Button
                  onClick={() => addLibrary("paired", "Paired_Sample.fastq")}
                  variant="outline"
                  className="ml-2"
                  size="icon"
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Separator />

            {/* Single Read Library */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-medium text-gray-700">
                  SINGLE READ LIBRARY
                </Label>
                <CircleX className="h-4 w-4 text-gray-400" />
              </div>
              <div className="flex space-x-2">
                <Input placeholder="READ FILE" className="flex-1" />
                <Button variant="outline" className="ml-2" size="icon">
                  <FileDown className="h-4 w-4" />
                </Button>
                <Button
                  onClick={() => addLibrary("single", "Single_Sample.fastq")}
                  variant="outline"
                  className="ml-2"
                  size="icon"
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Separator />

            {/* SRA Run Accession */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-medium text-gray-700">
                  SRA RUN ACCESSION
                </Label>
                <CircleX className="h-4 w-4 text-gray-400" />
              </div>
              <div className="flex space-x-2">
                <Input placeholder="SRR" className="flex-1" />
                <Button
                  onClick={() => addLibrary("sra", "SRR1234567")}
                  variant="outline"
                  className="ml-2"
                  size="icon"
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Selected Libraries Section */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center">
              <CardTitle className="text-lg">Selected Libraries</CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger className="ml-2">
                    <Info className="h-4 w-4 text-gray-500" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-md">Files selected for analysis</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <CardDescription>
              Place read files here using the arrow buttons.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-56 overflow-auto rounded-md border">
              {selectedLibraries.length === 0 ? (
                <div className="flex h-full items-center justify-center text-gray-400 italic">
                  No libraries selected
                </div>
              ) : (
                <div className="divide-y">
                  {selectedLibraries.map((lib) => (
                    <div
                      key={lib.id}
                      className="flex items-center justify-between p-2"
                    >
                      <div className="flex items-center">
                        <FileText className="mr-2 h-4 w-4 text-gray-500" />
                        <span className="text-sm">{lib.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                        onClick={() => removeLibrary(lib.id)}
                      >
                        <CircleX className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Parameters Section */}
      <Card className="mx-auto mt-6 max-w-5xl">
        <CardHeader className="pb-2">
          <div className="flex items-center">
            <CardTitle className="text-lg">Parameters</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger className="ml-2">
                  <Info className="h-4 w-4 text-gray-500" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-md">
                    Configure variation analysis parameters
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="font-medium text-gray-700">TARGET GENOME</Label>
              <div className="relative">
                <Input
                  placeholder="e.g. Mycobacterium tuberculosis H37Rv"
                  className="pl-9"
                />
                <Dna className="absolute top-2.5 left-3 h-4 w-4 text-gray-400" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-medium text-gray-700">ALIGNER</Label>
              <Select defaultValue="bwa-mem">
                <SelectTrigger>
                  <SelectValue placeholder="Select aligner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bwa-mem">BWA-mem</SelectItem>
                  <SelectItem value="bowtie2">Bowtie2</SelectItem>
                  <SelectItem value="hisat2">HISAT2</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="font-medium text-gray-700">SNP CALLER</Label>
              <Select defaultValue="freebayes">
                <SelectTrigger>
                  <SelectValue placeholder="Select SNP caller" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="freebayes">FreeBayes</SelectItem>
                  <SelectItem value="gatk">GATK</SelectItem>
                  <SelectItem value="samtools">Samtools</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="font-medium text-gray-700">OUTPUT FOLDER</Label>
              <div className="flex space-x-2">
                <Input placeholder="Select output folder" className="flex-1" />
                <Button variant="outline" className="ml-2" size="icon">
                  <FileDown className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="font-medium text-gray-700">OUTPUT NAME</Label>
            <Input placeholder="Output Name" />
          </div>
        </CardContent>
      </Card>

      {/* Submit Buttons */}
      <div className="mx-auto flex max-w-5xl justify-center space-x-4 pt-8">
        <Button variant="outline" type="reset">
          Reset
        </Button>
        <Button
          type="submit"
          className="bg-indigo-600 text-white hover:bg-indigo-700"
        >
          Submit
        </Button>
      </div>
    </div>
  );
};

export default VariationAnalysisInterface;
