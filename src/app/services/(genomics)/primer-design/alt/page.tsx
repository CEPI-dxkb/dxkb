"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  FileDown,
  Dna,
  Copy,
  MousePointerClick,
  FileText,
  Atom,
  Sparkles,
  Settings,
  ArrowRight,
  ChevronsUpDown,
  Brackets,
  ChevronRight,
  Thermometer,
  AlignLeft,
  FolderOutput,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";

const CreativePrimerDesign = () => {
  const [designStep, setDesignStep] = useState(1);
  const [sequenceInputMethod, setSequenceInputMethod] = useState("paste");

  const nextStep = () => {
    setDesignStep((prev) => Math.min(prev + 1, 3));
  };

  const prevStep = () => {
    setDesignStep((prev) => Math.max(prev - 1, 1));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 py-8">
      {/* Header with DNA Animation */}
      <div className="relative mx-auto mb-12 max-w-5xl px-4">
        <div className="absolute top-0 left-0 h-32 w-full overflow-hidden opacity-10">
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 800 100"
            preserveAspectRatio="none"
          >
            <path
              d="M0,50 Q200,20 400,50 T800,50"
              stroke="blue"
              strokeWidth="4"
              fill="none"
            />
            <path
              d="M0,50 Q200,80 400,50 T800,50"
              stroke="blue"
              strokeWidth="4"
              fill="none"
            />
            <circle cx="50" cy="20" r="3" fill="blue" />
            <circle cx="150" cy="80" r="3" fill="blue" />
            <circle cx="250" cy="20" r="3" fill="blue" />
            <circle cx="350" cy="80" r="3" fill="blue" />
            <circle cx="450" cy="20" r="3" fill="blue" />
            <circle cx="550" cy="80" r="3" fill="blue" />
            <circle cx="650" cy="20" r="3" fill="blue" />
            <circle cx="750" cy="80" r="3" fill="blue" />
          </svg>
        </div>

        <div className="relative z-10 text-center">
          <div className="mb-2 flex items-center justify-center">
            <Atom className="mr-2 h-8 w-8 text-indigo-600" />
            <h1 className="text-4xl font-bold text-indigo-800">
              Primer Design Studio
            </h1>
          </div>
          <p className="mx-auto max-w-3xl text-lg text-indigo-600">
            Design optimal PCR primers with our intelligent Primer3-based tool
          </p>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Badge
              variant="outline"
              className="border-indigo-200 bg-white/80 text-indigo-700"
            >
              <Sparkles className="mr-1 h-3 w-3" />
              Powered by Primer3
            </Badge>
            <Badge
              variant="outline"
              className="border-indigo-200 bg-white/80 text-indigo-700"
            >
              <Dna className="mr-1 h-3 w-3" />
              PCR Optimized
            </Badge>
            <Badge
              variant="outline"
              className="border-indigo-200 bg-white/80 text-indigo-700"
            >
              <FileText className="mr-1 h-3 w-3" />
              Documentation
            </Badge>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mx-auto mb-8 max-w-5xl px-4">
        <div className="mb-2 h-2 rounded-full bg-white">
          <div
            className="h-2 rounded-full bg-indigo-600 transition-all duration-500"
            style={{ width: `${(designStep / 3) * 100}%` }}
          ></div>
        </div>
        <div className="flex justify-between">
          <div
            className={`flex flex-col items-center ${designStep >= 1 ? "text-indigo-600" : "text-gray-400"}`}
          >
            <div
              className={`mb-1 flex h-8 w-8 items-center justify-center rounded-full ${designStep >= 1 ? "bg-indigo-600 text-white" : "bg-gray-200"}`}
            >
              <Dna className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium">Sequence</span>
          </div>
          <div
            className={`flex flex-col items-center ${designStep >= 2 ? "text-indigo-600" : "text-gray-400"}`}
          >
            <div
              className={`mb-1 flex h-8 w-8 items-center justify-center rounded-full ${designStep >= 2 ? "bg-indigo-600 text-white" : "bg-gray-200"}`}
            >
              <Settings className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium">Parameters</span>
          </div>
          <div
            className={`flex flex-col items-center ${designStep >= 3 ? "text-indigo-600" : "text-gray-400"}`}
          >
            <div
              className={`mb-1 flex h-8 w-8 items-center justify-center rounded-full ${designStep >= 3 ? "bg-indigo-600 text-white" : "bg-gray-200"}`}
            >
              <FolderOutput className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium">Output</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="mx-auto max-w-5xl px-4">
        <div className="overflow-hidden rounded-xl bg-white shadow-xl">
          {/* Step 1: Sequence Input */}
          {designStep === 1 && (
            <div className="p-6">
              <h2 className="mb-6 flex items-center text-2xl font-bold text-indigo-800">
                <Dna className="mr-2 h-6 w-6 text-indigo-600" />
                Input Sequence
              </h2>

              <div className="mb-8">
                <Tabs
                  defaultValue="paste"
                  value={sequenceInputMethod}
                  onValueChange={setSequenceInputMethod}
                  className="w-full"
                >
                  <TabsList className="mb-4 grid w-full grid-cols-2 bg-indigo-100">
                    <TabsTrigger
                      value="paste"
                      className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Paste Sequence
                    </TabsTrigger>
                    <TabsTrigger
                      value="workspace"
                      className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Workspace FASTA
                    </TabsTrigger>
                  </TabsList>

                  <div className="mb-6 space-y-4">
                    <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4">
                      <Label className="mb-2 block font-medium text-indigo-800">
                        SEQUENCE IDENTIFIER
                      </Label>
                      <Input
                        placeholder="Enter a name for this sequence"
                        className="border-indigo-200 focus:border-indigo-400"
                      />
                    </div>

                    <TabsContent
                      value="paste"
                      className="mt-0 rounded-lg border border-indigo-100 bg-indigo-50 p-4"
                    >
                      <Label className="mb-2 block font-medium text-indigo-800">
                        PASTE DNA SEQUENCE
                      </Label>
                      <Textarea
                        placeholder="Enter nucleotide sequence (A, T, G, C)"
                        className="h-40 resize-none border-indigo-200 bg-white font-mono text-sm focus:border-indigo-400"
                      />
                    </TabsContent>

                    <TabsContent
                      value="workspace"
                      className="mt-0 rounded-lg border border-indigo-100 bg-indigo-50 p-4"
                    >
                      <Label className="mb-2 block font-medium text-indigo-800">
                        SELECT WORKSPACE FASTA
                      </Label>
                      <div className="flex space-x-2">
                        <Input
                          placeholder="Select a FASTA file from workspace"
                          className="flex-1 border-indigo-200 focus:border-indigo-400"
                        />
                        <Button
                          variant="outline"
                          className="border-indigo-300 text-indigo-800"
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          Browse
                        </Button>
                      </div>
                    </TabsContent>
                  </div>
                </Tabs>
              </div>

              <div className="mb-6 rounded-lg border border-blue-100 bg-blue-50 p-4">
                <h3 className="mb-2 flex items-center font-medium text-blue-800">
                  <Brackets className="mr-1 h-4 w-4" />
                  REGION SELECTION
                </h3>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-blue-800">
                        Mark Selected Region
                      </Label>
                      <div className="flex space-x-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 border-blue-300 px-2 text-blue-700"
                        >
                          <ChevronsUpDown className="mr-1 h-3 w-3" />
                          <span>&lt;&gt;</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 border-blue-300 p-0 text-blue-700"
                        >
                          <span>[</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 border-blue-300 p-0 text-blue-700"
                        >
                          <span>]</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 border-blue-300 text-blue-700"
                        >
                          clear
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="pick_internal"
                        className="text-indigo-600"
                      />
                      <Label htmlFor="pick_internal" className="text-sm">
                        Pick internal oligo
                      </Label>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center">
                      <Label className="text-sm text-blue-800">
                        Product Size Range (bp)
                      </Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger className="ml-2">
                            <Info className="h-4 w-4 text-blue-500" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Desired size range of PCR product</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Input
                      defaultValue="50-200"
                      className="border-blue-200 focus:border-blue-400"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <Button
                  onClick={nextStep}
                  className="bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  Continue to Parameters
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Parameters */}
          {designStep === 2 && (
            <div className="p-6">
              <h2 className="mb-6 flex items-center text-2xl font-bold text-indigo-800">
                <Settings className="mr-2 h-6 w-6 text-indigo-600" />
                Primer Parameters
              </h2>

              <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Primer Size */}
                <div className="rounded-lg border border-purple-100 bg-purple-50 p-4">
                  <div className="mb-3 flex items-center">
                    <AlignLeft className="mr-2 h-4 w-4 text-purple-700" />
                    <h3 className="font-medium text-purple-800">
                      PRIMER SIZE (bp)
                    </h3>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="ml-2">
                          <Info className="h-4 w-4 text-purple-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Desired length range for primers</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-purple-800">
                          MINIMUM
                        </Label>
                        <span className="text-sm font-medium text-purple-700">
                          18 bp
                        </span>
                      </div>
                      <Slider
                        defaultValue={[18]}
                        max={30}
                        min={15}
                        step={1}
                        className="[&>span]:bg-purple-600"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-purple-800">
                          OPTIMAL
                        </Label>
                        <span className="text-sm font-medium text-purple-700">
                          20 bp
                        </span>
                      </div>
                      <Slider
                        defaultValue={[20]}
                        max={30}
                        min={15}
                        step={1}
                        className="[&>span]:bg-purple-600"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-purple-800">
                          MAXIMUM
                        </Label>
                        <span className="text-sm font-medium text-purple-700">
                          27 bp
                        </span>
                      </div>
                      <Slider
                        defaultValue={[27]}
                        max={35}
                        min={20}
                        step={1}
                        className="[&>span]:bg-purple-600"
                      />
                    </div>
                  </div>
                </div>

                {/* Temperature */}
                <div className="rounded-lg border border-amber-100 bg-amber-50 p-4">
                  <div className="mb-3 flex items-center">
                    <Thermometer className="mr-2 h-4 w-4 text-amber-700" />
                    <h3 className="font-medium text-amber-800">
                      PRIMER Tm (°C)
                    </h3>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="ml-2">
                          <Info className="h-4 w-4 text-amber-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Melting temperature for primers</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-amber-800">
                          MINIMUM
                        </Label>
                        <span className="text-sm font-medium text-amber-700">
                          57 °C
                        </span>
                      </div>
                      <Slider
                        defaultValue={[57]}
                        max={65}
                        min={50}
                        step={1}
                        className="[&>span]:bg-amber-600"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-amber-800">
                          OPTIMAL
                        </Label>
                        <span className="text-sm font-medium text-amber-700">
                          60 °C
                        </span>
                      </div>
                      <Slider
                        defaultValue={[60]}
                        max={65}
                        min={50}
                        step={1}
                        className="[&>span]:bg-amber-600"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-amber-800">
                          MAXIMUM
                        </Label>
                        <span className="text-sm font-medium text-amber-700">
                          63 °C
                        </span>
                      </div>
                      <Slider
                        defaultValue={[63]}
                        max={70}
                        min={55}
                        step={1}
                        className="[&>span]:bg-amber-600"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Target Region */}
                <div className="rounded-lg border border-teal-100 bg-teal-50 p-4">
                  <h3 className="mb-2 font-medium text-teal-800">
                    TARGET REGION
                  </h3>
                  <p className="mb-2 text-xs text-teal-600">
                    Specify regions that must be included in the PCR product
                  </p>
                  <Input
                    placeholder="e.g. {50,2} requires primers to surround the 2 bases at positions 50 and 51"
                    className="border-teal-200 focus:border-teal-400"
                  />
                </div>

                {/* Excluded Regions */}
                <div className="rounded-lg border border-rose-100 bg-rose-50 p-4">
                  <h3 className="mb-2 font-medium text-rose-800">
                    EXCLUDED REGIONS
                  </h3>
                  <p className="mb-2 text-xs text-rose-600">
                    Specify regions to avoid when designing primers
                  </p>
                  <Input
                    placeholder="e.g. {0,7,60;} forbids primers in the 7 bases starting at 401 and the 3 bases at 60"
                    className="border-rose-200 focus:border-rose-400"
                  />
                </div>
              </div>

              <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Included Regions */}
                <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
                  <h3 className="mb-2 font-medium text-emerald-800">
                    INCLUDED REGIONS
                  </h3>
                  <p className="mb-2 text-xs text-emerald-600">
                    Specify regions where primers must be selected
                  </p>
                  <Input
                    placeholder="e.g. {20,400} only pick primers in the 400 base region starting at position 20"
                    className="border-emerald-200 focus:border-emerald-400"
                  />
                </div>

                {/* Overlap Positions */}
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                  <h3 className="mb-2 font-medium text-blue-800">
                    PRIMER OVERLAP POSITIONS
                  </h3>
                  <p className="mb-2 text-xs text-blue-600">
                    Space-separated list of positions for primer overlap
                  </p>
                  <Input
                    placeholder="e.g. 42 67 89"
                    className="border-blue-200 focus:border-blue-400"
                  />
                </div>
              </div>

              <div className="mt-8 flex justify-between">
                <Button
                  onClick={prevStep}
                  variant="outline"
                  className="border-indigo-300 text-indigo-800"
                >
                  Back to Sequence
                </Button>
                <Button
                  onClick={nextStep}
                  className="bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  Continue to Output
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Output */}
          {designStep === 3 && (
            <div className="p-6">
              <h2 className="mb-6 flex items-center text-2xl font-bold text-indigo-800">
                <FolderOutput className="mr-2 h-6 w-6 text-indigo-600" />
                Output Configuration
              </h2>

              <div className="mb-8 rounded-lg border border-indigo-100 bg-gradient-to-r from-indigo-50 to-blue-50 p-6">
                <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                  <div className="space-y-4">
                    <h3 className="font-medium text-indigo-800">
                      Output Settings
                    </h3>

                    <div className="space-y-2">
                      <Label className="text-gray-700">OUTPUT FOLDER</Label>
                      <div className="flex items-center">
                        <Input
                          placeholder="Select destination folder"
                          className="flex-1 border-indigo-200 focus:border-indigo-400"
                        />
                        <Button
                          variant="outline"
                          className="ml-2 border-indigo-300 text-indigo-800"
                        >
                          <FileDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-gray-700">OUTPUT NAME</Label>
                      <Input
                        placeholder="Enter a name for results"
                        className="border-indigo-200 focus:border-indigo-400"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-gray-700">OUTPUT FORMAT</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="txt_format"
                            className="text-indigo-600"
                            defaultChecked
                          />
                          <Label htmlFor="txt_format" className="text-sm">
                            Text Report
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="csv_format"
                            className="text-indigo-600"
                            defaultChecked
                          />
                          <Label htmlFor="csv_format" className="text-sm">
                            CSV Table
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="fasta_format"
                            className="text-indigo-600"
                          />
                          <Label htmlFor="fasta_format" className="text-sm">
                            FASTA File
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="json_format"
                            className="text-indigo-600"
                          />
                          <Label htmlFor="json_format" className="text-sm">
                            JSON Data
                          </Label>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-indigo-100 bg-white p-4 shadow-inner">
                    <h3 className="mb-3 font-medium text-indigo-800">
                      Analysis Summary
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between border-b border-dashed border-indigo-100 pb-2">
                        <span className="text-gray-600">Input Method:</span>
                        <span className="font-medium">
                          {sequenceInputMethod === "paste"
                            ? "Manual Sequence"
                            : "FASTA File"}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-dashed border-indigo-100 pb-2">
                        <span className="text-gray-600">
                          Target Product Size:
                        </span>
                        <span className="font-medium">50-200 bp</span>
                      </div>
                      <div className="flex justify-between border-b border-dashed border-indigo-100 pb-2">
                        <span className="text-gray-600">Primer Length:</span>
                        <span className="font-medium">18-27 bp</span>
                      </div>
                      <div className="flex justify-between border-b border-dashed border-indigo-100 pb-2">
                        <span className="text-gray-600">Optimal Tm:</span>
                        <span className="font-medium">60°C</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Internal Oligo:</span>
                        <span className="font-medium">Yes</span>
                      </div>
                    </div>

                    <div className="mt-4 border-t border-indigo-100 pt-4">
                      <div className="flex items-center text-indigo-600">
                        <Info className="mr-2 h-4 w-4" />
                        <p className="text-xs">
                          Primer3 will calculate the most optimal primer pairs
                          based on your specified parameters
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-between">
                <Button
                  onClick={prevStep}
                  variant="outline"
                  className="border-indigo-300 text-indigo-800"
                >
                  Back to Parameters
                </Button>
                <div className="space-x-3">
                  <Button
                    variant="outline"
                    className="border-red-300 text-red-800"
                    onClick={() => setDesignStep(1)}
                  >
                    Reset
                  </Button>
                  <Button
                    type="submit"
                    className="bg-indigo-600 text-white hover:bg-indigo-700"
                  >
                    Design Primers
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

export default CreativePrimerDesign;
