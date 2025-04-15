"use client";

import { useState, FormEvent } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Info, ChevronDown, ExternalLink } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function BlastServicePage() {
  const [searchProgram, setSearchProgram] = useState("");
  const [queryType, setQueryType] = useState("enterSequence");
  const [sequenceInput, setSequenceInput] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [maxHits, setMaxHits] = useState("10");
  const [eValueThreshold, setEValueThreshold] = useState("0.0001");
  const [outputFolder, setOutputFolder] = useState("");
  const [outputName, setOutputName] = useState("");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Handle form submission
    console.log("Form submitted");
  };

  const handleReset = () => {
    setSearchProgram("");
    setQueryType("enterSequence");
    setSequenceInput("");
    setShowAdvanced(false);
    setMaxHits("10");
    setEValueThreshold("0.0001");
    setOutputFolder("");
    setOutputName("");
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">BLAST</h1>
        <div className="mb-4 flex items-start gap-2">
          <div className="text-gray-600">
            <p>
              The BLAST service uses BLAST (Basic Local Alignment Search Tool)
              to search against public or private genomes or other databases
              using DNA or protein sequence(s).
            </p>
            <div className="mt-2 flex items-center gap-2">
              <p>For further explanation, please see the</p>
              <a
                href="/docs/blast-guide"
                className="flex items-center text-blue-500 hover:text-blue-700"
              >
                BLAST Service Quick Reference Guide{" "}
                <ExternalLink className="ml-1 h-3 w-3" />
              </a>
              <p>and</p>
              <a
                href="/tutorial/blast-video"
                className="flex items-center text-blue-500 hover:text-blue-700"
              >
                Tutorial and Instructional Video{" "}
                <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </div>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="mt-1 h-5 w-5 text-blue-500" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-sm">
                <p>
                  BLAST (Basic Local Alignment Search Tool) finds regions of
                  similarity between biological sequences.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Search Program Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                Search Program
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="ml-2">
                      <Info className="h-4 w-4 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>
                        Select the appropriate BLAST program for your search.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={searchProgram}
                onValueChange={setSearchProgram}
                className="grid grid-cols-1 gap-4 md:grid-cols-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="blastn" id="blastn" />
                  <Label htmlFor="blastn" className="cursor-pointer">
                    BLASTN (nucleotide → nucleotide database)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="blastp" id="blastp" />
                  <Label htmlFor="blastp" className="cursor-pointer">
                    BLASTP (protein → protein database)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="blastx" id="blastx" />
                  <Label htmlFor="blastx" className="cursor-pointer">
                    BLASTX (translated nucleotide → protein database)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="tblastn" id="tblastn" />
                  <Label htmlFor="tblastn" className="cursor-pointer">
                    TBLASTN (protein → translated nucleotide database)
                  </Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Query Source Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                Query Source
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="ml-2">
                      <Info className="h-4 w-4 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>Provide the sequence data you want to search for.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <RadioGroup
                  value={queryType}
                  onValueChange={setQueryType}
                  className="flex gap-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="enterSequence" id="enterSequence" />
                    <Label htmlFor="enterSequence" className="cursor-pointer">
                      Enter sequence
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="selectFasta" id="selectFasta" />
                    <Label htmlFor="selectFasta" className="cursor-pointer">
                      Select FASTA file
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="selectFeature" id="selectFeature" />
                    <Label htmlFor="selectFeature" className="cursor-pointer">
                      Select feature group
                    </Label>
                  </div>
                </RadioGroup>

                {queryType === "enterSequence" && (
                  <div className="space-y-2">
                    <Label htmlFor="sequence-input">
                      Enter one or more query nucleotide or protein sequences to
                      search. Requires FASTA format.
                    </Label>
                    <Textarea
                      id="sequence-input"
                      placeholder="Enter FASTA sequence"
                      value={sequenceInput}
                      onChange={(e) => setSequenceInput(e.target.value)}
                      className="min-h-40 font-mono"
                    />
                  </div>
                )}

                {queryType === "selectFasta" && (
                  <div className="space-y-4">
                    <Label htmlFor="fasta-file">Upload a FASTA file</Label>
                    <Input
                      id="fasta-file"
                      type="file"
                      accept=".fasta,.fa,.fna,.ffn,.faa,.frn"
                    />
                  </div>
                )}

                {queryType === "selectFeature" && (
                  <div className="space-y-4">
                    <Label htmlFor="feature-group">
                      Select a feature group
                    </Label>
                    <Select>
                      <SelectTrigger id="feature-group" className="w-full">
                        <SelectValue placeholder="Select a feature group" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="genes">Genes</SelectItem>
                        <SelectItem value="proteins">Proteins</SelectItem>
                        <SelectItem value="exons">Exons</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Database Selection Card */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  Database Source
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="ml-2">
                        <Info className="h-4 w-4 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Select the database to search against.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select database source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reference">
                      Reference and representative genomes (bacteria, archaea)
                    </SelectItem>
                    <SelectItem value="all">All bacterial genomes</SelectItem>
                    <SelectItem value="user">User uploaded genomes</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  Database Type
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="ml-2">
                        <Info className="h-4 w-4 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Select the type of database.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select database type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="genome">
                      Genome sequences (NT)
                    </SelectItem>
                    <SelectItem value="proteins">
                      Protein sequences (AA)
                    </SelectItem>
                    <SelectItem value="genes">Gene sequences</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          </div>

          {/* Output Settings Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                Output Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="output-folder">Output Folder</Label>
                  <Input
                    id="output-folder"
                    value={outputFolder}
                    onChange={(e) => setOutputFolder(e.target.value)}
                    placeholder="Specify output folder"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="output-name">Output Name</Label>
                  <Input
                    id="output-name"
                    value={outputName}
                    onChange={(e) => setOutputName(e.target.value)}
                    placeholder="Output Name"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Advanced Parameters Card */}
          <Card>
            <Collapsible
              open={showAdvanced}
              onOpenChange={setShowAdvanced}
              className="w-full"
            >
              <div className="flex items-center justify-between px-6 py-4">
                <h3 className="text-lg font-semibold">BLAST Parameters</h3>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-1 p-1"
                  >
                    {showAdvanced ? "Hide" : "Show"} Advanced Options
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-180 transform" : ""}`}
                    />
                  </Button>
                </CollapsibleTrigger>
              </div>
              <Separator />
              <CollapsibleContent>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="max-hits">Max Hits</Label>
                      <Input
                        id="max-hits"
                        type="number"
                        min="1"
                        value={maxHits}
                        onChange={(e) => setMaxHits(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="e-value">E-Value Threshold</Label>
                      <Input
                        id="e-value"
                        type="number"
                        step="0.0001"
                        min="0"
                        value={eValueThreshold}
                        onChange={(e) => setEValueThreshold(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="word-size">Word Size</Label>
                      <Input
                        id="word-size"
                        type="number"
                        min="2"
                        defaultValue="11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gap-costs">Gap Costs</Label>
                      <Select defaultValue="default">
                        <SelectTrigger id="gap-costs">
                          <SelectValue placeholder="Select gap costs" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">Default</SelectItem>
                          <SelectItem value="existence11extension1">
                            Existence: 11, Extension: 1
                          </SelectItem>
                          <SelectItem value="existence5extension2">
                            Existence: 5, Extension: 2
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2 space-y-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox id="filter-low-complexity" />
                        <Label htmlFor="filter-low-complexity">
                          Filter low complexity regions
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="mask-repeats" />
                        <Label htmlFor="mask-repeats">
                          Mask for lookup table only
                        </Label>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* Form Controls */}
          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={handleReset}>
              Reset
            </Button>
            <Button type="submit">Submit</Button>
            <Button type="button" variant="secondary">
              View Results
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
