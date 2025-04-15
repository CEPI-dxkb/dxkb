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
  SelectValue 
} from "@/components/ui/select";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Info, 
  AlignJustify, 
  FileSymlink, 
  Upload, 
  Code, 
  Settings2, 
  FileText, 
  ChevronRight, 
  Search, 
  PanelRight, 
  Share2,
  HelpCircle,
  BookOpen,
  Code2
} from "lucide-react";

export default function MSAandSNPAnalysisPage() {
  const [sequenceType, setSequenceType] = useState("dna");
  const [progress, setProgress] = useState(10);
  const [activeTab, setActiveTab] = useState("input");
  
  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Modern Header with Gradient */}
      <div className="rounded-xl bg-gradient-to-r from-primary-50 via-background-100 to-accent-50 p-6 mb-8 shadow-sm">
        <div className="flex flex-col md:flex-row items-center justify-between">
          <div className="mb-4 md:mb-0">
            <div className="flex items-center">
              <h1 className="text-2xl md:text-3xl font-bold text-primary-700">
                Multiple Sequence Alignment & SNP Analysis
              </h1>
              <Badge className="ml-3 bg-accent-200 text-accent-800">v2.1</Badge>
            </div>
            <p className="mt-2 text-muted-foreground max-w-2xl">
              Align multiple sequences and identify variations with our advanced analysis tools.
              Compare, analyze, and visualize single nucleotide polymorphisms across genomes.
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
            <Button variant="outline" size="sm" className="gap-2">
              <Share2 size={16} />
              Share
            </Button>
          </div>
        </div>
        
        {/* Workflow Progress Indicator */}
        <div className="mt-6">
          <div className="flex justify-between text-sm mb-1">
            <div className="font-medium">Analysis Workflow</div>
            <div className="text-muted-foreground">Step 1 of 4</div>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <div>Input</div>
            <div>Sequences</div>
            <div>Parameters</div>
            <div>Output</div>
          </div>
        </div>
      </div>

      {/* Main Content with Tabs */}
      <Tabs 
        defaultValue="input" 
        className="w-full" 
        value={activeTab} 
        onValueChange={(value) => {
          setActiveTab(value);
          setProgress(value === "input" ? 10 : value === "sequences" ? 35 : value === "parameters" ? 70 : 95);
        }}
      >
        <TabsList className="grid grid-cols-4 mb-6">
          <TabsTrigger value="input" className="gap-2">
            <FileText size={16} /> Input Data
          </TabsTrigger>
          <TabsTrigger value="sequences" className="gap-2">
            <AlignJustify size={16} /> Sequences
          </TabsTrigger>
          <TabsTrigger value="parameters" className="gap-2">
            <Settings2 size={16} /> Parameters
          </TabsTrigger>
          <TabsTrigger value="output" className="gap-2">
            <PanelRight size={16} /> Output
          </TabsTrigger>
        </TabsList>

        {/* Input Tab */}
        <TabsContent value="input" className="space-y-6">
          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-primary-700">Select Input Type</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div 
                      className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        sequenceType === "dna" 
                          ? "border-primary-500 bg-primary-50" 
                          : "border-border hover:border-primary-200 hover:bg-background-100"
                      }`}
                      onClick={() => setSequenceType("dna")}
                    >
                      <div className="flex items-start">
                        <div className="mr-4 mt-1">
                          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                            <Code2 size={16} className="text-primary-700" />
                          </div>
                        </div>
                        <div>
                          <div className="font-medium">DNA Sequences</div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Analyze nucleotide variations across genomic sequences
                          </p>
                          <Badge className="mt-2 bg-background-200">Nucleotide Analysis</Badge>
                        </div>
                      </div>
                      <div className="absolute top-3 right-3">
                        <RadioGroup value={sequenceType} onValueChange={setSequenceType}>
                          <RadioGroupItem value="dna" />
                        </RadioGroup>
                      </div>
                    </div>
                    
                    <div 
                      className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        sequenceType === "protein" 
                          ? "border-primary-500 bg-primary-50" 
                          : "border-border hover:border-primary-200 hover:bg-background-100"
                      }`}
                      onClick={() => setSequenceType("protein")}
                    >
                      <div className="flex items-start">
                        <div className="mr-4 mt-1">
                          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                            <Code size={16} className="text-primary-700" />
                          </div>
                        </div>
                        <div>
                          <div className="font-medium">Protein Sequences</div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Compare amino acid sequences and identify variations
                          </p>
                          <Badge className="mt-2 bg-background-200">Protein Analysis</Badge>
                        </div>
                      </div>
                      <div className="absolute top-3 right-3">
                        <RadioGroup value={sequenceType} onValueChange={setSequenceType}>
                          <RadioGroupItem value="protein" />
                        </RadioGroup>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-primary-700">Starting Point</h3>
                  
                  <RadioGroup defaultValue="unaligned" className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value="unaligned" id="unaligned" />
                      <div>
                        <Label htmlFor="unaligned" className="font-medium">Unaligned Sequences</Label>
                        <p className="text-sm text-muted-foreground">
                          Start with raw sequences that need alignment before analysis
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value="aligned" id="aligned" />
                      <div>
                        <Label htmlFor="aligned" className="font-medium">Aligned Sequences</Label>
                        <p className="text-sm text-muted-foreground">
                          Use pre-aligned sequences for direct variation analysis
                        </p>
                      </div>
                    </div>
                  </RadioGroup>
                </div>
                
                <div className="flex justify-end pt-4">
                  <Button 
                    onClick={() => {
                      setActiveTab("sequences");
                      setProgress(35);
                    }}
                    className="gap-2"
                  >
                    Continue <ChevronRight size={16} />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <div className="bg-muted/30 rounded-lg p-4 border">
            <div className="flex items-start">
              <Info size={20} className="text-primary-700 shrink-0 mt-0.5 mr-3" />
              <div>
                <h4 className="font-medium">Quick Tips</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  For SNP analysis, nucleotide sequences typically provide the most accurate results. 
                  For functional comparisons, protein sequences may be more suitable.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Sequences Tab */}
        <TabsContent value="sequences" className="space-y-6">
          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <div className="space-y-6">
                <h3 className="text-lg font-semibold mb-4 text-primary-700">Select Data Source</h3>
                
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="feature-group">
                    <AccordionTrigger className="py-3 text-base font-medium">
                      Feature Group
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-4">
                      <div className="space-y-4">
                        <div className="flex flex-col md:flex-row gap-3">
                          <div className="flex-1">
                            <Label className="text-sm mb-1 block">Search for a Feature Group</Label>
                            <div className="flex gap-2">
                              <Input placeholder="Enter feature group name" className="flex-1" />
                              <Button variant="outline">
                                <Search size={16} />
                              </Button>
                            </div>
                          </div>
                          <div className="w-36">
                            <Label className="text-sm mb-1 block">Feature Type</Label>
                            <Select defaultValue="gene">
                              <SelectTrigger>
                                <SelectValue placeholder="Choose type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="gene">Gene</SelectItem>
                                <SelectItem value="cds">CDS</SelectItem>
                                <SelectItem value="mrna">mRNA</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        <div>
                          <div className="text-sm mb-1">Selected Features</div>
                          <div className="bg-muted/20 rounded-md p-3 h-24 flex items-center justify-center text-muted-foreground text-sm">
                            No features selected yet
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  
                  <AccordionItem value="viral-genome">
                    <AccordionTrigger className="py-3 text-base font-medium">
                      Viral Genome Group
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-4">
                      <div className="space-y-4">
                        <div className="flex gap-2">
                          <Select defaultValue="covid">
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select a genome group" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="covid">SARS-CoV-2 Variants</SelectItem>
                              <SelectItem value="influenza">Influenza Strains</SelectItem>
                              <SelectItem value="hepatitis">Hepatitis Viruses</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button variant="outline">
                            <Search size={16} />
                          </Button>
                        </div>
                        
                        <div>
                          <div className="text-sm mb-1">Available Genomes</div>
                          <div className="bg-muted/20 rounded-md p-2 h-32 overflow-y-auto">
                            <div className="flex items-center gap-2 p-2 hover:bg-muted/30 rounded">
                              <Checkbox id="genome1" />
                              <Label htmlFor="genome1" className="text-sm">SARS-CoV-2 Wuhan-Hu-1</Label>
                            </div>
                            <div className="flex items-center gap-2 p-2 hover:bg-muted/30 rounded">
                              <Checkbox id="genome2" />
                              <Label htmlFor="genome2" className="text-sm">SARS-CoV-2 Alpha (B.1.1.7)</Label>
                            </div>
                            <div className="flex items-center gap-2 p-2 hover:bg-muted/30 rounded">
                              <Checkbox id="genome3" />
                              <Label htmlFor="genome3" className="text-sm">SARS-CoV-2 Delta (B.1.617.2)</Label>
                            </div>
                            <div className="flex items-center gap-2 p-2 hover:bg-muted/30 rounded">
                              <Checkbox id="genome4" />
                              <Label htmlFor="genome4" className="text-sm">SARS-CoV-2 Omicron (B.1.1.529)</Label>
                            </div>
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  
                  <AccordionItem value="fasta-file">
                    <AccordionTrigger className="py-3 text-base font-medium">
                      FASTA File Upload
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-4">
                      <div className="space-y-4">
                        <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 text-center hover:bg-muted/50 transition-colors cursor-pointer">
                          <Upload className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                          <p className="text-muted-foreground">Drag and drop files here or click to browse</p>
                          <p className="text-xs text-muted-foreground mt-1">Accepts .fasta, .fa, .fna files</p>
                          <input type="file" multiple className="hidden" />
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex gap-3">
                            <div className="flex items-center space-x-2">
                              <Checkbox id="dna-option" checked={sequenceType === "dna"} />
                              <Label htmlFor="dna-option">DNA</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox id="protein-option" checked={sequenceType === "protein"} />
                              <Label htmlFor="protein-option">Protein</Label>
                            </div>
                          </div>
                          <Button variant="outline" size="sm" className="gap-1">
                            <FileText size={14} />
                            View Example
                          </Button>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  
                  <AccordionItem value="input-sequence">
                    <AccordionTrigger className="py-3 text-base font-medium">
                      Paste Sequence
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-4">
                      <div className="space-y-4">
                        <div>
                          <Label className="text-sm mb-1 block">Enter or paste sequences in FASTA format</Label>
                          <textarea 
                            className="w-full min-h-32 p-3 text-sm font-mono border rounded-md" 
                            placeholder=">Sequence_1&#10;ATCGATCGATCGATCG&#10;>Sequence_2&#10;ATCGATCGCTAGCGTA"
                          ></textarea>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <div className="flex gap-3">
                            <div className="flex items-center space-x-2">
                              <Checkbox id="dna-paste" checked={sequenceType === "dna"} />
                              <Label htmlFor="dna-paste">DNA</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox id="protein-paste" checked={sequenceType === "protein"} />
                              <Label htmlFor="protein-paste">Protein</Label>
                            </div>
                          </div>
                          <Button variant="outline" size="sm">
                            Validate Format
                          </Button>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
                
                <div className="pt-4">
                  <h3 className="text-lg font-semibold mb-4 text-primary-700">Reference Sequence</h3>
                  
                  <RadioGroup defaultValue="none" className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value="none" id="ref-none" />
                      <div>
                        <Label htmlFor="ref-none" className="font-medium">No Reference Sequence</Label>
                        <p className="text-sm text-muted-foreground">
                          Perform alignment without a reference sequence
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value="feature" id="ref-feature" />
                      <div>
                        <Label htmlFor="ref-feature" className="font-medium">Feature ID</Label>
                        <p className="text-sm text-muted-foreground">
                          Use a specific feature as the reference
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value="input" id="ref-input" />
                      <div>
                        <Label htmlFor="ref-input" className="font-medium">Input Reference Sequence</Label>
                        <p className="text-sm text-muted-foreground">
                          Upload or paste a reference sequence
                        </p>
                      </div>
                    </div>
                  </RadioGroup>
                </div>
              </div>
              
              <div className="flex justify-between pt-6">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setActiveTab("input");
                    setProgress(10);
                  }}
                >
                  Back
                </Button>
                <Button 
                  onClick={() => {
                    setActiveTab("parameters");
                    setProgress(70);
                  }}
                  className="gap-2"
                >
                  Continue <ChevronRight size={16} />
                </Button>
              </div>
            </CardContent>
          </Card>
          
          <div className="bg-muted/30 rounded-lg p-4 border">
            <div className="flex items-start">
              <Info size={20} className="text-primary-700 shrink-0 mt-0.5 mr-3" />
              <div>
                <h4 className="font-medium">Sequence Selection Tips</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  For the most accurate SNP analysis, select related sequences from the same species or strain.
                  Including a reference sequence can help identify variants relative to a known standard.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Parameters Tab */}
        <TabsContent value="parameters" className="space-y-6">
          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <div className="space-y-6">
                <h3 className="text-lg font-semibold mb-4 text-primary-700">Alignment Configuration</h3>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <Label className="font-medium" htmlFor="aligner">Alignment Algorithm</Label>
                      <Select defaultValue="mafft">
                        <SelectTrigger id="aligner" className="mt-1">
                          <SelectValue placeholder="Select algorithm" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mafft">MAFFT</SelectItem>
                          <SelectItem value="clustalw">ClustalW</SelectItem>
                          <SelectItem value="muscle">MUSCLE</SelectItem>
                          <SelectItem value="tcoffee">T-Coffee</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        MAFFT provides a good balance of speed and accuracy for most sequence types
                      </p>
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between">
                        <Label className="font-medium">Strategy</Label>
                        <Badge variant="outline">4 options</Badge>
                      </div>
                      
                      <div className="mt-2 border rounded-lg overflow-hidden">
                        <RadioGroup defaultValue="auto" className="space-y-0">
                          <div className="bg-muted/30 p-3 hover:bg-muted/50 cursor-pointer">
                            <div className="flex items-center">
                              <RadioGroupItem value="auto" id="auto-strategy" className="mr-2" />
                              <div>
                                <Label htmlFor="auto-strategy" className="font-medium">Auto</Label>
                                <p className="text-xs text-muted-foreground">
                                  Automatically select optimal strategy based on data size
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          <div className="px-3 py-2 border-t border-b">
                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Progressive Methods
                            </div>
                          </div>
                          
                          <div className="p-3 hover:bg-muted/50 cursor-pointer">
                            <div className="flex items-center">
                              <RadioGroupItem value="fft-ns-1" id="fft-ns-1" className="mr-2" />
                              <div>
                                <Label htmlFor="fft-ns-1" className="font-medium">FFT-NS-1</Label>
                                <p className="text-xs text-muted-foreground">
                                  Very fast, recommended for {"<"}2,000 sequences
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          <div className="p-3 hover:bg-muted/50 cursor-pointer">
                            <div className="flex items-center">
                              <RadioGroupItem value="fft-ns-2" id="fft-ns-2" className="mr-2" />
                              <div>
                                <Label htmlFor="fft-ns-2" className="font-medium">FFT-NS-2</Label>
                                <p className="text-xs text-muted-foreground">
                                  Fast progressive method
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          <div className="px-3 py-2 border-t border-b">
                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Iterative Refinement Methods
                            </div>
                          </div>
                          
                          <div className="p-3 hover:bg-muted/50 cursor-pointer">
                            <div className="flex items-center">
                              <RadioGroupItem value="fft-ns-i" id="fft-ns-i" className="mr-2" />
                              <div>
                                <Label htmlFor="fft-ns-i" className="font-medium">FFT-NS-i</Label>
                                <p className="text-xs text-muted-foreground">
                                  Iterative refinement, better accuracy
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          <div className="p-3 hover:bg-muted/50 cursor-pointer">
                            <div className="flex items-center">
                              <RadioGroupItem value="l-ins-i" id="l-ins-i" className="mr-2" />
                              <div>
                                <Label htmlFor="l-ins-i" className="font-medium">L-INS-i</Label>
                                <p className="text-xs text-muted-foreground">
                                  Very slow, for {"<"}200 sequences with one conserved domain
                                </p>
                              </div>
                            </div>
                          </div>
                        </RadioGroup>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between">
                        <Label className="font-medium">Advanced Options</Label>
                        <Switch />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Configure gap penalties, scoring matrices, and other parameters
                      </p>
                    </div>
                    
                    <div>
                      <Label className="font-medium mb-2 block">Analysis Type</Label>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox id="snp-detection" defaultChecked />
                          <Label htmlFor="snp-detection">SNP Detection</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox id="consensus" defaultChecked />
                          <Label htmlFor="consensus">Generate Consensus Sequence</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox id="phylogeny" />
                          <Label htmlFor="phylogeny">Phylogenetic Analysis</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox id="conservation" />
                          <Label htmlFor="conservation">Conservation Analysis</Label>
                        </div>
                      </div>
                    </div>
                    
                    <div className="pt-4">
                      <div className="flex items-center justify-between">
                        <Label className="font-medium mb-2 block">SNP Filtering Options</Label>
                        <Button variant="outline" size="sm" className="h-7">Defaults</Button>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="quality" className="text-sm">Minimum Quality Score</Label>
                          <div className="w-16">
                            <Input id="quality" type="number" defaultValue="30" className="h-7 text-sm" />
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="coverage" className="text-sm">Minimum Coverage</Label>
                          <div className="w-16">
                            <Input id="coverage" type="number" defaultValue="10" className="h-7 text-sm" />
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="frequency" className="text-sm">Minor Allele Frequency</Label>
                          <div className="w-16">
                            <Input id="frequency" type="number" defaultValue="0.1" step="0.01" className="h-7 text-sm" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="pt-4">
                  <h3 className="text-lg font-semibold mb-4 text-primary-700">Output Options</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label className="font-medium mb-2 block">Output Folder</Label>
                      <div className="flex gap-2">
                        <Input placeholder="/path/to/output" className="flex-1" />
                        <Button variant="outline" size="icon">
                          <FileSymlink size={16} />
                        </Button>
                      </div>
                    </div>
                    
                    <div>
                      <Label className="font-medium mb-2 block">Output Name</Label>
                      <Input placeholder="msa_snp_analysis_result" />
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Label className="font-medium">Output Formats</Label>
                      <Badge variant="outline" className="bg-accent-50">Multiple allowed</Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox id="fasta-out" defaultChecked />
                        <Label htmlFor="fasta-out" className="text-sm">FASTA</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="vcf-out" defaultChecked />
                        <Label htmlFor="vcf-out" className="text-sm">VCF</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="csv-out" />
                        <Label htmlFor="csv-out" className="text-sm">CSV</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="json-out" />
                        <Label htmlFor="json-out" className="text-sm">JSON</Label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between pt-6">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setActiveTab("sequences");
                    setProgress(35);
                  }}
                >
                  Back
                </Button>
                <Button 
                  onClick={() => {
                    setActiveTab("output");
                    setProgress(95);
                  }}
                  className="gap-2"
                >
                  Continue <ChevronRight size={16} />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Output Tab */}
        <TabsContent value="output" className="space-y-6">
          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <div className="space-y-6">
                <h3 className="text-lg font-semibold mb-4 text-primary-700">Analysis Summary</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-background-50 rounded-lg p-4 border shadow-sm">
                    <div className="text-muted-foreground text-sm uppercase font-medium">Input</div>
                    <div className="font-medium mt-1">
                      {sequenceType === "dna" ? "DNA Sequences" : "Protein Sequences"}
                    </div>
                    <div className="text-sm mt-1">Unaligned Sequences</div>
                    <div className="flex items-center gap-1 mt-3 text-muted-foreground text-xs">
                      <FileText size={14} />
                      <span>4 sequences selected</span>
                    </div>
                  </div>
                  
                  <div className="bg-background-50 rounded-lg p-4 border shadow-sm">
                    <div className="text-muted-foreground text-sm uppercase font-medium">Algorithm</div>
                    <div className="font-medium mt-1">MAFFT</div>
                    <div className="text-sm mt-1">FFT-NS-2 Strategy</div>
                    <div className="flex items-center gap-1 mt-3 text-muted-foreground text-xs">
                      <Settings2 size={14} />
                      <span>Standard configuration</span>
                    </div>
                  </div>
                  
                  <div className="bg-background-50 rounded-lg p-4 border shadow-sm">
                    <div className="text-muted-foreground text-sm uppercase font-medium">Output</div>
                    <div className="font-medium mt-1">SNP Analysis</div>
                    <div className="text-sm mt-1">FASTA, VCF Formats</div>
                    <div className="flex items-center gap-1 mt-3 text-muted-foreground text-xs">
                      <FileSymlink size={14} />
                      <span>msa_snp_analysis_result</span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-muted/20 rounded-lg p-4 border">
                  <h4 className="font-medium mb-3">Estimated Resources</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Processing Time</div>
                      <div className="font-medium">~2 minutes</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Memory Usage</div>
                      <div className="font-medium">~500 MB</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Storage Required</div>
                      <div className="font-medium">~25 MB</div>
                    </div>
                  </div>
                </div>
                
                <div className="pt-4">
                  <h3 className="text-lg font-semibold mb-4 text-primary-700">Notification Preferences</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="font-medium">Email Notification</Label>
                        <p className="text-sm text-muted-foreground">Receive an email when analysis is complete</p>
                      </div>
                      <Switch />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="font-medium">Download Results Automatically</Label>
                        <p className="text-sm text-muted-foreground">Download results to your computer when ready</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between pt-6">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setActiveTab("parameters");
                    setProgress(70);
                  }}
                >
                  Back
                </Button>
                <Button className="gap-2 px-8">
                  Submit Analysis
                </Button>
              </div>
            </CardContent>
          </Card>
          
          <div className="bg-muted/30 rounded-lg p-4 border">
            <div className="flex items-start">
              <Info size={20} className="text-primary-700 shrink-0 mt-0.5 mr-3" />
              <div>
                <h4 className="font-medium">Next Steps</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  After the analysis completes, you can visualize alignments, explore SNPs, and download 
                  results in various formats. Results will also be stored in your workspace for future access.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
      
      {/* Footer */}
      <div className="mt-8 flex flex-col md:flex-row justify-between items-center pt-6 border-t">
        <div className="text-sm text-muted-foreground">
          Multiple Sequence Alignment & SNP Analysis • v2.1.3
        </div>
        <div className="flex gap-4 mt-4 md:mt-0">
          <Button variant="link" size="sm" className="text-muted-foreground">Help</Button>
          <Button variant="link" size="sm" className="text-muted-foreground">Feedback</Button>
          <Button variant="link" size="sm" className="text-muted-foreground">Privacy Policy</Button>
        </div>
      </div>
    </div>
  );
}