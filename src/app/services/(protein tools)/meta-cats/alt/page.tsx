"use client";

import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FileSymlink,
  Upload,
  ChevronRight,
  Search,
  Settings,
  HelpCircle,
  BookOpen,
  Layers,
  AlertCircle,
  PlusCircle,
  Trash2,
  BarChart,
  TableProperties,
  FileEdit,
} from "lucide-react";
import { CiCircleInfo } from "react-icons/ci";

export default function MetaCATSPage() {
  const [activeTab, setActiveTab] = useState("input");
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [selectedMethod, setSelectedMethod] = useState("auto");

  return (
    <div className="container mx-auto max-w-6xl p-6">
      {/* Modern Header with Gradient */}
      <div className="from-primary-50 via-secondary-50 to-background-100 mb-8 rounded-xl bg-gradient-to-r p-6 shadow-sm">
        <div className="flex flex-col items-center justify-between md:flex-row">
          <div className="mb-4 md:mb-0">
            <div className="flex items-center">
              <h1 className="text-primary-700 flex items-center gap-2 text-2xl font-bold md:text-3xl">
                Meta-CATS
                <Badge className="bg-secondary-200 text-secondary-800 ml-2">
                  v3.2
                </Badge>
              </h1>
              <span className="text-muted-foreground ml-2 text-lg">
                Metadata-driven Comparative Analysis Tool
              </span>
            </div>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              Identify positions with significant differences between sequence
              groups based on metadata attributes
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

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="flex items-start rounded-lg bg-white/60 p-4 shadow-sm">
            <div className="bg-primary-100 mt-1 mr-3 rounded-full p-2">
              <Layers size={20} className="text-primary-700" />
            </div>
            <div>
              <h3 className="font-medium">Group Comparison</h3>
              <p className="text-muted-foreground text-sm">
                Analyze differences between metadata-defined sequence groups
              </p>
            </div>
          </div>

          <div className="flex items-start rounded-lg bg-white/60 p-4 shadow-sm">
            <div className="bg-secondary-100 mt-1 mr-3 rounded-full p-2">
              <BarChart size={20} className="text-secondary-700" />
            </div>
            <div>
              <h3 className="font-medium">Statistical Analysis</h3>
              <p className="text-muted-foreground text-sm">
                Identify statistically significant positional differences
              </p>
            </div>
          </div>

          <div className="flex items-start rounded-lg bg-white/60 p-4 shadow-sm">
            <div className="bg-accent-100 mt-1 mr-3 rounded-full p-2">
              <TableProperties size={20} className="text-accent-700" />
            </div>
            <div>
              <h3 className="font-medium">Metadata Integration</h3>
              <p className="text-muted-foreground text-sm">
                Incorporate host, geography, and temporal factors
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content with Tabs */}
      <Tabs
        defaultValue="input"
        className="w-full"
        value={activeTab}
        onValueChange={setActiveTab}
      >
        <TabsList className="mb-6 grid grid-cols-3">
          <TabsTrigger value="input" className="gap-2">
            <FileEdit size={16} /> Input & Groups
          </TabsTrigger>
          <TabsTrigger value="parameters" className="gap-2">
            <Settings size={16} /> Parameters
          </TabsTrigger>
          <TabsTrigger value="results" className="gap-2">
            <BarChart size={16} /> Results Preview
          </TabsTrigger>
        </TabsList>

        {/* Input Tab */}
        <TabsContent value="input" className="space-y-6">
          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <div className="mb-6">
                <h3 className="text-primary-700 mb-4 text-lg font-semibold">
                  Data Selection
                </h3>

                <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <RadioGroup
                    value={selectedMethod}
                    onValueChange={setSelectedMethod}
                    className="contents"
                  >
                    <div className="border-primary-200 bg-primary-50 relative cursor-pointer rounded-lg border-2 p-4">
                      <div className="flex items-start">
                        <div className="mt-1 mr-4">
                          <div className="bg-primary-100 flex h-8 w-8 items-center justify-center rounded-full">
                            <Settings size={16} className="text-primary-700" />
                          </div>
                        </div>
                        <div>
                          <div className="font-medium">Auto Grouping</div>
                          <p className="text-muted-foreground mt-1 text-sm">
                            Automatically group sequences based on metadata
                          </p>
                        </div>
                      </div>
                      <div className="absolute top-3 right-3">
                        <RadioGroupItem value="auto" id="auto" />
                      </div>
                    </div>

                    <div className="border-border hover:border-primary-200 hover:bg-background-100 relative cursor-pointer rounded-lg border-2 p-4">
                      <div className="flex items-start">
                        <div className="mt-1 mr-4">
                          <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-full">
                            <Layers
                              size={16}
                              className="text-muted-foreground"
                            />
                          </div>
                        </div>
                        <div>
                          <div className="font-medium">Feature Groups</div>
                          <p className="text-muted-foreground mt-1 text-sm">
                            Select from defined feature groups
                          </p>
                        </div>
                      </div>
                      <div className="absolute top-3 right-3">
                        <RadioGroupItem value="feature" id="feature" />
                      </div>
                    </div>

                    <div className="border-border hover:border-primary-200 hover:bg-background-100 relative cursor-pointer rounded-lg border-2 p-4">
                      <div className="flex items-start">
                        <div className="mt-1 mr-4">
                          <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-full">
                            <FileEdit
                              size={16}
                              className="text-muted-foreground"
                            />
                          </div>
                        </div>
                        <div>
                          <div className="font-medium">Alignment File</div>
                          <p className="text-muted-foreground mt-1 text-sm">
                            Use your own alignment file
                          </p>
                        </div>
                      </div>
                      <div className="absolute top-3 right-3">
                        <RadioGroupItem value="alignment" id="alignment" />
                      </div>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              <div>
                <h3 className="text-primary-700 mb-4 text-lg font-semibold">
                  Metadata Grouping
                </h3>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <div>
                      <Label className="mb-2 block font-medium">
                        Metadata Field
                      </Label>
                      <Select defaultValue="host">
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select metadata field" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="host">Host Name</SelectItem>
                          <SelectItem value="strain">Strain</SelectItem>
                          <SelectItem value="geography">
                            Geographic Location
                          </SelectItem>
                          <SelectItem value="collection">
                            Collection Date
                          </SelectItem>
                          <SelectItem value="custom">
                            Custom Field...
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-muted-foreground mt-1 text-xs">
                        Select the metadata attribute to use for grouping
                        sequences
                      </p>
                    </div>

                    <div>
                      <Label className="mb-2 block font-medium">
                        Group Configuration
                      </Label>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox id="auto-detect" defaultChecked />
                          <Label htmlFor="auto-detect">
                            Auto-detect groups
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox id="custom-groups" />
                          <Label htmlFor="custom-groups">
                            Define custom groups
                          </Label>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <Label className="font-medium">Advanced Options</Label>
                        <Switch />
                      </div>
                      <div className="bg-muted/30 text-muted-foreground rounded-md p-3 text-sm">
                        Enable to access additional grouping options like
                        hierarchical clustering, value thresholds, and date
                        range selection.
                      </div>
                    </div>

                    <div>
                      <Label className="mb-2 block font-medium">
                        Sequence Type
                      </Label>
                      <div className="flex gap-4">
                        <div className="flex items-center space-x-2">
                          <Checkbox id="dna" defaultChecked />
                          <Label htmlFor="dna">DNA</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox id="protein" />
                          <Label htmlFor="protein">Protein</Label>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label className="mb-2 block font-medium">
                        Group Names
                      </Label>
                      <div className="mb-2 flex items-center gap-2">
                        <Select defaultValue="group1">
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select group" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="group1">
                              Mammalian Hosts
                            </SelectItem>
                            <SelectItem value="group2">Avian Hosts</SelectItem>
                            <SelectItem value="group3">Other Hosts</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button className="shrink-0">Change group</Button>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="gap-1">
                          <PlusCircle size={14} />
                          Add Group
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1">
                          <Trash2 size={14} />
                          Delete
                        </Button>
                      </div>
                    </div>

                    <div>
                      <Label className="mb-2 block font-medium">
                        Current Groups
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        <Badge className="bg-primary-100 text-primary-800 hover:bg-primary-200">
                          Mammalian Hosts (12)
                        </Badge>
                        <Badge className="bg-secondary-100 text-secondary-800 hover:bg-secondary-200">
                          Avian Hosts (8)
                        </Badge>
                        <Badge className="bg-accent-100 text-accent-800 hover:bg-accent-200">
                          Other Hosts (5)
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-primary-700 text-lg font-semibold">
                  Selected Sequences
                </h3>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-1">
                    <Search size={14} />
                    Filter
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1">
                    <Upload size={14} />
                    Import
                  </Button>
                </div>
              </div>

              <div className="mb-4 overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox />
                      </TableHead>
                      <TableHead>Genbank Accession</TableHead>
                      <TableHead>Strain</TableHead>
                      <TableHead>Metadata</TableHead>
                      <TableHead>Group</TableHead>
                      <TableHead>
                        <div className="flex items-center">
                          SRC ID
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <CiCircleInfo
                                  size={14}
                                  className="text-muted-foreground ml-1"
                                />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">Source identifier</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="flex items-center">
                          Genome ID
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <CiCircleInfo
                                  size={14}
                                  className="text-muted-foreground ml-1"
                                />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">Genome identifier</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-muted-foreground py-8 text-center"
                      >
                        No results found. Apply filters or import sequences to
                        begin.
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="text-muted-foreground">0 - 0 of 0 results</div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    Clear Selection
                  </Button>
                  <Button variant="outline" size="sm">
                    Delete Selected
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="mt-4 flex justify-end">
            <Button
              onClick={() => setActiveTab("parameters")}
              className="gap-2"
            >
              Continue to Parameters <ChevronRight size={16} />
            </Button>
          </div>
        </TabsContent>

        {/* Parameters Tab */}
        <TabsContent value="parameters" className="space-y-6">
          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <div className="mb-6">
                <h3 className="text-primary-700 mb-4 text-lg font-semibold">
                  Statistical Parameters
                </h3>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <div>
                      <Label className="mb-2 block font-medium">
                        Significance Threshold (p-value)
                      </Label>
                      <div className="flex items-center gap-4">
                        <Input
                          type="number"
                          defaultValue="0.05"
                          min="0.001"
                          max="0.1"
                          step="0.001"
                          className="w-36"
                        />
                        <div className="text-muted-foreground flex-1 text-sm">
                          Lower values indicate higher significance
                        </div>
                      </div>
                    </div>

                    <div className="pt-2">
                      <Label className="mb-2 block font-medium">
                        Statistical Test
                      </Label>
                      <Select defaultValue="chi-square">
                        <SelectTrigger>
                          <SelectValue placeholder="Select test" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="chi-square">
                            Chi-square Test
                          </SelectItem>
                          <SelectItem value="fisher">
                            Fisher's Exact Test
                          </SelectItem>
                          <SelectItem value="g-test">G-test</SelectItem>
                          <SelectItem value="mcnemar">
                            McNemar's Test
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-muted-foreground mt-1 text-xs">
                        Chi-square test is recommended for most analyses
                      </p>
                    </div>

                    <div className="pt-2">
                      <Label className="mb-2 block font-medium">
                        Multiple Testing Correction
                      </Label>
                      <Select defaultValue="bonferroni">
                        <SelectTrigger>
                          <SelectValue placeholder="Select correction method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bonferroni">Bonferroni</SelectItem>
                          <SelectItem value="bh">Benjamini-Hochberg</SelectItem>
                          <SelectItem value="holm">Holm-Bonferroni</SelectItem>
                          <SelectItem value="none">None</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-muted-foreground mt-1 text-xs">
                        Controls for false positives when testing multiple
                        positions
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <Label className="font-medium">
                          Advanced Statistical Options
                        </Label>
                        <Switch />
                      </div>
                      <div className="bg-muted/30 text-muted-foreground rounded-md p-3 text-sm">
                        Enable to access bootstrapping, permutation tests, and
                        other advanced statistical methods.
                      </div>
                    </div>

                    <div className="pt-2">
                      <Label className="mb-2 block font-medium">
                        Minimum Group Size
                      </Label>
                      <Input
                        type="number"
                        defaultValue="5"
                        min="3"
                        className="w-full"
                      />
                      <p className="text-muted-foreground mt-1 text-xs">
                        Minimum number of sequences required per group
                        (recommended: 5+)
                      </p>
                    </div>

                    <div className="pt-2">
                      <Label className="mb-2 block font-medium">
                        Low Coverage Filter
                      </Label>
                      <div className="flex items-center justify-between">
                        <div className="text-sm">
                          Filter positions with low coverage
                        </div>
                        <Switch defaultChecked />
                      </div>
                      <p className="text-muted-foreground mt-1 text-xs">
                        Removes positions with insufficient data for reliable
                        comparison
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <h3 className="text-primary-700 mb-4 text-lg font-semibold">
                  Output Configuration
                </h3>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div>
                    <Label className="mb-2 block font-medium">
                      Output Folder
                    </Label>
                    <div className="flex gap-2">
                      <Input placeholder="/path/to/output" className="flex-1" />
                      <Button variant="outline" size="icon">
                        <FileSymlink size={16} />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label className="mb-2 block font-medium">
                      Output Name
                    </Label>
                    <Input placeholder="meta_cats_analysis_result" />
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Label className="font-medium">Output Formats</Label>
                    <Badge variant="outline" className="bg-accent-50">
                      Multiple allowed
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="csv-out" defaultChecked />
                      <Label htmlFor="csv-out" className="text-sm">
                        CSV
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="json-out" defaultChecked />
                      <Label htmlFor="json-out" className="text-sm">
                        JSON
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="html-out" />
                      <Label htmlFor="html-out" className="text-sm">
                        HTML Report
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="tsv-out" />
                      <Label htmlFor="tsv-out" className="text-sm">
                        TSV
                      </Label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <h3 className="text-primary-700 mb-4 text-lg font-semibold">
                  Visualization Options
                </h3>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="heat-map" defaultChecked />
                    <div>
                      <Label htmlFor="heat-map" className="font-medium">
                        Generate Heatmap
                      </Label>
                      <p className="text-muted-foreground text-xs">
                        Visual representation of significant positions
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox id="position-plot" defaultChecked />
                    <div>
                      <Label htmlFor="position-plot" className="font-medium">
                        Position Plot
                      </Label>
                      <p className="text-muted-foreground text-xs">
                        Plot p-values across sequence positions
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox id="aa-freq" defaultChecked />
                    <div>
                      <Label htmlFor="aa-freq" className="font-medium">
                        Residue Frequency Tables
                      </Label>
                      <p className="text-muted-foreground text-xs">
                        Show frequency distribution for each position
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox id="alignment-view" />
                    <div>
                      <Label htmlFor="alignment-view" className="font-medium">
                        Interactive Alignment View
                      </Label>
                      <p className="text-muted-foreground text-xs">
                        Visual alignment with highlighted differences
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-6">
                <Button variant="outline" onClick={() => setActiveTab("input")}>
                  Back
                </Button>
                <Button
                  onClick={() => setActiveTab("results")}
                  className="gap-2"
                >
                  Continue to Results Preview <ChevronRight size={16} />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Results Preview Tab */}
        <TabsContent value="results" className="space-y-6">
          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <div className="mb-6">
                <h3 className="text-primary-700 mb-4 text-lg font-semibold">
                  Analysis Preview
                </h3>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="bg-muted/10 rounded-lg border p-4">
                    <div className="text-muted-foreground text-sm font-medium uppercase">
                      Input
                    </div>
                    <div className="mt-1 font-medium">Metadata Grouping</div>
                    <div className="mt-1 text-sm">Host-based comparison</div>
                    <div className="mt-3 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Groups:</span>
                        <span>3</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Sequences:
                        </span>
                        <span>25 (estimated)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Type:</span>
                        <span>DNA</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-muted/10 rounded-lg border p-4">
                    <div className="text-muted-foreground text-sm font-medium uppercase">
                      Parameters
                    </div>
                    <div className="mt-1 font-medium">Statistical Analysis</div>
                    <div className="mt-1 text-sm">
                      Chi-square with Bonferroni correction
                    </div>
                    <div className="mt-3 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">p-value:</span>
                        <span>0.05</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Min. group size:
                        </span>
                        <span>5</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Coverage filter:
                        </span>
                        <span>Enabled</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-muted/10 rounded-lg border p-4">
                    <div className="text-muted-foreground text-sm font-medium uppercase">
                      Output
                    </div>
                    <div className="mt-1 font-medium">
                      Results & Visualization
                    </div>
                    <div className="mt-1 text-sm">
                      CSV, JSON with visualizations
                    </div>
                    <div className="mt-3 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Est. positions:
                        </span>
                        <span>~450</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Est. significant:
                        </span>
                        <span>15-25</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Runtime:</span>
                        <span>~2 minutes</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-primary-700 mb-4 text-lg font-semibold">
                  Group Information Summary
                </h3>

                <div className="overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Group Name</TableHead>
                        <TableHead>Sequences (est.)</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Metadata Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">
                          Mammalian Hosts
                        </TableCell>
                        <TableCell>12</TableCell>
                        <TableCell>
                          Sequences from mammalian host species
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-primary-100 text-primary-800">
                            Host: Mammal
                          </Badge>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">
                          Avian Hosts
                        </TableCell>
                        <TableCell>8</TableCell>
                        <TableCell>Sequences from avian host species</TableCell>
                        <TableCell>
                          <Badge className="bg-secondary-100 text-secondary-800">
                            Host: Avian
                          </Badge>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">
                          Other Hosts
                        </TableCell>
                        <TableCell>5</TableCell>
                        <TableCell>Sequences from other host types</TableCell>
                        <TableCell>
                          <Badge className="bg-accent-100 text-accent-800">
                            Host: Other
                          </Badge>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="mb-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-primary-700 text-lg font-semibold">
                    Expected Results Preview
                  </h3>
                  <Button variant="outline" size="sm">
                    Load Sample Data
                  </Button>
                </div>

                <div className="bg-muted/20 border-muted-foreground/30 flex flex-col items-center justify-center rounded-lg border border-dashed p-6">
                  <AlertCircle
                    size={48}
                    className="text-muted-foreground/50 mb-4"
                  />
                  <p className="text-muted-foreground max-w-md text-center">
                    Results preview will be available after analysis is run.
                    Submit the analysis to generate results including
                    significant positions, p-values, and visualizations.
                  </p>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <Button
                  variant="outline"
                  onClick={() => setActiveTab("parameters")}
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
          Meta-CATS: Metadata-driven Comparative Analysis Tool • v3.2.4
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
