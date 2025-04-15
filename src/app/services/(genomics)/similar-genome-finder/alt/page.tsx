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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Info,
  FileDown,
  Search,
  Dna,
  ExternalLink,
  Database,
  BarChart4,
  Zap,
  Fingerprint,
  Maximize2,
  ChevronRight,
  Sparkles,
  Microscope,
  Hash,
} from "lucide-react";

const CreativeGenomeFinder = () => {
  const [searchMode, setSearchMode] = useState("search");
  const [distance, setDistance] = useState([0.5]);
  const [maxHits, setMaxHits] = useState([50]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-teal-50 p-6">
      {/* Header Section with DNA Visualization */}
      <div className="relative mx-auto mb-10 max-w-5xl">
        <div className="absolute inset-0 flex justify-center opacity-10">
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 800 150"
            preserveAspectRatio="none"
          >
            <path
              d="M0,75 Q200,25 400,75 T800,75"
              stroke="teal"
              strokeWidth="6"
              fill="none"
            />
            <path
              d="M0,75 Q200,125 400,75 T800,75"
              stroke="teal"
              strokeWidth="6"
              fill="none"
            />
            {[...Array(8)].map((_, i) => (
              <g key={i}>
                <circle
                  cx={100 * i + 50}
                  cy={i % 2 ? 125 : 25}
                  r="5"
                  fill="teal"
                />
                <line
                  x1={100 * i + 50}
                  y1={i % 2 ? 125 : 25}
                  x2={100 * i + 50}
                  y2="75"
                  stroke="teal"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                />
              </g>
            ))}
          </svg>
        </div>

        <div className="relative z-10 pt-10 text-center">
          <div className="mb-4 inline-flex items-center justify-center">
            <Fingerprint className="mr-3 h-10 w-10 text-teal-600" />
            <h1 className="text-4xl font-bold text-gray-900">
              Genome Similarity Explorer
            </h1>
          </div>
          <p className="mx-auto mb-4 max-w-3xl text-lg text-gray-600">
            Discover genomes with matching genetic signatures using advanced
            Mash/MinHash distance algorithms
          </p>

          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <Badge
              variant="outline"
              className="border-teal-200 bg-white/80 px-3 py-1 text-teal-700"
            >
              <Zap className="mr-1 h-3 w-3" />
              Mash Algorithm
            </Badge>
            <Badge
              variant="outline"
              className="border-teal-200 bg-white/80 px-3 py-1 text-teal-700"
            >
              <Sparkles className="mr-1 h-3 w-3" />
              BV-BRC Database
            </Badge>
            <Badge
              variant="outline"
              className="border-teal-200 bg-white/80 px-3 py-1 text-teal-700"
            >
              <Microscope className="mr-1 h-3 w-3" />
              Research Grade
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="mx-auto max-w-5xl overflow-hidden rounded-xl bg-white shadow-xl">
        {/* Tabs for Search Modes */}
        <Tabs
          value={searchMode}
          onValueChange={setSearchMode}
          className="w-full"
        >
          <div className="border-b bg-gray-50 p-4">
            <TabsList className="grid h-12 w-full grid-cols-2">
              <TabsTrigger
                value="search"
                className="rounded-l-md data-[state=active]:bg-teal-600 data-[state=active]:text-white"
              >
                <Search className="mr-2 h-4 w-4" />
                Search by Name/ID
              </TabsTrigger>
              <TabsTrigger
                value="upload"
                className="rounded-r-md data-[state=active]:bg-teal-600 data-[state=active]:text-white"
              >
                <FileDown className="mr-2 h-4 w-4" />
                Upload FASTA/Reads
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="p-6">
            <TabsContent value="search" className="mt-0">
              <div className="mb-8">
                <h2 className="mb-4 flex items-center text-xl font-bold text-gray-800">
                  <Search className="mr-2 h-5 w-5 text-teal-600" />
                  Find Similar Genomes
                </h2>

                <div className="relative">
                  <Input
                    placeholder="Enter genome name or ID (e.g., Mycobacterium tuberculosis H37Rv)"
                    className="h-12 border-teal-200 pr-12 text-lg focus:border-teal-400 focus:ring-teal-300"
                  />
                  <Button
                    className="absolute top-1 right-1 h-10 w-10 bg-teal-600 p-0 hover:bg-teal-700"
                    size="icon"
                  >
                    <Search className="h-5 w-5" />
                  </Button>
                  <p className="mt-2 text-sm text-gray-500">
                    Start typing to search across all public genome repositories
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="upload" className="mt-0">
              <div className="mb-8">
                <h2 className="mb-4 flex items-center text-xl font-bold text-gray-800">
                  <FileDown className="mr-2 h-5 w-5 text-teal-600" />
                  Upload Your Sequence
                </h2>

                <div className="rounded-lg border-2 border-dashed border-teal-200 p-8 text-center transition-colors hover:bg-teal-50">
                  <Dna className="mx-auto mb-3 h-12 w-12 text-teal-400" />
                  <Input type="file" className="hidden" id="file-upload" />
                  <Label
                    htmlFor="file-upload"
                    className="mb-2 block cursor-pointer font-medium text-teal-600 hover:text-teal-800"
                  >
                    Drop FASTA file here or click to browse
                  </Label>
                  <p className="text-sm text-gray-500">
                    Supports .fasta, .fa, .fna, or raw sequence reads
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* Common Search Parameters Section */}
            <div className="mt-8 border-t border-gray-100 pt-6">
              <h2 className="mb-6 flex items-center text-xl font-bold text-gray-800">
                <Settings className="mr-2 h-5 w-5 text-teal-600" />
                Search Parameters
              </h2>

              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                {/* Left Column - Sliders */}
                <div className="space-y-6">
                  <div className="rounded-lg border border-teal-100 bg-teal-50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center">
                        <Maximize2 className="mr-2 h-4 w-4 text-teal-700" />
                        <Label className="font-medium text-teal-800">
                          Genetic Distance
                        </Label>
                      </div>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-4 w-4 text-teal-500" />
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            <p className="max-w-xs">
                              Maximum Mash distance to include. Lower values
                              mean more similar genomes.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-teal-700">
                          Low Similarity
                        </span>
                        <span className="text-sm font-medium text-teal-900">
                          {distance[0]}
                        </span>
                        <span className="text-sm text-teal-700">
                          High Similarity
                        </span>
                      </div>
                      <Slider
                        defaultValue={[0.5]}
                        max={1}
                        min={0.01}
                        step={0.01}
                        value={distance}
                        onValueChange={setDistance}
                        className="[&>span]:bg-teal-600"
                      />
                      <div className="grid grid-cols-5 text-xs text-teal-600">
                        <span>0.01</span>
                        <span className="text-center">0.25</span>
                        <span className="text-center">0.5</span>
                        <span className="text-center">0.75</span>
                        <span className="text-right">1.0</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center">
                        <Hash className="mr-2 h-4 w-4 text-indigo-700" />
                        <Label className="font-medium text-indigo-800">
                          Results Limit
                        </Label>
                      </div>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-4 w-4 text-indigo-500" />
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            <p className="max-w-xs">
                              Maximum number of similar genomes to return in
                              results.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-indigo-700">
                          Fewer Results
                        </span>
                        <span className="text-sm font-medium text-indigo-900">
                          {maxHits[0]}
                        </span>
                        <span className="text-sm text-indigo-700">
                          More Results
                        </span>
                      </div>
                      <Slider
                        defaultValue={[50]}
                        max={200}
                        min={10}
                        step={10}
                        value={maxHits}
                        onValueChange={setMaxHits}
                        className="[&>span]:bg-indigo-600"
                      />
                      <div className="grid grid-cols-5 text-xs text-indigo-600">
                        <span>10</span>
                        <span className="text-center">50</span>
                        <span className="text-center">100</span>
                        <span className="text-center">150</span>
                        <span className="text-right">200</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column - Additional Parameters */}
                <div className="space-y-6">
                  <div className="rounded-lg border border-purple-100 bg-purple-50 p-4">
                    <div className="mb-3 flex items-center">
                      <Microscope className="mr-2 h-4 w-4 text-purple-700" />
                      <Label className="font-medium text-purple-800">
                        P-Value Threshold
                      </Label>
                    </div>

                    <Select defaultValue="1">
                      <SelectTrigger className="w-full border-purple-200 bg-white">
                        <SelectValue placeholder="Select threshold" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0.001">
                          0.001 (very strict)
                        </SelectItem>
                        <SelectItem value="0.01">0.01 (strict)</SelectItem>
                        <SelectItem value="0.1">0.1 (moderate)</SelectItem>
                        <SelectItem value="1">1.0 (relaxed)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="mt-2 text-xs text-purple-600">
                      Statistical significance threshold for matches
                    </p>
                  </div>

                  <div className="rounded-lg border border-amber-100 bg-amber-50 p-4">
                    <div className="mb-3 flex items-center">
                      <Database className="mr-2 h-4 w-4 text-amber-700" />
                      <Label className="font-medium text-amber-800">
                        Genome Database
                      </Label>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center space-x-2 rounded border border-amber-200 bg-white p-2">
                        <Checkbox
                          id="bacteria"
                          defaultChecked
                          className="rounded-sm text-amber-600"
                        />
                        <Label
                          htmlFor="bacteria"
                          className="text-sm font-medium"
                        >
                          Bacterial & Archaeal Genomes
                        </Label>
                      </div>

                      <div className="flex items-center space-x-2 rounded border border-amber-200 bg-white p-2">
                        <Checkbox
                          id="viral"
                          className="rounded-sm text-amber-600"
                        />
                        <Label htmlFor="viral" className="text-sm font-medium">
                          Viral Genomes
                        </Label>
                      </div>

                      <div className="flex items-center space-x-2 rounded border border-amber-200 bg-white p-2">
                        <Checkbox
                          id="reference"
                          className="rounded-sm text-amber-600"
                        />
                        <Label
                          htmlFor="reference"
                          className="text-sm font-medium"
                        >
                          Reference & Representative Genomes
                        </Label>
                      </div>

                      <div className="flex items-center space-x-2 rounded border border-amber-200 bg-white p-2">
                        <Checkbox
                          id="all"
                          className="rounded-sm text-amber-600"
                        />
                        <Label htmlFor="all" className="text-sm font-medium">
                          All Public Genomes
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="mt-8 text-center">
              <Button className="h-auto rounded-full bg-teal-600 px-8 py-6 text-lg text-white shadow-lg transition-all duration-300 hover:bg-teal-700 hover:shadow-xl">
                <Sparkles className="mr-2 h-5 w-5" />
                Find Similar Genomes
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
              <p className="mt-3 text-sm text-gray-500">
                Results will include distance metrics, phylogenetic
                relationships, and comparative analysis
              </p>
            </div>
          </div>
        </Tabs>
      </div>

      {/* Footer Info */}
      <div className="mx-auto mt-8 max-w-2xl text-center text-sm text-gray-500">
        <p>
          The Similar Genome Finder utilizes Mash/MinHash algorithms to rapidly
          estimate genome distances.
          <a href="#" className="mx-1 text-teal-600 hover:text-teal-800">
            Learn more about the methods
          </a>
        </p>
      </div>
    </div>
  );
};

// This function isn't defined in the original imports, so adding it here
const Settings = ({ className }: { className: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
};

export default CreativeGenomeFinder;
