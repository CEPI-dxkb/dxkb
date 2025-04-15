"use client";

import { useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Info,
  Search,
  FileDown,
  Database,
  Dna,
  Upload,
  FileText,
  Microscope,
  ChevronRight,
  Settings,
  Tag,
  FolderOutput,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const CreativeGenomeAnnotation = () => {
  const [step, setStep] = useState(1);

  return (
    <div className="container mx-auto p-6">
      {/* Hero Section with DNA Double Helix Graphic Background */}
      <div className="relative mb-8 overflow-hidden rounded-xl bg-gradient-to-r from-purple-900 via-indigo-800 to-blue-900 text-white">
        <div className="absolute inset-0 opacity-20">
          {/* SVG DNA pattern - stylized for background */}
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <path
              d="M10,10 Q50,0 90,10 T90,30 T10,50 T90,70 T10,90"
              stroke="white"
              strokeWidth="2"
              fill="none"
            />
            <path
              d="M10,30 Q50,20 90,30 T90,50 T10,70 T90,90"
              stroke="white"
              strokeWidth="2"
              fill="none"
            />
            <circle cx="15" cy="10" r="1" fill="white" />
            <circle cx="85" cy="10" r="1" fill="white" />
            <circle cx="15" cy="30" r="1" fill="white" />
            <circle cx="85" cy="30" r="1" fill="white" />
            <circle cx="15" cy="50" r="1" fill="white" />
            <circle cx="85" cy="50" r="1" fill="white" />
            <circle cx="15" cy="70" r="1" fill="white" />
            <circle cx="85" cy="70" r="1" fill="white" />
            <circle cx="15" cy="90" r="1" fill="white" />
            <circle cx="85" cy="90" r="1" fill="white" />
          </svg>
        </div>

        <div className="relative z-10 p-8 md:p-12">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center">
                <h1 className="mb-2 text-3xl font-bold md:text-4xl">
                  Genome Annotation
                </h1>
                <Badge className="ml-3 bg-purple-500 text-white hover:bg-purple-600">
                  RASTtk
                </Badge>
                <Badge className="ml-2 bg-blue-500 text-white hover:bg-blue-600">
                  VirION
                </Badge>
              </div>
              <p className="mb-4 max-w-2xl text-lg opacity-90">
                Transform raw genomic sequences into feature-rich annotations
                with our advanced toolset
              </p>
            </div>
            <div className="hidden md:block">
              <Dna className="h-16 w-16" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-sm">
            <a
              href="#"
              className="inline-flex items-center rounded-full bg-white/20 px-3 py-1 transition-colors hover:bg-white/30"
            >
              <FileText className="mr-1 h-3 w-3" />
              Quick Guide
            </a>
            <a
              href="#"
              className="inline-flex items-center rounded-full bg-white/20 px-3 py-1 transition-colors hover:bg-white/30"
            >
              <Microscope className="mr-1 h-3 w-3" />
              How It Works
            </a>
            <a
              href="#"
              className="inline-flex items-center rounded-full bg-white/20 px-3 py-1 transition-colors hover:bg-white/30"
            >
              <Info className="mr-1 h-3 w-3" />
              Tutorial
            </a>
          </div>
        </div>

        {/* Wave effect at the bottom */}
        <div className="absolute right-0 bottom-0 left-0">
          <svg
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
            className="h-6 w-full"
          >
            <path
              d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V120H0V0C50.56,0,72.03,36.76,119.31,42.77Z"
              className="fill-white"
            ></path>
          </svg>
        </div>
      </div>

      {/* Main Content - Multi-step Form */}
      <div className="mx-auto max-w-4xl">
        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="mb-2 flex justify-between">
            <div className="flex items-center">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full ${step >= 1 ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-600"}`}
              >
                1
              </span>
              <span className="ml-2 font-medium">Setup</span>
            </div>
            <div className="mx-4 mt-4 w-full border-t-2 border-gray-200"></div>
            <div className="flex items-center">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full ${step >= 2 ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-600"}`}
              >
                2
              </span>
              <span className="ml-2 font-medium">Taxonomy</span>
            </div>
            <div className="mx-4 mt-4 w-full border-t-2 border-gray-200"></div>
            <div className="flex items-center">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full ${step >= 3 ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-600"}`}
              >
                3
              </span>
              <span className="ml-2 font-medium">Output</span>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-100 bg-white shadow-xl">
          {/* Step 1: Upload and Recipe */}
          {step === 1 && (
            <div className="p-6">
              <h2 className="mb-6 text-2xl font-bold text-gray-800">
                Genome Configuration
              </h2>

              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                {/* Left Column - Contigs Upload */}
                <div className="space-y-4">
                  <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                    <div className="mb-2 flex items-center">
                      <Upload className="mr-2 h-5 w-5 text-blue-600" />
                      <h3 className="font-semibold text-blue-800">
                        Contigs Upload
                      </h3>
                    </div>

                    <div className="mt-4 rounded-lg border-2 border-dashed border-blue-200 p-6 text-center transition-colors hover:bg-blue-50">
                      <Input type="file" className="hidden" id="contigFile" />
                      <Label
                        htmlFor="contigFile"
                        className="block cursor-pointer text-blue-600 hover:text-blue-800"
                      >
                        <Dna className="mx-auto mb-2 h-8 w-8" />
                        <span className="mb-1 block font-medium">
                          Drop FASTA file here
                        </span>
                        <span className="text-sm text-gray-500">
                          or click to browse
                        </span>
                      </Label>
                    </div>

                    <div className="mt-4 text-sm text-gray-600">
                      <p>
                        Accepted formats:{" "}
                        <span className="font-medium">.fasta, .fa, .fna</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right Column - Annotation Recipe */}
                <div className="space-y-4">
                  <div className="rounded-lg border border-purple-100 bg-purple-50 p-4">
                    <div className="mb-4 flex items-center">
                      <Settings className="mr-2 h-5 w-5 text-purple-600" />
                      <h3 className="font-semibold text-purple-800">
                        Annotation Recipe
                      </h3>
                    </div>

                    <Tabs defaultValue="preset" className="w-full">
                      <TabsList className="mb-4 grid w-full grid-cols-2">
                        <TabsTrigger value="preset">Preset Recipes</TabsTrigger>
                        <TabsTrigger value="custom">Custom Recipe</TabsTrigger>
                      </TabsList>
                      <TabsContent value="preset" className="mt-0">
                        <div className="space-y-4">
                          <div className="relative">
                            <Select>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select a recipe" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="bacteria">
                                  Bacteria Generic
                                </SelectItem>
                                <SelectItem value="archaea">
                                  Archaea Generic
                                </SelectItem>
                                <SelectItem value="virus">Virus</SelectItem>
                                <SelectItem value="bacteriophage">
                                  Bacteriophage
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger className="absolute top-2.5 right-10">
                                  <Info className="h-4 w-4 text-gray-400" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="w-80">
                                    Pre-configured annotation settings optimized
                                    for different organism types
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <div className="rounded border bg-white p-3">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-600">
                                Gene calling:
                              </span>
                              <span className="font-medium">GeneMarkS</span>
                            </div>
                            <div className="mt-2 flex items-center justify-between text-sm">
                              <span className="text-gray-600">
                                Annotation source:
                              </span>
                              <span className="font-medium">SEED</span>
                            </div>
                          </div>
                        </div>
                      </TabsContent>
                      <TabsContent value="custom">
                        <div className="space-y-3 text-gray-500">
                          <p className="text-sm italic">
                            Advanced option for custom annotation parameters
                          </p>
                          <Button variant="outline" className="w-full">
                            Configure Custom Recipe
                          </Button>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-between">
                <Button variant="outline" type="button" disabled>
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={() => setStep(2)}
                  className="bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  Continue to Taxonomy
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Taxonomy Information */}
          {step === 2 && (
            <div className="p-6">
              <h2 className="mb-6 text-2xl font-bold text-gray-800">
                Taxonomy Information
              </h2>

              <div className="mb-6 rounded-lg border border-green-100 bg-green-50 p-6">
                <div className="mb-4 flex items-start">
                  <Microscope className="mt-1 mr-2 h-5 w-5 text-green-600" />
                  <div>
                    <h3 className="font-semibold text-green-800">
                      Organism Classification
                    </h3>
                    <p className="mt-1 text-sm text-green-700">
                      Proper taxonomy ensures accurate gene calling and
                      annotation
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-3">
                    <Label className="block font-medium text-gray-700">
                      Taxonomy Name
                    </Label>
                    <div className="relative">
                      <Input
                        placeholder="e.g. Bacillus cereus"
                        className="pr-10"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="absolute top-1 right-1 h-8 w-8 text-gray-400 hover:text-gray-600"
                      >
                        <Search className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500">
                      Enter species name (genus + species)
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Label className="block font-medium text-gray-700">
                      NCBI Taxonomy ID
                    </Label>
                    <Input placeholder="e.g. 1396 (optional)" />
                    <p className="text-xs text-gray-500">
                      NCBI Taxonomy identifier (if known)
                    </p>
                  </div>
                </div>

                <div className="mt-6">
                  <Label className="mb-3 block font-medium text-gray-700">
                    My Label
                  </Label>
                  <div className="flex items-center">
                    <Tag className="absolute ml-3 h-5 w-5 text-gray-400" />
                    <Input
                      placeholder="My identifier (e.g. strain name, isolate ID)"
                      className="pl-10"
                    />
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    Personal identifier for this genome
                  </p>
                </div>
              </div>

              <div className="mt-8 flex justify-between">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setStep(1)}
                >
                  Back to Setup
                </Button>
                <Button
                  type="button"
                  onClick={() => setStep(3)}
                  className="bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  Continue to Output
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Output Configuration */}
          {step === 3 && (
            <div className="p-6">
              <h2 className="mb-6 text-2xl font-bold text-gray-800">
                Output Configuration
              </h2>

              <div className="mb-6 rounded-lg border border-amber-100 bg-amber-50 p-6">
                <div className="mb-4 flex items-start">
                  <FolderOutput className="mt-1 mr-2 h-5 w-5 text-amber-600" />
                  <div>
                    <h3 className="font-semibold text-amber-800">
                      Results Configuration
                    </h3>
                    <p className="mt-1 text-sm text-amber-700">
                      Specify how annotation results should be saved
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label className="block font-medium text-gray-700">
                      Output Name
                    </Label>
                    <Input defaultValue="Taxonomy + My Label" />
                    <p className="text-xs text-gray-500">
                      Name of the output annotation files
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Label className="block font-medium text-gray-700">
                      Output Folder
                    </Label>
                    <div className="flex">
                      <Input
                        placeholder="Select an output location"
                        className="flex-1"
                      />
                      <Button variant="outline" className="ml-2">
                        <FileDown className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500">
                      Folder where results will be saved
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Label className="block font-medium text-gray-700">
                      Output Format Options
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="gff"
                          className="rounded text-indigo-600"
                          defaultChecked
                        />
                        <Label htmlFor="gff" className="text-sm">
                          GFF3
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="genbank"
                          className="rounded text-indigo-600"
                          defaultChecked
                        />
                        <Label htmlFor="genbank" className="text-sm">
                          GenBank
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="protein"
                          className="rounded text-indigo-600"
                          defaultChecked
                        />
                        <Label htmlFor="protein" className="text-sm">
                          Protein FASTA
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="json"
                          className="rounded text-indigo-600"
                        />
                        <Label htmlFor="json" className="text-sm">
                          JSON
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-6 rounded-lg bg-gray-50 p-4">
                <h3 className="mb-2 font-medium text-gray-700">
                  Annotation Summary
                </h3>
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <div className="text-gray-600">Organism:</div>
                  <div className="font-medium">Not specified</div>
                  <div className="text-gray-600">Recipe:</div>
                  <div className="font-medium">Not selected</div>
                  <div className="text-gray-600">Input file:</div>
                  <div className="font-medium">No file selected</div>
                </div>
              </div>

              <div className="mt-8 flex justify-between">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setStep(2)}
                >
                  Back to Taxonomy
                </Button>
                <div className="space-x-3">
                  <Button variant="outline" type="reset">
                    Reset All
                  </Button>
                  <Button
                    type="submit"
                    className="bg-indigo-600 text-white hover:bg-indigo-700"
                  >
                    Start Annotation
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreativeGenomeAnnotation;
