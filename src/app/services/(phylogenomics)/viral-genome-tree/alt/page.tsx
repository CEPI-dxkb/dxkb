"use client";

import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  FileSymlink, 
  Upload, 
  Trash2, 
  Info, 
  Settings, 
  FileText, 
  Database, 
  BarChart, 
  HelpCircle, 
  MoveRight, 
  Check,
  X
} from "lucide-react";

export default function ViralGenomeTreePage() {
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("input");
  const [metadataFields, setMetadataFields] = useState([
    { name: "Genome ID", selected: true },
    { name: "Genome Name", selected: true },
    { name: "Species", selected: true },
    { name: "Strain", selected: true },
    { name: "Accession", selected: true },
    { name: "Subtype", selected: true },
  ]);

  const toggleMetadataField = (index: number) => {
    const newFields = [...metadataFields];
    newFields[index].selected = !newFields[index].selected;
    setMetadataFields(newFields);
  };

  const addSampleFile = () => {
    const sampleFiles = ["COVID-19_Ref_2023.fasta", "H1N1_Complete_Genome.fasta", "MERS_CoV_Sequences.fasta"];
    const randomFile = sampleFiles[Math.floor(Math.random() * sampleFiles.length)];
    if (!selectedFiles.includes(randomFile)) {
      setSelectedFiles([...selectedFiles, randomFile]);
    }
  };

  const removeFile = (fileName: string) => {
    setSelectedFiles(selectedFiles.filter((file) => file !== fileName));
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Modern Header with Gradient */}
      <div className="rounded-xl bg-gradient-to-r from-primary-100 via-primary-50 to-background-100 p-6 mb-8 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-primary-700 flex items-center">
              Viral Genome Tree
              <Badge className="ml-3 bg-accent-200 text-accent-800">Beta</Badge>
            </h1>
            <p className="mt-2 text-muted-foreground max-w-2xl">
              Create phylogenetic trees from whole genome alignments with our advanced visualization tool.
              Analyze viral evolution and relationships with comprehensive customization options.
            </p>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" size="sm" className="gap-2">
                <HelpCircle size={16} />
                Tutorial
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <FileText size={16} />
                Documentation
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <Database size={16} />
                Example Data
              </Button>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="w-24 h-24 relative">
              <div className="absolute inset-0 bg-primary-200 rounded-full opacity-20 animate-pulse"></div>
              <div className="absolute inset-4 bg-primary-300 rounded-full opacity-40"></div>
              <div className="absolute inset-8 bg-primary-500 rounded-full"></div>
              <BarChart size={24} className="absolute inset-0 m-auto text-white" />
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
        <TabsList className="grid grid-cols-4 mb-6">
          <TabsTrigger value="input" className="gap-2">
            <FileSymlink size={16} /> Input
          </TabsTrigger>
          <TabsTrigger value="alignment" className="gap-2">
            <Settings size={16} /> Alignment
          </TabsTrigger>
          <TabsTrigger value="tree" className="gap-2">
            <BarChart size={16} /> Tree
          </TabsTrigger>
          <TabsTrigger value="metadata" className="gap-2">
            <Database size={16} /> Metadata
          </TabsTrigger>
        </TabsList>

        {/* Input Tab */}
        <TabsContent value="input" className="space-y-6">
          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-primary-700">Select Data Sources</h3>
                  
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="genome-group">
                      <AccordionTrigger className="py-3 text-base font-medium">
                        Select Genome Group
                      </AccordionTrigger>
                      <AccordionContent className="pt-2 pb-4">
                        <div className="flex gap-2">
                          <Select>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Choose a genome group" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="covid">SARS-CoV-2 Variants</SelectItem>
                              <SelectItem value="influenza">Influenza Strains</SelectItem>
                              <SelectItem value="hepC">Hepatitis C Viruses</SelectItem>
                            </SelectContent>
                          </Select>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="icon" variant="outline" className="text-muted-foreground">
                                  <Info size={16} />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">Select from predefined groups of viral genomes</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                    
                    <AccordionItem value="aligned-fasta">
                      <AccordionTrigger className="py-3 text-base font-medium">
                        Upload Aligned FASTA
                      </AccordionTrigger>
                      <AccordionContent className="pt-2 pb-4">
                        <div className="grid gap-4">
                          <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 text-center hover:bg-muted/50 transition-colors cursor-pointer">
                            <Upload className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                            <p className="text-muted-foreground">Drag and drop files here or click to browse</p>
                            <input type="file" multiple className="hidden" />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Accepted formats: .fasta, .fa, .faa, .ffn, .fna, .frn
                          </p>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                    
                    <AccordionItem value="unaligned-fasta">
                      <AccordionTrigger className="py-3 text-base font-medium">
                        Upload Unaligned FASTA
                      </AccordionTrigger>
                      <AccordionContent className="pt-2 pb-4">
                        <div className="grid gap-4">
                          <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 text-center hover:bg-muted/50 transition-colors cursor-pointer">
                            <Upload className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                            <p className="text-muted-foreground">Drag and drop files here or click to browse</p>
                            <input type="file" multiple className="hidden" />
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">
                              Accepted formats: .fasta, .fa, .faa, .ffn, .fna, .frn
                            </p>
                            <Button onClick={addSampleFile} variant="outline" size="sm" className="gap-1">
                              <Database size={14} />
                              Add Sample
                            </Button>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-primary-700">Selected Files</h3>
                  <div className="bg-muted/30 rounded-lg min-h-[240px] p-4 border border-border">
                    {selectedFiles.length > 0 ? (
                      <div className="space-y-2">
                        {selectedFiles.map((file, index) => (
                          <div 
                            key={index} 
                            className="flex justify-between items-center p-3 rounded-md bg-background hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <FileText size={16} className="text-primary-500" />
                              <span className="font-medium">{file}</span>
                            </div>
                            <Button 
                              onClick={() => removeFile(file)} 
                              variant="ghost" 
                              size="icon" 
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                        <FileText size={40} className="mb-2 opacity-20" />
                        <p>No files selected</p>
                        <Button 
                          onClick={addSampleFile} 
                          variant="link" 
                          className="mt-2 text-primary-500"
                        >
                          Add sample files
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  {selectedFiles.length > 0 && (
                    <div className="mt-4 flex justify-end">
                      <Button 
                        onClick={() => setActiveTab("alignment")} 
                        className="gap-2"
                      >
                        Continue to Alignment <MoveRight size={16} />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alignment Tab */}
        <TabsContent value="alignment" className="space-y-6">
          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-primary-700">Alignment Settings</h3>
                  
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="trim-ends" className="font-medium">
                          Trim Ends of Alignment
                        </Label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground">
                                <Info size={14} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">Remove poorly aligned regions at sequence ends</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <Slider defaultValue={[0]} max={100} step={1} />
                        </div>
                        <div className="w-16">
                          <Input type="number" defaultValue="0" className="h-8" />
                        </div>
                        <Select defaultValue="percent">
                          <SelectTrigger className="w-[100px] h-8">
                            <SelectValue placeholder="Unit" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percent">Percent</SelectItem>
                            <SelectItem value="bases">Bases</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="remove-gappy" className="font-medium">
                          Remove Gappy Sequences
                        </Label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground">
                                <Info size={14} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">Filter out sequences with too many gaps</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <Slider defaultValue={[0]} max={100} step={1} />
                        </div>
                        <div className="w-16">
                          <Input type="number" defaultValue="0" className="h-8" />
                        </div>
                        <Select defaultValue="percent">
                          <SelectTrigger className="w-[100px] h-8">
                            <SelectValue placeholder="Unit" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percent">Percent</SelectItem>
                            <SelectItem value="bases">Bases</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="font-medium">Advanced Alignment Options</Label>
                        <Switch />
                      </div>
                      
                      <div className="bg-muted/30 rounded-md p-3 text-sm text-muted-foreground">
                        Enable to access additional alignment parameters such as gap penalties, 
                        substitution matrices, and iteration settings.
                      </div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-primary-700">Alignment Preview</h3>
                  
                  <div className="bg-muted/30 rounded-lg min-h-[240px] p-4 border border-border">
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                      <p className="text-center">
                        Alignment preview will be available after parameters are applied.
                      </p>
                      <div className="flex gap-2 mt-4">
                        <Button variant="outline" size="sm">Preview Sample</Button>
                        <Button variant="outline" size="sm" className="gap-1">
                          <Settings size={14} />
                          Algorithm Settings
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-6 flex justify-between">
                    <Button 
                      onClick={() => setActiveTab("input")} 
                      variant="outline"
                    >
                      Back to Input
                    </Button>
                    <Button 
                      onClick={() => setActiveTab("tree")} 
                      className="gap-2"
                    >
                      Continue to Tree Options <MoveRight size={16} />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tree Tab */}
        <TabsContent value="tree" className="space-y-6">
          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-primary-700">Tree Building Method</h3>
                  
                  <div className="space-y-6">
                    <div className="bg-background rounded-lg border p-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="flex flex-col items-center gap-2">
                          <div className="h-20 w-full rounded-md flex items-center justify-center bg-primary-50 hover:bg-primary-100 border-2 border-transparent hover:border-primary-300 cursor-pointer transition-all">
                            <div className="text-center">
                              <div className="font-medium text-primary-700">RAxML</div>
                              <div className="text-xs text-muted-foreground mt-1">Maximum Likelihood</div>
                            </div>
                          </div>
                          <Checkbox id="raxml" />
                        </div>
                        
                        <div className="flex flex-col items-center gap-2">
                          <div className="h-20 w-full rounded-md flex items-center justify-center bg-primary-50 hover:bg-primary-100 border-2 border-transparent hover:border-primary-300 cursor-pointer transition-all">
                            <div className="text-center">
                              <div className="font-medium text-primary-700">PhyML</div>
                              <div className="text-xs text-muted-foreground mt-1">Phylogenetic ML</div>
                            </div>
                          </div>
                          <Checkbox id="phyml" />
                        </div>
                        
                        <div className="flex flex-col items-center gap-2">
                          <div className="h-20 w-full rounded-md flex items-center justify-center bg-primary-50 hover:bg-primary-100 border-2 border-transparent hover:border-primary-300 cursor-pointer transition-all">
                            <div className="text-center">
                              <div className="font-medium text-primary-700">FastTree</div>
                              <div className="text-xs text-muted-foreground mt-1">Approximate ML</div>
                            </div>
                          </div>
                          <Checkbox id="fasttree" checked />
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <Label className="font-medium">Evolutionary Model</Label>
                      <Select defaultValue="gtr">
                        <SelectTrigger>
                          <SelectValue placeholder="Select model" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gtr">GTR (General Time Reversible)</SelectItem>
                          <SelectItem value="jc69">JC69 (Jukes-Cantor)</SelectItem>
                          <SelectItem value="k80">K80 (Kimura)</SelectItem>
                          <SelectItem value="hky85">HKY85 (Hasegawa-Kishino-Yano)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        The GTR model accounts for different rates of nucleotide substitution and different nucleotide frequencies.
                      </p>
                    </div>
                    
                    <div className="space-y-3">
                      <Label className="font-medium">Output Options</Label>
                      
                      <div className="grid gap-3">
                        <div>
                          <Label className="text-sm text-muted-foreground mb-1 block">Output Folder</Label>
                          <div className="flex gap-2">
                            <Input placeholder="/path/to/output" className="flex-1" />
                            <Button variant="outline" size="icon">
                              <FileSymlink size={16} />
                            </Button>
                          </div>
                        </div>
                        
                        <div>
                          <Label className="text-sm text-muted-foreground mb-1 block">Output Name</Label>
                          <Input placeholder="viral_phylogeny_result" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-primary-700">Tree Settings</h3>
                  
                  <div className="space-y-4">
                    <div className="bg-muted/30 rounded-lg min-h-[250px] p-4 border border-border">
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <Checkbox id="bootstrap" />
                          <div>
                            <Label htmlFor="bootstrap" className="font-medium">Bootstrap Analysis</Label>
                            <p className="text-xs text-muted-foreground">
                              Assess tree reliability with bootstrap resampling
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <Checkbox id="outgroup" />
                          <div>
                            <Label htmlFor="outgroup" className="font-medium">Use Outgroup</Label>
                            <p className="text-xs text-muted-foreground">
                              Root tree using a specified outgroup sequence
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <Checkbox id="branch-lengths" checked />
                          <div>
                            <Label htmlFor="branch-lengths" className="font-medium">Show Branch Lengths</Label>
                            <p className="text-xs text-muted-foreground">
                              Display evolutionary distances on tree branches
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <Checkbox id="consensus" />
                          <div>
                            <Label htmlFor="consensus" className="font-medium">Generate Consensus Tree</Label>
                            <p className="text-xs text-muted-foreground">
                              Create a consensus tree from multiple analyses
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-primary-50 rounded-lg p-4 border border-primary-200">
                      <h4 className="text-sm font-medium text-primary-700 mb-2">Recommended Settings</h4>
                      <p className="text-xs text-muted-foreground">
                        For viral genome analysis, FastTree with GTR model is recommended 
                        for faster computation with comparable accuracy to RAxML.
                      </p>
                      <Button className="mt-3 w-full" size="sm" variant="outline">
                        Apply Recommended Settings
                      </Button>
                    </div>
                  </div>
                  
                  <div className="mt-6 flex justify-between">
                    <Button 
                      onClick={() => setActiveTab("alignment")} 
                      variant="outline"
                    >
                      Back to Alignment
                    </Button>
                    <Button 
                      onClick={() => setActiveTab("metadata")} 
                      className="gap-2"
                    >
                      Continue to Metadata <MoveRight size={16} />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Metadata Tab */}
        <TabsContent value="metadata" className="space-y-6">
          <Card className="border-0 shadow-md">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-primary-700">Metadata Configuration</h3>
                  
                  <div className="space-y-6">
                    <div>
                      <p className="text-sm text-muted-foreground mb-4">
                        These fields will appear as options in the phylogeny visualization.
                        Select which metadata fields to include in your tree visualization.
                      </p>
                      
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="font-medium">Genome ID</Label>
                          <Switch checked={metadataFields[0].selected} onCheckedChange={() => toggleMetadataField(0)} />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="font-medium">Genome Name</Label>
                          <Switch checked={metadataFields[1].selected} onCheckedChange={() => toggleMetadataField(1)} />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="font-medium">Species</Label>
                          <Switch checked={metadataFields[2].selected} onCheckedChange={() => toggleMetadataField(2)} />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="font-medium">Strain</Label>
                          <Switch checked={metadataFields[3].selected} onCheckedChange={() => toggleMetadataField(3)} />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="font-medium">Accession</Label>
                          <Switch checked={metadataFields[4].selected} onCheckedChange={() => toggleMetadataField(4)} />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="font-medium">Subtype</Label>
                          <Switch checked={metadataFields[5].selected} onCheckedChange={() => toggleMetadataField(5)} />
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <Label className="font-medium">Add Custom Metadata</Label>
                        <Button variant="outline" size="sm" className="gap-1">
                          <Database size={14} />
                          Import CSV
                        </Button>
                      </div>
                      
                      <div className="flex gap-2">
                        <Input placeholder="Field name" className="flex-1" />
                        <Button>Add Field</Button>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-primary-700">Visualization Preview</h3>
                  
                  <div className="bg-muted/30 rounded-lg min-h-[240px] p-4 border border-border">
                    <div className="h-full flex flex-col items-center justify-center">
                      <div className="w-32 h-32 relative">
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="animate-pulse opacity-30">
                            <svg width="100" height="100" viewBox="0 0 100 100">
                              <line x1="50" y1="20" x2="20" y2="80" strokeWidth="2" stroke="currentColor" />
                              <line x1="50" y1="20" x2="80" y2="80" strokeWidth="2" stroke="currentColor" />
                              <line x1="20" y1="80" x2="10" y2="60" strokeWidth="2" stroke="currentColor" />
                              <line x1="20" y1="80" x2="30" y2="60" strokeWidth="2" stroke="currentColor" />
                              <line x1="80" y1="80" x2="70" y2="60" strokeWidth="2" stroke="currentColor" />
                              <line x1="80" y1="80" x2="90" y2="60" strokeWidth="2" stroke="currentColor" />
                              <circle cx="50" cy="20" r="3" fill="currentColor" />
                              <circle cx="20" cy="80" r="3" fill="currentColor" />
                              <circle cx="80" cy="80" r="3" fill="currentColor" />
                              <circle cx="10" cy="60" r="3" fill="currentColor" />
                              <circle cx="30" cy="60" r="3" fill="currentColor" />
                              <circle cx="70" cy="60" r="3" fill="currentColor" />
                              <circle cx="90" cy="60" r="3" fill="currentColor" />
                            </svg>
                          </div>
                        </div>
                      </div>
                      <p className="text-center text-muted-foreground mt-4">
                        Tree visualization with metadata will appear here
                      </p>
                      <div className="mt-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline">Visualization Options</Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuLabel>Tree Display</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                              <Check size={16} className="mr-2" /> Rectangular Layout
                            </DropdownMenuItem>
                            <DropdownMenuItem>Circular Layout</DropdownMenuItem>
                            <DropdownMenuItem>Radial Layout</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>Color by Taxonomy</DropdownMenuItem>
                            <DropdownMenuItem>Show Scale Bar</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-6 flex justify-between">
                    <Button 
                      onClick={() => setActiveTab("tree")} 
                      variant="outline"
                    >
                      Back to Tree Options
                    </Button>
                    <Button className="gap-2">
                      Submit Analysis <MoveRight size={16} />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Footer */}
      <div className="mt-8 flex flex-col md:flex-row justify-between items-center pt-6 border-t">
        <div className="text-sm text-muted-foreground">
          Viral Genome Tree Service • Version 2.4.1
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