"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import {
  Info,
  Upload,
  FileText,
  ArrowRight,
  X,
  HelpCircle,
  FileCode,
  FileSpreadsheet,
} from "lucide-react";

export default function SubspeciesClassification() {
  // States for the form
  const [querySequence, setQuerySequence] = useState("");
  const [species, setSpecies] = useState(
    "Adenoviridae - Human mastadenovirus A [complete genome, genomic RNA]",
  );
  const [outputFolder, setOutputFolder] = useState("");
  const [outputName, setOutputName] = useState("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Handle form submission logic here
    console.log({ querySequence, species, outputFolder, outputName });
  };

  const handleReset = () => {
    setQuerySequence("");
    setOutputFolder("");
    setOutputName("");
  };

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      {/* Header Section */}
      <div className="mb-8 text-center">
        <div className="mb-2 flex items-center justify-center gap-2">
          <h1 className="text-2xl font-bold">Subspecies Classification</h1>
          <div className="flex gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="bg-primary-50 text-primary-700 inline-flex h-6 w-6 items-center justify-center rounded-full">
                    <Info className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="w-64">
                    Information about Subspecies Classification
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <a
              href="#"
              className="bg-primary-50 text-primary-700 inline-flex h-6 w-6 items-center justify-center rounded-full"
            >
              <FileCode className="h-4 w-4" />
            </a>
          </div>
        </div>
        <p className="text-muted-foreground mx-auto max-w-3xl text-sm">
          The Subspecies Classification tool assigns the genotype/subtype of a
          virus, based on the genotype/subtype assignments maintained by the
          International Committee on Taxonomy of Viruses (ICTV). This tool
          infers the genotype/subtype for a query sequence from its position
          within a reference tree. The service uses the pplacer tool with a
          reference tree and reference alignment and includes the query sequence
          as input. Interpretation of the pplacer result is handled by
          Cladinator. Link to{" "}
          <a href="#" className="text-primary-600 hover:underline">
            pplacer
          </a>{" "}
          and{" "}
          <a href="#" className="text-primary-600 hover:underline">
            Cladinator
          </a>
          .
        </p>
        <p className="text-muted-foreground mt-2 text-sm">
          For further explanation, please see the{" "}
          <a href="#" className="text-primary-600 hover:underline">
            Subspecies Classification Service Quick Reference Guide
          </a>{" "}
          and{" "}
          <a href="#" className="text-primary-600 hover:underline">
            Tutorial
          </a>
          .
        </p>
      </div>

      {/* Main Form Content */}
      <div className="grid grid-cols-1 gap-6">
        {/* Query Source Section */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                Query Source
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="text-muted-foreground h-4 w-4" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="w-64">Enter sequence for classification</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="mb-4 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox id="enter-sequence" checked={true} />
                <Label htmlFor="enter-sequence" className="text-sm">
                  Enter sequence
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox id="select-fasta" />
                <Label htmlFor="select-fasta" className="text-sm">
                  Select FASTA file
                </Label>
              </div>
            </div>

            <Textarea
              placeholder="Enter one or more query nucleotide or protein sequences to search. Requires FASTA format."
              className="min-h-[200px] font-mono text-sm"
              value={querySequence}
              onChange={(e) => setQuerySequence(e.target.value)}
            />

            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
              >
                <Upload className="h-4 w-4" />
                <span>Upload FASTA</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Species Selection */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                Species
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="text-muted-foreground h-4 w-4" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="w-64">
                        Select the species for classification
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Select defaultValue={species}>
              <SelectTrigger>
                <SelectValue placeholder="Select species" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Adenoviridae - Human mastadenovirus A [complete genome, genomic RNA]">
                  Adenoviridae - Human mastadenovirus A [complete genome,
                  genomic RNA]
                </SelectItem>
                <SelectItem value="Coronaviridae - SARS-CoV-2 [complete genome]">
                  Coronaviridae - SARS-CoV-2 [complete genome]
                </SelectItem>
                <SelectItem value="Herpesviridae - Human herpesvirus 1 [complete genome]">
                  Herpesviridae - Human herpesvirus 1 [complete genome]
                </SelectItem>
                <SelectItem value="Orthomyxoviridae - Influenza A virus [segment 4, HA]">
                  Orthomyxoviridae - Influenza A virus [segment 4, HA]
                </SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Output Options Section */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base font-medium">
                  Output Folder
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <HelpCircle className="text-muted-foreground h-4 w-4" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="w-64">
                          Specify where output files should be saved
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Output Folder"
                  value={outputFolder}
                  onChange={(e) => setOutputFolder(e.target.value)}
                  className="flex-1"
                />
                <Button variant="outline" size="icon">
                  <FileText className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base font-medium">
                  Output Name
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <HelpCircle className="text-muted-foreground h-4 w-4" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="w-64">Name for the output files</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <Input
                placeholder="Output Name"
                value={outputName}
                onChange={(e) => setOutputName(e.target.value)}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-8 flex justify-center gap-4">
        <Button variant="outline" onClick={handleReset}>
          Reset
        </Button>
        <Button type="submit">Submit</Button>
      </div>
    </div>
  );
}
