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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Info,
  FileDown,
  ArrowLeftRight,
  Dna,
  Copy,
  MousePointerClick,
  FileText,
} from "lucide-react";

const PrimerDesignInterface = () => {
  const [sequenceInputMethod, setSequenceInputMethod] = useState("paste");

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-indigo-800">
          Primer Design
        </h1>
        <div className="mb-4 flex items-center space-x-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-5 w-5 text-gray-500" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-md">Design primers for PCR amplification</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <a href="#" className="text-indigo-600 hover:text-indigo-800">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
              <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
            </svg>
          </a>
          <a href="#" className="text-indigo-600 hover:text-indigo-800">
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
            </svg>
          </a>
        </div>
        <p className="max-w-4xl text-gray-600">
          The Primer Design Service utilizes Primer3 to design primers from a
          given input sequence under a variety of temperature, size, and
          concentration constraints. For further explanation, please see the
          Primer Design Service
          <a href="#" className="mx-1 text-indigo-600 hover:text-indigo-800">
            Quick Reference Guide
          </a>
          ,
          <a href="#" className="ml-1 text-indigo-600 hover:text-indigo-800">
            Tutorial
          </a>{" "}
          and
          <a href="#" className="ml-1 text-indigo-600 hover:text-indigo-800">
            Instructional Video
          </a>
          .
        </p>
      </div>

      <form className="mx-auto max-w-4xl space-y-6">
        {/* Input Sequence Section */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center">
              <CardTitle className="text-lg">Input Sequence</CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger className="ml-2">
                    <Info className="h-4 w-4 text-gray-500" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-md">
                      Enter your DNA sequence to design primers
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Input Method Tabs */}
            <Tabs
              defaultValue="paste"
              value={sequenceInputMethod}
              onValueChange={setSequenceInputMethod}
              className="w-full"
            >
              <TabsList className="mb-4 grid w-full grid-cols-2">
                <TabsTrigger value="paste">PASTE SEQUENCE</TabsTrigger>
                <TabsTrigger value="workspace">WORKSPACE FASTA</TabsTrigger>
              </TabsList>

              {/* Sequence Identifier */}
              <div className="mb-4 space-y-2">
                <Label className="font-medium text-gray-700">
                  SEQUENCE IDENTIFIER
                </Label>
                <Input placeholder="Identifier for input sequence" />
              </div>

              {/* Paste Sequence Content */}
              <TabsContent value="paste" className="mt-0">
                <div className="space-y-2">
                  <Label className="font-medium text-gray-700">
                    PASTE SEQUENCE
                  </Label>
                  <Textarea
                    placeholder="Enter nucleotide sequence"
                    className="min-h-32 font-mono text-sm"
                  />
                </div>
              </TabsContent>

              {/* Workspace FASTA Content */}
              <TabsContent value="workspace" className="mt-0">
                <div className="space-y-2">
                  <Label className="font-medium text-gray-700">
                    SELECT WORKSPACE FASTA
                  </Label>
                  <div className="flex space-x-2">
                    <Input
                      placeholder="Select a FASTA file from workspace"
                      className="flex-1"
                    />
                    <Button variant="outline" type="button">
                      Browse
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Mark Selected Region */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <Label className="font-medium text-gray-700">
                  MARK SELECTED REGION
                </Label>
                <div className="flex space-x-1">
                  <Button variant="outline" size="sm" className="h-8 px-2">
                    <ArrowLeftRight className="mr-1 h-4 w-4" />
                    <span>&lt;&gt;</span>
                  </Button>
                  <div className="flex space-x-1">
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                      <span>[</span>
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                      <span>]</span>
                    </Button>
                  </div>
                  <Button variant="outline" size="sm" className="h-8">
                    clear
                  </Button>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox id="pick_internal" />
                <Label htmlFor="pick_internal" className="text-sm">
                  PICK INTERNAL OLIGO
                </Label>
              </div>
            </div>

            {/* Product Size Range */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center">
                <Label className="font-medium text-gray-700">
                  PRODUCT SIZE RANGE (BP)
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="ml-2">
                      <Info className="h-4 w-4 text-gray-500" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Desired size range of PCR product</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input defaultValue="50-200" />
            </div>

            {/* Primer Size */}
            <div className="space-y-2">
              <div className="flex items-center">
                <Label className="font-medium text-gray-700">
                  PRIMER SIZE (BP)
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="ml-2">
                      <Info className="h-4 w-4 text-gray-500" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Desired length range for primers</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">MIN</Label>
                  <Input defaultValue="18" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">OPT</Label>
                  <Input defaultValue="20" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">MAX</Label>
                  <Input defaultValue="27" />
                </div>
              </div>
            </div>

            {/* Excluded Regions */}
            <div className="space-y-2">
              <div className="flex items-center">
                <Label className="font-medium text-gray-700">
                  EXCLUDED REGIONS
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="ml-2">
                      <Info className="h-4 w-4 text-gray-500" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Regions to avoid when designing primers</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input placeholder="e.g. {0,7,60;} forbids primers in the 7 bases starting at 401 and the 3 bases at 60." />
            </div>

            {/* Target Region */}
            <div className="space-y-2">
              <div className="flex items-center">
                <Label className="font-medium text-gray-700">
                  TARGET REGION
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="ml-2">
                      <Info className="h-4 w-4 text-gray-500" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Regions that must be included in the PCR product</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input placeholder="e.g. {50,2} requires primers to surround the 2 bases at positions 50 and 51." />
            </div>

            {/* Included Regions */}
            <div className="space-y-2">
              <div className="flex items-center">
                <Label className="font-medium text-gray-700">
                  INCLUDED REGIONS
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="ml-2">
                      <Info className="h-4 w-4 text-gray-500" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Regions where primers must be selected</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input placeholder="e.g. {20,400} only pick primers in the 400 base region starting at position 20." />
            </div>

            {/* Primer Overlap Positions */}
            <div className="space-y-2">
              <Label className="font-medium text-gray-700">
                PRIMER OVERLAP POSITIONS
              </Label>
              <Input placeholder="Space-separated list of positions. The forward OR reverse primer will overlap one." />
            </div>
          </CardContent>
        </Card>

        {/* Advanced Options */}
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="advanced">
            <AccordionTrigger className="rounded-md bg-gray-100 px-4 py-3 text-lg font-semibold">
              ADVANCED OPTIONS
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              <Card>
                <CardContent className="space-y-4 pt-6">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="font-medium text-gray-700">
                        PRIMER Tm (°C)
                      </Label>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-500">MIN</Label>
                          <Input defaultValue="57" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-500">OPT</Label>
                          <Input defaultValue="60" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-500">MAX</Label>
                          <Input defaultValue="63" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="font-medium text-gray-700">
                        PRIMER GC%
                      </Label>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-500">MIN</Label>
                          <Input defaultValue="40" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-500">OPT</Label>
                          <Input defaultValue="50" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-500">MAX</Label>
                          <Input defaultValue="60" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="font-medium text-gray-700">
                        MAX POLY-X
                      </Label>
                      <Input defaultValue="4" />
                      <p className="text-xs text-gray-500">
                        Maximum length of mononucleotide repeat (e.g. AAAA)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="font-medium text-gray-700">
                        MAX SELF COMPLEMENTARITY
                      </Label>
                      <Input defaultValue="8" />
                      <p className="text-xs text-gray-500">
                        Maximum alignment score for self-complementarity
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Output Section */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center">
              <CardTitle className="text-lg">Output</CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger className="ml-2">
                    <Info className="h-4 w-4 text-gray-500" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-md">Configure output settings</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="font-medium text-gray-700">OUTPUT FOLDER</Label>
              <div className="flex items-center">
                <Input placeholder="Select output folder" className="flex-1" />
                <Button variant="outline" className="ml-2" size="icon">
                  <FileDown className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-medium text-gray-700">OUTPUT NAME</Label>
              <Input placeholder="Output Name" />
            </div>
          </CardContent>
        </Card>

        {/* Submit Buttons */}
        <div className="flex justify-center space-x-4 pt-4">
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
      </form>
    </div>
  );
};

export default PrimerDesignInterface;
