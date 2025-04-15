"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  ChevronRight,
  HelpCircle,
  Upload,
  Search,
  Database,
  Settings,
  Dna,
  FileText,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

const CreativeBlastInterface = () => {
  const [blastMethod, setBlastMethod] = useState("nucleotide");
  const [currentStep, setCurrentStep] = useState(1);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const nextStep = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderMethodIcon = (method: "nucleotide" | "protein" | "translated" | string) => {
    switch (method) {
      case "nucleotide":
        return (
          <div className="rounded-full bg-blue-100 p-3 text-blue-700">
            <Dna size={24} />
          </div>
        );
      case "protein":
        return (
          <div className="rounded-full bg-emerald-100 p-3 text-emerald-700">
            <Dna size={24} />
          </div>
        );
      case "translated":
        return (
          <div className="rounded-full bg-purple-100 p-3 text-purple-700">
            <Dna size={24} />
          </div>
        );
      default:
        return (
          <div className="rounded-full bg-gray-100 p-3 text-gray-700">
            <Dna size={24} />
          </div>
        );
    }
  };

  return (
    <div className="mx-auto max-w-5xl rounded-xl bg-white p-6 shadow-sm">
      <div className="mb-8 text-center">
        <div className="mb-4 inline-flex items-center justify-center">
          <span className="relative">
            <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 opacity-75 blur"></div>
            <div className="relative rounded-full bg-white p-2">
              <Dna className="h-10 w-10 text-blue-600" />
            </div>
          </span>
        </div>
        <h1 className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-3xl font-bold text-transparent">
          BLAST Search Interface
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-gray-600">
          Search against genomic databases using sequence alignment
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="flex flex-col items-center">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${
                  currentStep === step
                    ? "bg-blue-600 text-white"
                    : currentStep > step
                      ? "bg-blue-100 text-blue-600"
                      : "bg-gray-100 text-gray-400"
                }`}
              >
                {step}
              </div>
              <span
                className={`mt-1 text-xs ${
                  currentStep >= step ? "text-blue-600" : "text-gray-400"
                }`}
              >
                {step === 1
                  ? "Search Type"
                  : step === 2
                    ? "Query Input"
                    : step === 3
                      ? "Database"
                      : "Results"}
              </span>
            </div>
          ))}
        </div>
        <div className="relative mt-2">
          <div className="absolute top-2.5 left-0 h-1 w-full rounded-full bg-gray-200" />
          <div
            className="absolute top-2.5 left-0 h-1 rounded-full bg-blue-600 transition-all duration-300"
            style={{ width: `${(currentStep - 1) * 33.3}%` }}
          />
        </div>
      </div>

      {/* Step 1: Search Type */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-800">
            Choose Your Search Method
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* BLASTN */}
            <Card
              className={`cursor-pointer transition-all hover:shadow-md ${
                blastMethod === "nucleotide"
                  ? "shadow-md ring-2 ring-blue-500"
                  : ""
              }`}
              onClick={() => setBlastMethod("nucleotide")}
            >
              <CardContent className="p-6">
                <div className="flex flex-col items-center space-y-4 text-center">
                  <div className="rounded-full bg-blue-100 p-3 text-blue-700">
                    <Dna size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold">BLASTN</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Nucleotide → Nucleotide
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-blue-50">
                    DNA
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* BLASTP */}
            <Card
              className={`cursor-pointer transition-all hover:shadow-md ${
                blastMethod === "protein"
                  ? "shadow-md ring-2 ring-emerald-500"
                  : ""
              }`}
              onClick={() => setBlastMethod("protein")}
            >
              <CardContent className="p-6">
                <div className="flex flex-col items-center space-y-4 text-center">
                  <div className="rounded-full bg-emerald-100 p-3 text-emerald-700">
                    <Dna size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold">BLASTP</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Protein → Protein
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-emerald-50">
                    Protein
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* BLASTX/TBLASTN */}
            <Card
              className={`cursor-pointer transition-all hover:shadow-md ${
                blastMethod === "translated"
                  ? "shadow-md ring-2 ring-purple-500"
                  : ""
              }`}
              onClick={() => setBlastMethod("translated")}
            >
              <CardContent className="p-6">
                <div className="flex flex-col items-center space-y-4 text-center">
                  <div className="rounded-full bg-purple-100 p-3 text-purple-700">
                    <Dna size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold">Translated BLAST</h3>
                    <p className="mt-1 text-sm text-gray-500">BLASTX/TBLASTN</p>
                  </div>
                  <Badge variant="outline" className="bg-purple-50">
                    Translation
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {blastMethod === "translated" && (
            <div className="mt-4 rounded-lg bg-purple-50 p-4">
              <h4 className="font-medium text-purple-700">
                Choose Translation Direction:
              </h4>
              <div className="mt-3 flex space-x-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="blastx"
                    name="translation"
                    className="text-purple-600"
                    defaultChecked
                  />
                  <label htmlFor="blastx" className="text-sm">
                    BLASTX (Nucleotide → Protein)
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="tblastn"
                    name="translation"
                    className="text-purple-600"
                  />
                  <label htmlFor="tblastn" className="text-sm">
                    TBLASTN (Protein → Nucleotide)
                  </label>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 flex justify-end">
            <Button
              onClick={nextStep}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Continue to Query Input
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Query Input */}
      {currentStep === 2 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800">
              Enter Your Query Sequence
            </h2>
            <div className="flex items-center">
              {renderMethodIcon(blastMethod)}
              <span className="ml-2 font-medium">
                {blastMethod === "nucleotide"
                  ? "BLASTN"
                  : blastMethod === "protein"
                    ? "BLASTP"
                    : "Translated BLAST"}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-6">
            <Tabs defaultValue="paste" className="w-full">
              <TabsList className="mb-6 grid w-full grid-cols-3">
                <TabsTrigger value="paste">Paste Sequence</TabsTrigger>
                <TabsTrigger value="upload">Upload File</TabsTrigger>
                <TabsTrigger value="example">Use Example</TabsTrigger>
              </TabsList>

              <TabsContent value="paste" className="space-y-4">
                <div className="mb-2 flex items-center">
                  <div className="mr-2 h-4 w-4 rounded-full bg-blue-500"></div>
                  <Label className="font-medium">
                    Enter sequence in FASTA format
                  </Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="ml-1">
                        <HelpCircle className="h-4 w-4 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm">
                        <p>
                          FASTA format begins with a &gt; line followed by
                          sequence data. For example:
                        </p>
                        <pre className="mt-1 rounded bg-gray-100 p-1 text-xs">
                          {">seq1\nACGTACGT\n>seq2\nPRTEIN"}
                        </pre>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Textarea
                  placeholder={`Enter your sequence in FASTA format\n>sequence_name\n${blastMethod === "nucleotide" ? "ACGTACGTACGT..." : "MGKLMGHPT..."}`}
                  className="min-h-40 font-mono text-sm"
                />
                <div className="text-xs text-gray-500">
                  Sequence statistics will appear here as you type
                </div>
              </TabsContent>

              <TabsContent value="upload" className="space-y-4">
                <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
                  <div className="flex flex-col items-center">
                    <Upload className="mb-2 h-10 w-10 text-gray-400" />
                    <h3 className="text-lg font-medium text-gray-700">
                      Upload a FASTA file
                    </h3>
                    <p className="mt-1 mb-4 text-sm text-gray-500">
                      Drag and drop or click to browse
                    </p>
                    <Button variant="outline">Select File</Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="example" className="space-y-4">
                <div className="mb-4 text-sm text-gray-600">
                  Select an example sequence to use for your BLAST search:
                </div>
                <div className="space-y-3">
                  <Card
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => {}}
                  >
                    <CardContent className="flex items-center p-4">
                      <FileText className="mr-3 h-5 w-5 text-blue-500" />
                      <div>
                        <h4 className="font-medium">
                          {blastMethod === "nucleotide"
                            ? "Human BRCA1 gene"
                            : "Human Hemoglobin protein"}
                        </h4>
                        <p className="text-xs text-gray-500">
                          {blastMethod === "nucleotide"
                            ? "1,863 bp"
                            : "147 amino acids"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => {}}
                  >
                    <CardContent className="flex items-center p-4">
                      <FileText className="mr-3 h-5 w-5 text-blue-500" />
                      <div>
                        <h4 className="font-medium">
                          {blastMethod === "nucleotide"
                            ? "E. coli 16S rRNA"
                            : "E. coli DNA Polymerase"}
                        </h4>
                        <p className="text-xs text-gray-500">
                          {blastMethod === "nucleotide"
                            ? "1,542 bp"
                            : "928 amino acids"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div className="mt-8 flex items-center justify-between">
            <Button variant="outline" onClick={prevStep}>
              Back
            </Button>
            <Button
              onClick={nextStep}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Continue to Database Selection
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Database Selection */}
      {currentStep === 3 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800">
              Select Database
            </h2>
            <div className="flex items-center">
              {renderMethodIcon(blastMethod)}
              <span className="ml-2 font-medium">
                {blastMethod === "nucleotide"
                  ? "BLASTN"
                  : blastMethod === "protein"
                    ? "BLASTP"
                    : "Translated BLAST"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <Label className="mb-2 block text-sm font-medium text-gray-700">
                Database Collection
              </Label>
              <Select defaultValue="refseq">
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select database collection" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="refseq">
                    Reference Genomes (RefSeq)
                  </SelectItem>
                  <SelectItem value="genbank">All GenBank Genomes</SelectItem>
                  <SelectItem value="representative">
                    Representative Genomes
                  </SelectItem>
                  <SelectItem value="bacteria">Bacteria</SelectItem>
                  <SelectItem value="archaea">Archaea</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-gray-500">
                Curated reference genomes with high-quality annotations
              </p>
            </div>

            <div>
              <Label className="mb-2 block text-sm font-medium text-gray-700">
                Database Type
              </Label>
              <Select
                defaultValue={
                  blastMethod === "nucleotide" ? "genome" : "protein"
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select database type" />
                </SelectTrigger>
                <SelectContent>
                  {blastMethod === "nucleotide" ? (
                    <>
                      <SelectItem value="genome">
                        Genome sequences (NT)
                      </SelectItem>
                      <SelectItem value="rna">Transcriptome (RNA)</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="protein">
                        Protein sequences (AA)
                      </SelectItem>
                      <SelectItem value="domains">Protein domains</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-gray-500">
                {blastMethod === "nucleotide"
                  ? "Search against complete genomic sequences"
                  : "Search against protein sequences"}
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-gray-50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Database className="h-5 w-5 text-gray-600" />
                <h3 className="font-medium">Search Parameters</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs"
              >
                {showAdvanced ? "Hide Advanced" : "Show Advanced"}
              </Button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label className="text-sm">Max Target Sequences</Label>
                <Input type="number" defaultValue="50" className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">Expected Threshold (E-value)</Label>
                <Input type="number" defaultValue="0.05" className="mt-1" />
              </div>
            </div>

            {showAdvanced && (
              <div className="mt-4 grid grid-cols-1 gap-4 border-t border-gray-200 pt-4 md:grid-cols-2">
                <div>
                  <Label className="text-sm">Word Size</Label>
                  <Input
                    type="number"
                    defaultValue={blastMethod === "nucleotide" ? "11" : "3"}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm">Match/Mismatch Scores</Label>
                  <div className="mt-1 flex space-x-2">
                    <Input
                      type="number"
                      defaultValue="1"
                      className="w-20"
                      placeholder="Match"
                    />
                    <Input
                      type="number"
                      defaultValue="-2"
                      className="w-20"
                      placeholder="Mismatch"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-sm">Gap Costs</Label>
                  <div className="mt-1 flex space-x-2">
                    <Input
                      type="number"
                      defaultValue="5"
                      className="w-20"
                      placeholder="Open"
                    />
                    <Input
                      type="number"
                      defaultValue="2"
                      className="w-20"
                      placeholder="Extend"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-sm">Low Complexity Filter</Label>
                  <div className="mt-3 flex items-center space-x-2">
                    <Switch id="filter" defaultChecked />
                    <Label htmlFor="filter" className="text-sm">
                      Enable
                    </Label>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4">
            <Label className="text-sm font-medium text-gray-700">
              Output Format
            </Label>
            <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="format1"
                  name="format"
                  className="text-blue-600"
                  defaultChecked
                />
                <Label htmlFor="format1" className="text-sm">
                  HTML
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="format2"
                  name="format"
                  className="text-blue-600"
                />
                <Label htmlFor="format2" className="text-sm">
                  Text
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="format3"
                  name="format"
                  className="text-blue-600"
                />
                <Label htmlFor="format3" className="text-sm">
                  XML
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="format4"
                  name="format"
                  className="text-blue-600"
                />
                <Label htmlFor="format4" className="text-sm">
                  CSV
                </Label>
              </div>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between">
            <Button variant="outline" onClick={prevStep}>
              Back
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  Run BLAST Search
                  <Search className="ml-2 h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Search</AlertDialogTitle>
                  <AlertDialogDescription>
                    You're about to run a BLAST search with the following
                    parameters:
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                      <li>
                        Method:{" "}
                        {blastMethod === "nucleotide"
                          ? "BLASTN (Nucleotide)"
                          : blastMethod === "protein"
                            ? "BLASTP (Protein)"
                            : "Translated BLAST"}
                      </li>
                      <li>Database: RefSeq Reference Genomes</li>
                      <li>E-value Threshold: 0.05</li>
                      <li>Max Hits: 50</li>
                    </ul>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => setCurrentStep(4)}>
                    Run Search
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}

      {/* Step 4: Results Preview */}
      {currentStep === 4 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800">
              Search Results
            </h2>
            <Badge className="border-green-200 bg-green-100 text-green-800 hover:bg-green-200">
              Analysis Complete
            </Badge>
          </div>

          <div className="flex items-start rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="mt-0.5 mr-3 text-blue-500">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-medium text-blue-700">Analysis Summary</h4>
              <p className="mt-1 text-sm text-blue-600">
                Your BLAST search found 28 significant matches (E-value &lt;
                0.05) in the RefSeq Reference Genomes database.
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
            <div className="flex items-center justify-between border-b bg-gray-50 px-4 py-3">
              <h3 className="font-medium">Top Results</h3>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" className="text-xs">
                  Download Results
                </Button>
                <Select defaultValue="relevance">
                  <SelectTrigger className="h-8 w-36 text-xs">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="relevance">Sort by E-value</SelectItem>
                    <SelectItem value="identity">Sort by Identity</SelectItem>
                    <SelectItem value="coverage">Sort by Coverage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="divide-y">
              {/* Example result items */}
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="p-4 transition-colors hover:bg-gray-50"
                >
                  <div className="flex justify-between">
                    <div>
                      <h4 className="cursor-pointer font-medium text-blue-600 hover:underline">
                        {blastMethod === "nucleotide"
                          ? `Escherichia coli str. K-12 chromosome, complete genome`
                          : `DNA polymerase III subunit beta [Escherichia coli]`}
                      </h4>
                      <div className="mt-1 text-xs text-gray-500">
                        {blastMethod === "nucleotide"
                          ? `GenBank: U00096.3 | 4,641,652 bp`
                          : `GenBank: NP_418156.1 | 366 aa`}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-sm font-medium">
                        E-value: {(0.01 / (item * 10)).toExponential(2)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded bg-blue-50 p-2">
                      <span className="text-gray-600">Identity:</span>
                      <span className="ml-1 font-medium">{98 - item}%</span>
                    </div>
                    <div className="rounded bg-green-50 p-2">
                      <span className="text-gray-600">Coverage:</span>
                      <span className="ml-1 font-medium">
                        {100 - item * 5}%
                      </span>
                    </div>
                    <div className="rounded bg-purple-50 p-2">
                      <span className="text-gray-600">Score:</span>
                      <span className="ml-1 font-medium">
                        {1200 - item * 100}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 overflow-x-auto rounded bg-gray-50 p-2 font-mono text-xs">
                    <div className="text-gray-500">
                      Query 1 ATGGCTATCGCTGAAATTCTGGCACAGCAGGCGATTGCCGAT...
                    </div>
                    <div className="text-gray-400">
                      {" "}
                      | ||||||||||||||||||||||||||||||||| ||||
                    </div>
                    <div className="text-gray-500">
                      Sbjct 1 ATGACTATCGCTGAAATTCTGGCACAGCAGGCGATCGCCGAT...
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-center border-t bg-gray-50 px-4 py-3">
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" disabled>
                  Previous
                </Button>
                <span className="text-sm text-gray-600">Page 1 of 3</span>
                <Button variant="outline" size="sm">
                  Next
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-between">
            <Button variant="outline" onClick={prevStep}>
              Back to Database
            </Button>
            <div className="flex space-x-2">
              <Button variant="outline" className="flex items-center">
                <FileText className="mr-2 h-4 w-4" />
                Export Report
              </Button>
              <Button variant="outline" className="flex items-center">
                <Search className="mr-2 h-4 w-4" />
                New Search
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreativeBlastInterface;
