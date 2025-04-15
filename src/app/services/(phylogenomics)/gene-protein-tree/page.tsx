"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, X } from "lucide-react";
import { CiCircleInfo } from "react-icons/ci";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function GeneProteinTreePage() {
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [metadataFields, setMetadataFields] = useState([
    { name: "Genome ID", selected: true },
    { name: "Genome Name", selected: true },
    { name: "Species", selected: true },
    { name: "Strain", selected: true },
    { name: "Accession", selected: true },
    { name: "Subtype", selected: true },
  ]);

  const handleFileSelect = (fileName: string) => {
    setSelectedFiles([...selectedFiles, fileName]);
  };

  const removeFile = (fileName: string) => {
    setSelectedFiles(selectedFiles.filter((file) => file !== fileName));
  };

  const toggleMetadataField = (index: number) => {
    const newFields = [...metadataFields];
    newFields[index].selected = !newFields[index].selected;
    setMetadataFields(newFields);
  };

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-primary-700 flex items-center justify-center gap-2">
          Gene / Protein Tree
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <CiCircleInfo size={18} className="text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">Information about Gene/Protein Tree service</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </h1>
        <div className="flex justify-center space-x-2 mt-1">
          <a href="#" className="text-primary-500 hover:underline">
            <Badge variant="outline" className="bg-primary-50">LinkedIn</Badge>
          </a>
          <a href="#" className="text-primary-500 hover:underline">
            <Badge variant="outline" className="bg-primary-50">GitHub</Badge>
          </a>
        </div>
        <p className="mt-3 text-sm text-muted-foreground max-w-3xl mx-auto">
          The Gene / Protein Tree Service enables construction of custom phylogenetic trees built from user-selected genes or proteins.
          For further explanation, please see the Gene / Protein Tree Service Quick Reference Guide, Tutorial and Instructional Video.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Input Section */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              Input
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <CiCircleInfo size={16} className="text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">Choose fasta file or features for the tree</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
            <CardDescription>Choose fasta file or features for tree.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <RadioGroup defaultValue="dna" className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="dna" id="dna" />
                    <Label htmlFor="dna">DNA</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="protein" id="protein" />
                    <Label htmlFor="protein">Protein</Label>
                  </div>
                </RadioGroup>
              </div>
              
              <div>
                <div className="flex items-center mb-1">
                  <Label className="text-xs uppercase tracking-wider">Feature Group</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <CiCircleInfo size={14} className="ml-1 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">Select a feature group</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="flex gap-2">
                  <Input placeholder="Optional" className="text-sm" />
                  <Button size="icon" variant="outline">
                    <Upload size={16} />
                  </Button>
                  <Button size="icon" variant="outline">
                    <CiCircleInfo size={16} />
                  </Button>
                </div>
              </div>

              <div>
                <div className="flex items-center mb-1">
                  <Label className="text-xs uppercase tracking-wider">Uploaded Aligned Fasta</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <CiCircleInfo size={14} className="ml-1 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">Upload already aligned fasta files</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="flex gap-2">
                  <Input placeholder="Optional" className="text-sm" />
                  <Button size="icon" variant="outline">
                    <Upload size={16} />
                  </Button>
                  <Button size="icon" variant="outline">
                    <CiCircleInfo size={16} />
                  </Button>
                </div>
              </div>

              <div>
                <div className="flex items-center mb-1">
                  <Label className="text-xs uppercase tracking-wider">Submitted Unaligned Fasta</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <CiCircleInfo size={14} className="ml-1 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">Upload unaligned fasta files</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="flex gap-2">
                  <Input placeholder="Optional" className="text-sm" />
                  <Button size="icon" variant="outline">
                    <Upload size={16} />
                  </Button>
                  <Button size="icon" variant="outline">
                    <CiCircleInfo size={16} />
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-xs uppercase tracking-wider mb-1 block">Selected Files/Feature Group</Label>
                <div className="bg-gray-50 border rounded-md p-2 min-h-[120px]">
                  {selectedFiles.length > 0 ? (
                    <div className="space-y-1">
                      {selectedFiles.map((file, index) => (
                        <div key={index} className="flex justify-between items-center bg-white px-2 py-1 rounded">
                          <span className="text-sm truncate">{file}</span>
                          <Button variant="ghost" size="icon" onClick={() => removeFile(file)}>
                            <X size={14} />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-muted-foreground text-sm h-full flex items-center justify-center">
                      No files or features selected
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Column - Parameters */}
        <div className="space-y-4">
          {/* Alignment Parameters */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                Alignment Parameters
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <CiCircleInfo size={16} className="text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Set parameters for sequence alignment</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs uppercase tracking-wider mb-1 block">Trim Ends of Alignment Threshold</Label>
                  <div className="flex gap-2">
                    <Input type="number" defaultValue="0" className="text-sm" />
                    <Select defaultValue="option1">
                      <SelectTrigger className="w-[120px]">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="option1">Percent</SelectItem>
                        <SelectItem value="option2">Bases</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs uppercase tracking-wider mb-1 block">Remove Gappy Sequences Threshold</Label>
                  <div className="flex gap-2">
                    <Input type="number" defaultValue="0" className="text-sm" />
                    <Select defaultValue="option1">
                      <SelectTrigger className="w-[120px]">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="option1">Percent</SelectItem>
                        <SelectItem value="option2">Bases</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tree Parameters */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                Tree Parameters
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <CiCircleInfo size={16} className="text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Set parameters for the phylogenetic tree</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex items-center">
                    <Checkbox id="raxml" />
                    <Label htmlFor="raxml" className="ml-2">RAXML</Label>
                  </div>
                  <div className="flex items-center">
                    <Checkbox id="phyml" />
                    <Label htmlFor="phyml" className="ml-2">PHYML</Label>
                  </div>
                  <div className="flex items-center">
                    <Checkbox id="fasttree" />
                    <Label htmlFor="fasttree" className="ml-2">FASTTREE</Label>
                  </div>
                </div>

                <div>
                  <Label className="text-xs uppercase tracking-wider mb-1 block">Model</Label>
                  <Input defaultValue="GTR" className="text-sm" />
                </div>

                <div>
                  <Label className="text-xs uppercase tracking-wider mb-1 block">Output Folder</Label>
                  <div className="flex gap-2">
                    <Input className="text-sm" />
                    <Button size="icon" variant="outline">
                      <Upload size={16} />
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-xs uppercase tracking-wider mb-1 block">Output Name</Label>
                  <Input placeholder="Output Name" className="text-sm" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Metadata Options */}
      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            Metadata Options
            <Badge variant="outline">4</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium mb-2">Metadata Table</h3>
              <p className="text-sm text-muted-foreground mb-4">These fields will appear as options in the phylogeny visualization</p>
              
              <div>
                <Label className="text-xs uppercase tracking-wider mb-1 block">Metadata Fields</Label>
                <Select defaultValue="genomeName">
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select field" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="genomeName">Genome Name</SelectItem>
                    <SelectItem value="genomeId">Genome ID</SelectItem>
                    <SelectItem value="species">Species</SelectItem>
                    <SelectItem value="strain">Strain</SelectItem>
                    <SelectItem value="accession">Accession</SelectItem>
                    <SelectItem value="subtype">Subtype</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-2">Metadata Table</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Field</TableHead>
                    <TableHead className="w-24 text-center">Include</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metadataFields.map((field, index) => (
                    <TableRow key={index}>
                      <TableCell>{field.name}</TableCell>
                      <TableCell className="text-center">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => toggleMetadataField(index)}
                          className={field.selected ? "text-destructive" : "text-muted-foreground"}
                        >
                          <X size={16} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Form Controls */}
      <div className="flex justify-end mt-4 gap-2">
        <Button variant="outline">Reset</Button>
        <Button>Submit</Button>
      </div>
    </div>
  );
}