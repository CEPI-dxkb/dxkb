"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileSymlink, Search } from "lucide-react";
import { CiCircleInfo } from "react-icons/ci";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function MetaCATSPage() {
  const [groupingType, setGroupingType] = useState("auto");

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-primary-700 flex items-center justify-center gap-2">
          Metadata-driven Comparative Analysis Tool (Meta-CATS)
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <CiCircleInfo size={18} className="text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">Information about the Meta-CATS tool</p>
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
          The Meta-CATS tool looks for positions that significantly differ between user-defined groups of sequences. However, biological
          biases due to correlation, codon biases, and differences in genotype, geography, time of isolation, or others may affect the
          robustness of the underlying statistical assumptions. For further explanation, please see Metadata-driven Comparative Analysis
          Tool (Meta-CATS) Service Quick Reference Guide and Tutorial.
        </p>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Parameters Section */}
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
                <Label className="text-sm font-medium mb-1 block">P-VALUE</Label>
                <Input type="number" defaultValue="0.05" step="0.01" min="0" max="1" />
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
                    <p className="max-w-xs">Specify input data for analysis</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <RadioGroup 
                defaultValue="auto" 
                className="flex space-x-6"
                value={groupingType}
                onValueChange={setGroupingType}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="auto" id="auto-grouping" />
                  <Label htmlFor="auto-grouping">Auto Grouping</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="feature" id="feature-groups" />
                  <Label htmlFor="feature-groups">Feature Groups</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="alignment" id="alignment-file" />
                  <Label htmlFor="alignment-file">Alignment File</Label>
                </div>
              </RadioGroup>

              <div>
                <Label className="text-sm font-medium mb-1 block">METADATA</Label>
                <Select defaultValue="host">
                  <SelectTrigger>
                    <SelectValue placeholder="Select metadata" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="host">Host Name</SelectItem>
                    <SelectItem value="strain">Strain</SelectItem>
                    <SelectItem value="geography">Geography</SelectItem>
                    <SelectItem value="date">Collection Date</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {groupingType === "feature" && (
                <div>
                  <Label className="text-sm font-medium mb-1 block">SELECT FEATURE GROUP</Label>
                  <div className="flex gap-2">
                    <Input className="flex-1" />
                    <Button size="icon" variant="outline">
                      <Search size={16} />
                    </Button>
                    <Button size="icon" variant="outline">
                      <CiCircleInfo size={16} />
                    </Button>
                  </div>

                  <div className="flex space-x-6 mt-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="dna" />
                      <Label htmlFor="dna">DNA</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="protein" />
                      <Label htmlFor="protein">PROTEIN</Label>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <Label className="text-sm font-medium mb-1 block">GROUP NAMES</Label>
                <div className="flex gap-2">
                  <Select defaultValue="default">
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select group" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default Group</SelectItem>
                      <SelectItem value="group1">Group 1</SelectItem>
                      <SelectItem value="group2">Group 2</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button>Change group</Button>
                </div>
              </div>

              <div>
                <Button variant="outline">Delete Rows</Button>
              </div>

              <div>
                <Label className="text-sm font-medium mb-1 block">GROUPS GRID</Label>
                <div className="border rounded-md overflow-hidden">
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
                          SRC ID
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <CiCircleInfo size={14} className="ml-1 text-muted-foreground inline" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">Source ID information</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableHead>
                        <TableHead>
                          Genome ID
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <CiCircleInfo size={14} className="ml-1 text-muted-foreground inline" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">Genome ID information</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No results found.
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
                
                <div className="text-xs text-muted-foreground mt-2">
                  0 - 0 of 0 results
                </div>
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