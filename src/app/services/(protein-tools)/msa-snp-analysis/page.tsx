"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Upload, Search } from "lucide-react";
import { CiCircleInfo } from "react-icons/ci";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";

export default function MSAandSNPAnalysisPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-primary-700 flex items-center justify-center gap-2">
          Multiple Sequence Alignment and SNP / Variation Analysis
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <CiCircleInfo size={18} className="text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">Information about MSA and SNP Analysis service</p>
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
          The Multiple Sequence Alignment (MSA) and Single Nucleotide Polymorphism (SNP) / Variation Analysis Service allows users
          to choose an alignment algorithm to align sequences selected from a search result, a FASTA file saved to the workspace, or
          through simply cutting and pasting. The service can also be used for variation and SNP analysis with feature groups, FASTA
          files, aligned FASTA files, and user input FASTA records. For further explanation, please see the Multiple Sequence Alignment
          and SNP / Variation Analysis Service Quick Reference Guide, Tutorial and Instructional Video.
        </p>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Start with */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              Start with:
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <CiCircleInfo size={16} className="text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">Choose your starting point</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup defaultValue="unaligned" className="flex space-x-6">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="unaligned" id="unaligned" />
                <Label htmlFor="unaligned">Unaligned Sequences</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="aligned" id="aligned" />
                <Label htmlFor="aligned">Aligned Sequences</Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Select sequences */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              Select sequences:
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <CiCircleInfo size={16} className="text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">Choose sequences for alignment</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <RadioGroup defaultValue="feature" className="flex flex-wrap gap-6">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="feature" id="feature-group" />
                  <Label htmlFor="feature-group">Feature Group</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="viral" id="viral-genome-group" />
                  <Label htmlFor="viral-genome-group">Viral Genome Group</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="dna" id="dna-protein-file" />
                  <Label htmlFor="dna-protein-file">DNA or Protein FASTA File</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="input" id="input-sequence" />
                  <Label htmlFor="input-sequence">Input Sequence</Label>
                </div>
              </RadioGroup>

              <div className="flex gap-2">
                <Input placeholder="Feature group" className="flex-1" />
                <Button size="icon" variant="outline">
                  <Search size={16} />
                </Button>
              </div>

              <div className="flex space-x-6 items-center">
                <div className="flex items-center space-x-2">
                  <Checkbox id="dna" />
                  <Label htmlFor="dna">DNA</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="protein" />
                  <Label htmlFor="protein">Protein</Label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Select a reference sequence */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              Select a reference sequence:
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <CiCircleInfo size={16} className="text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">Choose a reference sequence for alignment</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup defaultValue="none" className="flex flex-wrap gap-6">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="none" id="none" />
                <Label htmlFor="none">None</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="feature-id" id="feature-id" />
                <Label htmlFor="feature-id">Feature ID</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="input-reference" id="input-reference" />
                <Label htmlFor="input-reference">Input Reference Sequence</Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Parameters */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              Parameters:
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <CiCircleInfo size={16} className="text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">Configure alignment parameters</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <Label className="text-sm mb-2 block font-medium">Aligner</Label>
                <Select defaultValue="mafft">
                  <SelectTrigger>
                    <SelectValue placeholder="Select aligner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mafft">MAFFT</SelectItem>
                    <SelectItem value="clustal">ClustalW</SelectItem>
                    <SelectItem value="muscle">MUSCLE</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="flex items-center mb-2">
                  <Label className="text-sm font-medium">Strategy</Label>
                  <Badge className="ml-2" variant="outline">4</Badge>
                </div>

                <div className="pl-4 space-y-4">
                  <RadioGroup defaultValue="auto">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="auto" id="auto" />
                      <Label htmlFor="auto" className="font-normal">Auto (FFT-NS-1, FFT-NS-2, FFT-NS-i, L-INS-i depends on data size)</Label>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium mb-2">Progressive Methods</h4>
                      <div className="pl-4 space-y-2">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="fft-ns-1" id="fft-ns-1" />
                          <Label htmlFor="fft-ns-1" className="font-normal">FFT-NS-1 (very fast, recommended for {"<"}2,000 sequences, progressive method)</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="fft-ns-2" id="fft-ns-2" />
                          <Label htmlFor="fft-ns-2" className="font-normal">FFT-NS-2 (fast, progressive method)</Label>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium mb-2">Iterative Refinement Methods</h4>
                      <div className="pl-4 space-y-2">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="fft-ns-i" id="fft-ns-i" />
                          <Label htmlFor="fft-ns-i" className="font-normal">FFT-NS-i (iterative refinement method)</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="e-ins-i" id="e-ins-i" />
                          <Label htmlFor="e-ins-i" className="font-normal">E-INS-i (very slow, recommended for {"<"}200 sequences with multiple conserved domains and long gaps, 5 iterative cycles only)</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="l-ins-i" id="l-ins-i" />
                          <Label htmlFor="l-ins-i" className="font-normal">L-INS-i (very slow, recommended for {"<"}200 sequences with one conserved domain and long gaps, 2 iterative cycles only)</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="g-ins-i" id="g-ins-i" />
                          <Label htmlFor="g-ins-i" className="font-normal">G-INS-i (very slow, recommended for {"<"}200 sequences with global homology, 2 iterative cycles only)</Label>
                        </div>
                      </div>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              <div>
                <Label className="text-sm mb-2 block font-medium">Output Folder</Label>
                <div className="flex gap-2">
                  <Input className="flex-1" placeholder="Output Folder" />
                  <Button size="icon" variant="outline">
                    <Upload size={16} />
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-sm mb-2 block font-medium">Output Name</Label>
                <Input placeholder="Output Name" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Form Controls */}
        <div className="flex justify-end gap-2">
          <Button variant="outline">Reset</Button>
          <Button>Submit</Button>
        </div>
      </div>
    </div>
  );
}