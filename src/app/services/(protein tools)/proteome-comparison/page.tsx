"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSymlink, Plus, Search } from "lucide-react";
import { CiCircleInfo } from "react-icons/ci";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

export default function ProteomeComparisonPage() {
  const [selectedGenomes, setSelectedGenomes] = useState([
    "Mycobacterium tuberculosis H37Rv"
  ]);

  const addGenome = (genome: string) => {
    if (!selectedGenomes.includes(genome) && selectedGenomes.length < 5) {
      setSelectedGenomes([...selectedGenomes, genome]);
    }
  };

  const removeGenome = (genome: string) => {
    setSelectedGenomes(selectedGenomes.filter(g => g !== genome));
  };

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-primary-700 flex items-center justify-center gap-2">
          Proteome Comparison
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <CiCircleInfo size={18} className="text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">Information about Proteome Comparison service</p>
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
          The Proteome Comparison Service performs protein sequence-based genome comparison using bidirectional BLASTP. This
          service allows users to select genomes and compare them to reference genome. For further explanation, please see the
          Proteome Comparison Service Quick Reference Guide, Tutorial and Instructional Video.
        </p>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Parameters */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                Parameters
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <CiCircleInfo size={16} className="text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Configure analysis parameters</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center mb-1">
                    <Label className="text-sm uppercase tracking-wider">Advanced Parameters Options</Label>
                    <Badge className="ml-2" variant="outline">4</Badge>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium mb-1 block">MINIMUM % COVERAGE</Label>
                  <Input type="number" defaultValue="30" className="w-20" />
                </div>

                <div>
                  <Label className="text-sm font-medium mb-1 block">BLAST E-VALUE</Label>
                  <Input defaultValue="1e-5" className="w-full" />
                </div>

                <div>
                  <Label className="text-sm font-medium mb-1 block">MINIMUM % IDENTITY</Label>
                  <Input type="number" defaultValue="10" className="w-20" />
                </div>

                <div>
                  <Label className="text-sm font-medium mb-1 block">OUTPUT FOLDER</Label>
                  <div className="flex gap-2">
                    <Input className="flex-1" />
                    <Button size="icon" variant="outline">
                      <FileSymlink size={16} />
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium mb-1 block">OUTPUT NAME</Label>
                  <Input placeholder="Output Name" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Comparison Genomes */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                Comparison Genomes
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <CiCircleInfo size={16} className="text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Add up to 5 genomes to compare (use plus buttons to add)</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
              <CardDescription>Add up to 5 genomes to compare (use plus buttons to add)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium mb-1 block">SELECT GENOME</Label>
                  <div className="flex gap-2">
                    <Select defaultValue="tuberculosis">
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select genome" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tuberculosis">Mycobacterium tuberculosis H37Rv</SelectItem>
                        <SelectItem value="coli">Escherichia coli K-12</SelectItem>
                        <SelectItem value="subtilis">Bacillus subtilis 168</SelectItem>
                        <SelectItem value="cerevisiae">Saccharomyces cerevisiae S288C</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="icon" variant="outline" onClick={() => addGenome("Mycobacterium tuberculosis H37Rv")}>
                      <Plus size={16} />
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium mb-1 block">AND/OR SELECT PROTEIN FASTA FILE</Label>
                  <div className="flex gap-2">
                    <Input placeholder="Optional" className="flex-1" />
                    <Button size="icon" variant="outline">
                      <Upload size={16} />
                    </Button>
                    <Button size="icon" variant="outline">
                      <Plus size={16} />
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium mb-1 block">AND/OR SELECT FEATURE GROUP</Label>
                  <div className="flex gap-2">
                    <Input placeholder="Optional" className="flex-1" />
                    <Button size="icon" variant="outline">
                      <Search size={16} />
                    </Button>
                    <Button size="icon" variant="outline">
                      <Plus size={16} />
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium mb-1 block">AND/OR SELECT GENOME GROUP</Label>
                  <div className="flex gap-2">
                    <Input placeholder="Optional" className="flex-1" />
                    <Button size="icon" variant="outline">
                      <Search size={16} />
                    </Button>
                    <Button size="icon" variant="outline">
                      <Plus size={16} />
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium mb-1 block">SELECTED GENOME TABLE</Label>
                  <div className="border rounded-md p-2 min-h-[200px]">
                    <Table>
                      <TableBody>
                        {selectedGenomes.map((genome, index) => (
                          <TableRow key={index}>
                            <TableCell className="py-2">{genome}</TableCell>
                          </TableRow>
                        ))}
                        {selectedGenomes.length === 0 && (
                          <TableRow>
                            <TableCell className="py-2 text-center text-muted-foreground">No genomes selected</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Reference Genome */}
        <Card className="mt-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              Reference Genome
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <CiCircleInfo size={16} className="text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">Select 1 reference genome from the following options</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
            <CardDescription>Select 1 reference genome from the following options</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-1 block">SELECT A GENOME</Label>
                <div className="flex gap-2">
                  <Select defaultValue="tuberculosis">
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select genome" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tuberculosis">Mycobacterium tuberculosis H37Rv</SelectItem>
                      <SelectItem value="coli">Escherichia coli K-12</SelectItem>
                      <SelectItem value="subtilis">Bacillus subtilis 168</SelectItem>
                      <SelectItem value="cerevisiae">Saccharomyces cerevisiae S288C</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium mb-1 block">OR A FASTA FILE</Label>
                <div className="flex gap-2">
                  <Input placeholder="Optional" className="flex-1" />
                  <Button size="icon" variant="outline">
                    <Upload size={16} />
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium mb-1 block">OR A FEATURE GROUP</Label>
                <div className="flex gap-2">
                  <Input placeholder="Optional" className="flex-1" />
                  <Button size="icon" variant="outline">
                    <Search size={16} />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Form Controls */}
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline">Reset</Button>
          <Button>Submit</Button>
        </div>
      </div>
    </div>
  );
}