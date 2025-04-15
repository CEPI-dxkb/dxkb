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
import {
  Info,
  FileDown,
  Search,
  Plus,
  Settings,
  ExternalLink,
  AlignJustify,
  Trash2,
} from "lucide-react";

interface Genome {
  id: string;
  name: string;
}

const GenomeAlignmentInterface = () => {
  const [selectedGenomes, setSelectedGenomes] = useState<Genome[]>([]);

  const addGenome = () => {
    const newGenome: Genome = {
      id: `genome_${selectedGenomes.length + 1}`,
      name: `Mycobacterium tuberculosis CDC${Math.floor(Math.random() * 9000) + 1000}`,
    };

    setSelectedGenomes([...selectedGenomes, newGenome]);
  };

  const removeGenome = (id: string) => {
    setSelectedGenomes(selectedGenomes.filter((genome) => genome.id !== id));
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-indigo-800">
          Genome Alignment (Mauve)
        </h1>
        <div className="mb-4 flex items-center space-x-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-5 w-5 text-gray-500" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-md">
                  Multiple genome alignment using progressiveMauve
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <a href="#" className="text-indigo-600 hover:text-indigo-800">
            <ExternalLink className="h-5 w-5" />
          </a>
        </div>
        <p className="max-w-4xl text-gray-600">
          The Whole Genome Alignment Service aligns genomes using
          progressiveMauve. For further explanation, please see the Genome
          Alignment (Mauve) Service
          <a href="#" className="mx-1 text-indigo-600 hover:text-indigo-800">
            Quick Reference Guide
          </a>
          ,
          <a href="#" className="mx-1 text-indigo-600 hover:text-indigo-800">
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
        {/* Select Genomes Section */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center">
              <CardTitle className="text-lg">Select Genomes</CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger className="ml-2">
                    <Info className="h-4 w-4 text-gray-500" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-md">
                      Add at least 2 (up to 20) genomes. Note the first genome
                      selected will be the reference (anchor) genome.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <CardDescription>
              Add at least 2 (up to 20) genomes. Note the first genome selected
              will be the reference (anchor) genome.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Genome Search */}
            <div className="space-y-2">
              <Label className="font-medium text-gray-700">SELECT GENOME</Label>
              <div className="flex space-x-2">
                <div className="relative flex-1">
                  <Input
                    placeholder="e.g. M. tuberculosis CDC1551"
                    className="pr-10"
                  />
                  <Search className="absolute top-2.5 right-3 h-4 w-4 text-gray-400" />
                </div>
                <Button
                  type="button"
                  onClick={addGenome}
                  className="bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add
                </Button>
              </div>
            </div>

            {/* Select Genome Group */}
            <div className="space-y-2">
              <Label className="font-medium text-gray-700">
                AND/OR SELECT GENOME GROUP
              </Label>
              <div className="flex space-x-2">
                <Input placeholder="Optional" className="flex-1" />
                <Button
                  type="button"
                  variant="outline"
                  className="ml-2"
                  size="icon"
                >
                  <FileDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  className="bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add
                </Button>
              </div>
            </div>

            {/* Selected Genomes List */}
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-semibold text-gray-700">
                SELECTED GENOMES
              </h3>

              {selectedGenomes.length === 0 ? (
                <div className="rounded-md border bg-gray-50 p-4 text-center text-gray-500 italic">
                  No genomes selected
                </div>
              ) : (
                <div className="overflow-hidden rounded-md border">
                  <div className="grid grid-cols-[2fr_1fr_auto] bg-gray-100 p-2 text-sm font-medium">
                    <div>Name</div>
                    <div>ID</div>
                    <div></div>
                  </div>
                  <div className="divide-y">
                    {selectedGenomes.map((genome, index) => (
                      <div
                        key={genome.id}
                        className="grid grid-cols-[2fr_1fr_auto] items-center p-2 text-sm"
                      >
                        <div className="flex items-center">
                          {genome.name}
                          {index === 0 && (
                            <span className="ml-2 rounded-full bg-indigo-100 px-1.5 py-0.5 text-xs text-indigo-600">
                              Reference
                            </span>
                          )}
                        </div>
                        <div>{genome.id}</div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-gray-400 hover:text-red-500"
                          onClick={() => removeGenome(genome.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Parameters Section */}
        <Card>
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
                      Configure alignment output parameters
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="font-medium text-gray-700">OUTPUT FOLDER</Label>
              <div className="flex space-x-2">
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

            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="advanced">
                <AccordionTrigger className="text-sm font-medium text-gray-700">
                  <div className="flex items-center">
                    <Settings className="mr-2 h-4 w-4" />
                    ADVANCED (OPTIONAL)
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-gray-700">Seed Weight</Label>
                        <Input type="number" defaultValue="15" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-gray-700">
                          Minimum LCB Score
                        </Label>
                        <Input type="number" defaultValue="3000" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-gray-700">
                          Minimum Island Size
                        </Label>
                        <Input type="number" defaultValue="50" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-gray-700">
                          Maximum Backbone Size
                        </Label>
                        <Input type="number" defaultValue="1500" />
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
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
            <AlignJustify className="mr-2 h-4 w-4" />
            Submit
          </Button>
        </div>
      </form>
    </div>
  );
};

export default GenomeAlignmentInterface;
