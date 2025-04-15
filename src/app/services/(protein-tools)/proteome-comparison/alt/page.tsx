"use client";

import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Info,
  FileSymlink,
  Upload,
  ChevronRight,
  Search,
  Settings,
  HelpCircle,
  BookOpen,
  Dna,
  Database,
  Trash2,
  PlusCircle,
  BarChart,
  MoveRight,
} from "lucide-react";

export default function ProteomeComparisonPage() {
  const [comparisonGenomes, setComparisonGenomes] = useState([
    "Mycobacterium tuberculosis H37Rv",
  ]);
  const [activeTab, setActiveTab] = useState("genomes");
  const [progress, setProgress] = useState(25);

  const addGenome = (genome: string) => {
    if (!comparisonGenomes.includes(genome) && comparisonGenomes.length < 5) {
      setComparisonGenomes([...comparisonGenomes, genome]);
    }
  };

  const removeGenome = (index: number) => {
    const newGenomes = [...comparisonGenomes];
    newGenomes.splice(index, 1);
    setComparisonGenomes(newGenomes);
  };

  return (
    <div className="container mx-auto max-w-6xl p-6">
      {/* Modern Header with Gradient */}
      <div className="from-primary-50 via-background-100 to-accent-50 mb-8 rounded-xl bg-gradient-to-r p-6 shadow-sm">
        <div className="flex flex-col items-center justify-between md:flex-row">
          <div className="mb-4 md:mb-0">
            <div className="flex items-center">
              <h1 className="text-primary-700 text-2xl font-bold md:text-3xl">
                Proteome Comparison
              </h1>
              <Badge className="bg-accent-200 text-accent-800 ml-3">
                BLASTP
              </Badge>
            </div>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              Compare protein sequences across multiple genomes using
              bidirectional BLASTP to identify orthologs, analyze gene
              conservation, and explore protein sequence similarities.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2">
              <HelpCircle size={16} />
              Tutorial
            </Button>
            <Button variant="outline" size="sm" className="gap-2">
              <BookOpen size={16} />
              Guide
            </Button>
          </div>
        </div>

        {/* Workflow Progress Indicator */}
        <div className="mt-6">
          <div className="mb-1 flex justify-between text-sm">
            <div className="font-medium">Analysis Workflow</div>
            <div className="text-muted-foreground">Step 1 of 4</div>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="text-muted-foreground mt-1 flex justify-between text-xs">
            <div>Genomes</div>
            <div>Reference</div>
            <div>Parameters</div>
            <div>Review</div>
          </div>
        </div>
      </div>

      {/* Main Content with Tabs */}
      <Tabs
        defaultValue="genomes"
        className="w-full"
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(value);
          setProgress(
            value === "genomes"
              ? 25
              : value === "reference"
                ? 50
                : value === "parameters"
                  ? 75
                  : 95,
          );
        }}
      >
        <TabsList className="mb-6 grid grid-cols-4">
          <TabsTrigger value="genomes" className="gap-2">
            <Dna size={16} /> Comparison Genomes
          </TabsTrigger>
          <TabsTrigger value="reference" className="gap-2">
            <Database size={16} /> Reference Genome
          </TabsTrigger>
          <TabsTrigger value="parameters" className="gap-2">
            <Settings size={16} /> Parameters
          </TabsTrigger>
          <TabsTrigger value="review" className="gap-2">
            <MoveRight size={16} /> Review & Submit
          </TabsTrigger>
        </TabsList>

        {/* Comparison Genomes Tab */}
        <TabsContent value="genomes" className="space-y-6">
          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-primary-700 mb-4 text-lg font-semibold">
                    Select Comparison Genomes
                  </h3>
                  <p className="text-muted-foreground mb-4 text-sm">
                    Add up to 5 genomes to compare against your reference
                    genome. You can select genomes by name, upload FASTA files,
                    or select from feature groups.
                  </p>

                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="genomes">
                      <AccordionTrigger className="py-3 text-base font-medium">
                        Genome Selection
                      </AccordionTrigger>
                      <AccordionContent className="pt-2 pb-4">
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <div className="col-span-2">
                              <Label className="mb-1 block text-sm">
                                Select Genome
                              </Label>
                              <Select>
                                <SelectTrigger>
                                  <SelectValue placeholder="Choose a genome" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="tuberculosis">
                                    Mycobacterium tuberculosis H37Rv
                                  </SelectItem>
                                  <SelectItem value="coli">
                                    Escherichia coli K-12
                                  </SelectItem>
                                  <SelectItem value="subtilis">
                                    Bacillus subtilis 168
                                  </SelectItem>
                                  <SelectItem value="cerevisiae">
                                    Saccharomyces cerevisiae S288C
                                  </SelectItem>
                                  <SelectItem value="influenzae">
                                    Haemophilus influenzae Rd KW20
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="flex items-end">
                              <Button
                                className="w-full gap-2"
                                onClick={() =>
                                  addGenome("Escherichia coli K-12")
                                }
                              >
                                <PlusCircle size={16} />
                                Add Genome
                              </Button>
                            </div>
                          </div>

                          <div className="bg-muted/20 text-muted-foreground rounded-md p-3 text-sm">
                            Tip: Start by selecting well-characterized reference
                            genomes to ensure the most accurate protein sequence
                            comparisons.
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="fasta">
                      <AccordionTrigger className="py-3 text-base font-medium">
                        Protein FASTA File Upload
                      </AccordionTrigger>
                      <AccordionContent className="pt-2 pb-4">
                        <div className="space-y-4">
                          <div className="border-muted-foreground/25 hover:bg-muted/50 cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors">
                            <Upload className="text-muted-foreground/50 mx-auto mb-2 h-8 w-8" />
                            <p className="text-muted-foreground">
                              Drag and drop protein FASTA files here or click to
                              browse
                            </p>
                            <p className="text-muted-foreground mt-1 text-xs">
                              Max file size: 50MB
                            </p>
                            <input type="file" multiple className="hidden" />
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="text-muted-foreground text-sm">
                              Supported format: .fasta, .fa, .faa
                            </div>
                            <Button variant="outline" size="sm">
                              Upload File
                            </Button>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="feature">
                      <AccordionTrigger className="py-3 text-base font-medium">
                        Feature Group Selection
                      </AccordionTrigger>
                      <AccordionContent className="pt-2 pb-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                          <div className="col-span-2">
                            <Label className="mb-1 block text-sm">
                              Search Feature Groups
                            </Label>
                            <div className="flex gap-2">
                              <Input
                                placeholder="Enter feature group name"
                                className="flex-1"
                              />
                              <Button variant="outline">
                                <Search size={16} />
                              </Button>
                            </div>
                          </div>

                          <div className="flex items-end">
                            <Button className="w-full" variant="outline">
                              Add Group
                            </Button>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>

                <div>
                  <h3 className="text-primary-700 mb-4 text-lg font-semibold">
                    Selected Genomes
                  </h3>

                  <div className="overflow-hidden rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]">#</TableHead>
                          <TableHead>Genome</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {comparisonGenomes.length > 0 ? (
                          comparisonGenomes.map((genome, index) => (
                            <TableRow key={index}>
                              <TableCell>{index + 1}</TableCell>
                              <TableCell className="font-medium">
                                {genome}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  Reference Database
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeGenome(index)}
                                  className="text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 size={16} />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell
                              colSpan={4}
                              className="text-muted-foreground py-4 text-center"
                            >
                              No genomes selected. Add genomes using the options
                              above.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <div className="text-muted-foreground text-sm">
                      {comparisonGenomes.length}/5 genomes selected
                    </div>
                    {comparisonGenomes.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setComparisonGenomes([])}
                        >
                          Clear All
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-6">
                {comparisonGenomes.length > 0 ? (
                  <Button
                    onClick={() => {
                      setActiveTab("reference");
                      setProgress(50);
                    }}
                    className="gap-2"
                  >
                    Continue to Reference Genome <ChevronRight size={16} />
                  </Button>
                ) : (
                  <Button disabled className="gap-2">
                    Continue to Reference Genome <ChevronRight size={16} />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reference Genome Tab */}
        <TabsContent value="reference" className="space-y-6">
          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-primary-700 mb-4 text-lg font-semibold">
                    Select Reference Genome
                  </h3>
                  <p className="text-muted-foreground mb-4 text-sm">
                    Choose a single reference genome to which all comparison
                    genomes will be compared. Selected genomes will be analyzed
                    using bidirectional BLASTP against this reference.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <div className="bg-primary-50 border-primary-100 rounded-lg border p-4">
                      <h4 className="mb-2 flex items-center font-medium">
                        <Database size={16} className="text-primary-600 mr-2" />
                        Select from Database
                      </h4>

                      <div className="space-y-3">
                        <Select defaultValue="tuberculosis">
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a reference genome" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="tuberculosis">
                              Mycobacterium tuberculosis H37Rv
                            </SelectItem>
                            <SelectItem value="coli">
                              Escherichia coli K-12
                            </SelectItem>
                            <SelectItem value="subtilis">
                              Bacillus subtilis 168
                            </SelectItem>
                            <SelectItem value="cerevisiae">
                              Saccharomyces cerevisiae S288C
                            </SelectItem>
                          </SelectContent>
                        </Select>

                        <div className="rounded bg-white/60 p-3 text-sm">
                          <div className="font-medium">
                            Mycobacterium tuberculosis H37Rv
                          </div>
                          <div className="text-muted-foreground mt-1 flex justify-between">
                            <span>Proteins:</span>
                            <span>3,906</span>
                          </div>
                          <div className="text-muted-foreground flex justify-between">
                            <span>Genome Size:</span>
                            <span>4.41 Mb</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-accent-50 border-accent-100 rounded-lg border p-4">
                      <h4 className="mb-2 flex items-center font-medium">
                        <Upload size={16} className="text-accent-600 mr-2" />
                        Upload FASTA File
                      </h4>

                      <div className="space-y-3">
                        <div className="border-muted-foreground/25 hover:bg-muted/50 cursor-pointer rounded-lg border-2 border-dashed p-4 text-center transition-colors">
                          <p className="text-muted-foreground">
                            Drag and drop a protein FASTA file
                          </p>
                          <input type="file" className="hidden" />
                        </div>

                        <div className="flex justify-end">
                          <Button size="sm" variant="outline">
                            Browse Files
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-secondary-50 border-secondary-100 rounded-lg border p-4">
                      <h4 className="mb-2 flex items-center font-medium">
                        <Search size={16} className="text-secondary-600 mr-2" />
                        Search Feature Group
                      </h4>

                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <Input
                            placeholder="Search for feature group"
                            className="flex-1"
                          />
                          <Button variant="outline">
                            <Search size={16} />
                          </Button>
                        </div>

                        <div className="text-muted-foreground text-sm">
                          Search for a pre-defined feature group to use as a
                          reference
                        </div>
                      </div>
                    </div>

                    <div className="bg-muted/20 rounded-lg border p-4">
                      <h4 className="mb-2 font-medium">Selected Reference</h4>

                      <div className="rounded-lg bg-white p-3 shadow-sm">
                        <div className="flex items-center">
                          <div className="bg-primary-100 mr-3 flex h-8 w-8 items-center justify-center rounded-full">
                            <Database size={16} className="text-primary-600" />
                          </div>
                          <div>
                            <div className="font-medium">
                              Mycobacterium tuberculosis H37Rv
                            </div>
                            <div className="text-muted-foreground text-xs">
                              Database reference genome
                            </div>
                          </div>
                        </div>

                        <Separator className="my-3" />

                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <div className="text-muted-foreground">
                              Taxonomy:
                            </div>
                            <div>Bacteria; Actinobacteria</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Strain:</div>
                            <div>H37Rv</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">
                              Proteins:
                            </div>
                            <div>3,906</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">
                              Genome Size:
                            </div>
                            <div>4.41 Mb</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setActiveTab("genomes");
                    setProgress(25);
                  }}
                >
                  Back
                </Button>
                <Button
                  onClick={() => {
                    setActiveTab("parameters");
                    setProgress(75);
                  }}
                  className="gap-2"
                >
                  Continue to Parameters <ChevronRight size={16} />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Parameters Tab */}
        <TabsContent value="parameters" className="space-y-6">
          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-primary-700 mb-4 text-lg font-semibold">
                    Analysis Parameters
                  </h3>
                  <p className="text-muted-foreground mb-4 text-sm">
                    Configure the parameters for your proteome comparison
                    analysis. These settings will affect the sensitivity and
                    specificity of the protein sequence comparisons.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <h4 className="font-medium">BLAST Settings</h4>
                        <Badge variant="outline">Advanced</Badge>
                      </div>

                      <div className="bg-muted/10 space-y-3 rounded-lg border p-4">
                        <div>
                          <Label className="mb-1 block text-sm">
                            BLAST E-value
                          </Label>
                          <div className="flex items-center gap-4">
                            <Input defaultValue="1e-5" className="w-36" />
                            <div className="text-muted-foreground flex-1 text-sm">
                              Lower values increase specificity (recommended:
                              1e-5)
                            </div>
                          </div>
                        </div>

                        <div>
                          <Label className="mb-1 block text-sm">
                            Minimum % Coverage
                          </Label>
                          <div className="flex items-center gap-4">
                            <Input
                              type="number"
                              defaultValue="30"
                              min="0"
                              max="100"
                              className="w-20"
                            />
                            <div className="text-muted-foreground flex-1 text-sm">
                              Minimum query coverage percentage
                            </div>
                          </div>
                        </div>

                        <div>
                          <Label className="mb-1 block text-sm">
                            Minimum % Identity
                          </Label>
                          <div className="flex items-center gap-4">
                            <Input
                              type="number"
                              defaultValue="10"
                              min="0"
                              max="100"
                              className="w-20"
                            />
                            <div className="text-muted-foreground flex-1 text-sm">
                              Minimum sequence identity percentage
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="font-medium">Advanced Options</h4>
                        <Switch />
                      </div>
                      <div className="bg-muted/20 text-muted-foreground rounded-md p-3 text-sm">
                        Enable to access additional alignment parameters,
                        scoring matrices, and gap penalty settings.
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h4 className="mb-2 font-medium">Output Configuration</h4>

                      <div className="bg-muted/10 space-y-3 rounded-lg border p-4">
                        <div>
                          <Label className="mb-1 block text-sm">
                            Output Folder
                          </Label>
                          <div className="flex gap-2">
                            <Input
                              placeholder="/path/to/output"
                              className="flex-1"
                            />
                            <Button variant="outline" size="icon">
                              <FileSymlink size={16} />
                            </Button>
                          </div>
                        </div>

                        <div>
                          <Label className="mb-1 block text-sm">
                            Output Name
                          </Label>
                          <Input placeholder="proteome_comparison_result" />
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="mb-2 font-medium">Output Options</h4>

                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox id="tab-out" defaultChecked />
                          <Label htmlFor="tab-out" className="text-sm">
                            TAB-delimited Result File
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox id="summary" defaultChecked />
                          <Label htmlFor="summary" className="text-sm">
                            Create Summary Report
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox id="excel" />
                          <Label htmlFor="excel" className="text-sm">
                            Excel Compatible Format
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox id="heatmap" />
                          <Label htmlFor="heatmap" className="text-sm">
                            Generate Heatmap Visualization
                          </Label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setActiveTab("reference");
                    setProgress(50);
                  }}
                >
                  Back
                </Button>
                <Button
                  onClick={() => {
                    setActiveTab("review");
                    setProgress(95);
                  }}
                  className="gap-2"
                >
                  Continue to Review <ChevronRight size={16} />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Review Tab */}
        <TabsContent value="review" className="space-y-6">
          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-primary-700 mb-4 text-lg font-semibold">
                    Review Your Analysis
                  </h3>
                  <p className="text-muted-foreground mb-4 text-sm">
                    Review all of your selections before submitting the proteome
                    comparison job. Verify that your genomes, reference, and
                    parameters are correctly configured.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="bg-muted/10 rounded-lg border p-4">
                    <div className="text-muted-foreground text-sm font-medium uppercase">
                      Comparison Genomes
                    </div>
                    <div className="mt-1 font-medium">
                      {comparisonGenomes.length} genome
                      {comparisonGenomes.length !== 1 && "s"} selected
                    </div>

                    <div className="mt-3">
                      <ul className="space-y-1 text-sm">
                        {comparisonGenomes.map((genome, index) => (
                          <li key={index} className="flex items-center gap-1">
                            <span className="bg-primary-500 inline-block h-2 w-2 rounded-full"></span>
                            {genome}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="bg-muted/10 rounded-lg border p-4">
                    <div className="text-muted-foreground text-sm font-medium uppercase">
                      Reference Genome
                    </div>
                    <div className="mt-1 font-medium">
                      Mycobacterium tuberculosis H37Rv
                    </div>

                    <div className="mt-3 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Type:</span>
                        <span>Database</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Proteins:</span>
                        <span>3,906</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Genome Size:
                        </span>
                        <span>4.41 Mb</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-muted/10 rounded-lg border p-4">
                    <div className="text-muted-foreground text-sm font-medium uppercase">
                      Parameters
                    </div>
                    <div className="mt-1 font-medium">BLASTP Analysis</div>

                    <div className="mt-3 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">E-value:</span>
                        <span>1e-5</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Min. Coverage:
                        </span>
                        <span>30%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Min. Identity:
                        </span>
                        <span>10%</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-muted/10 rounded-lg border p-4">
                  <h4 className="mb-3 font-medium">Expected Results</h4>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="rounded bg-white p-3 shadow-sm">
                      <h5 className="flex items-center gap-2 text-sm font-medium">
                        <Database size={16} className="text-primary-600" />
                        Proteome Summary
                      </h5>
                      <p className="text-muted-foreground mt-1 text-sm">
                        Summary statistics of protein content across all
                        analyzed genomes
                      </p>
                    </div>

                    <div className="rounded bg-white p-3 shadow-sm">
                      <h5 className="flex items-center gap-2 text-sm font-medium">
                        <MoveRight size={16} className="text-secondary-600" />
                        Orthologs Table
                      </h5>
                      <p className="text-muted-foreground mt-1 text-sm">
                        Bidirectional best hits between reference and comparison
                        genomes
                      </p>
                    </div>

                    <div className="rounded bg-white p-3 shadow-sm">
                      <h5 className="flex items-center gap-2 text-sm font-medium">
                        <BarChart size={16} className="text-accent-600" />
                        Similarity Metrics
                      </h5>
                      <p className="text-muted-foreground mt-1 text-sm">
                        Quantitative measures of proteome similarity between
                        genomes
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-primary-50 border-primary-100 rounded-lg border p-4">
                  <div className="flex items-start">
                    <Info
                      size={20}
                      className="text-primary-700 mt-0.5 mr-3 shrink-0"
                    />
                    <div>
                      <h4 className="font-medium">Job Information</h4>
                      <p className="text-muted-foreground mt-1 text-sm">
                        This analysis will compare {comparisonGenomes.length}{" "}
                        genome{comparisonGenomes.length !== 1 && "s"} against
                        the reference genome using bidirectional BLASTP.
                        Estimated runtime: 5-10 minutes.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setActiveTab("parameters");
                    setProgress(75);
                  }}
                >
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline">Reset All</Button>
                  <Button className="gap-2 px-6">Submit Analysis</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <div className="mt-8 flex flex-col items-center justify-between border-t pt-6 md:flex-row">
        <div className="text-muted-foreground text-sm">
          Proteome Comparison Service • Version 2.1.5
        </div>
        <div className="mt-4 flex gap-4 md:mt-0">
          <Button variant="link" size="sm" className="text-muted-foreground">
            Help
          </Button>
          <Button variant="link" size="sm" className="text-muted-foreground">
            Feedback
          </Button>
          <Button variant="link" size="sm" className="text-muted-foreground">
            Privacy Policy
          </Button>
        </div>
      </div>
    </div>
  );
}
