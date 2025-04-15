"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import {
  Info,
  Upload,
  FileText,
  HelpCircle,
} from "lucide-react";

export default function HASubtypeNumbering() {
  // States for the form
  const [inputSequence, setInputSequence] = useState("");
  const [outputFolder, setOutputFolder] = useState("");
  const [outputName, setOutputName] = useState("");
  const [selectedScheme, setSelectedScheme] = useState("H1PDM34");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Handle form submission logic here
    console.log({ inputSequence, outputFolder, outputName, selectedScheme });
  };

  const handleReset = () => {
    setInputSequence("");
    setOutputFolder("");
    setOutputName("");
    setSelectedScheme("H1PDM34");
  };

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      {/* Header Section */}
      <div className="mb-8 text-center">
        <div className="mb-2 flex items-center justify-center gap-2">
          <h1 className="text-2xl font-bold">
            HA Subtype Numbering Conversion
          </h1>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="bg-primary-50 text-primary-700 inline-flex h-6 w-6 items-center justify-center rounded-full">
                  <Info className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="w-64">Information about HA Subtype Numbering</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <p className="text-muted-foreground mx-auto max-w-3xl text-sm">
          The HA Subtype Numbering Conversion service allows user to renumber
          Influenza HA sequences according to a cross-subtype numbering scheme
          proposed by Burke and Smith in Burke DF, Smith DJ (2014). A
          recommended numbering scheme for influenza A HA subtypes. PLUS One
          9:e112302. Burke and Smith's numbering scheme uses analysis of known
          HA structures to identify amino acids that are structurally and
          functionally equivalent across all HA subtypes, using a numbering
          system based on the mature HA sequence. For further explanation,
          please see the{" "}
          <a href="#" className="text-primary-600 hover:underline">
            HA Subtype Numbering Conversion Service Quick Reference Guide
          </a>{" "}
          and{" "}
          <a href="#" className="text-primary-600 hover:underline">
            Tutorial
          </a>
          .
        </p>
      </div>

      {/* Main Form Content */}
      <div className="grid grid-cols-1 gap-6">
        {/* Input Sequence Section */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                Input Sequence
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="text-muted-foreground h-4 w-4" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="w-64">
                        Enter protein sequences for analysis
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="mb-4 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox id="enter-sequence" />
                <Label htmlFor="enter-sequence" className="text-sm">
                  Enter sequence
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox id="select-fasta" checked={true} />
                <Label htmlFor="select-fasta" className="text-sm">
                  Select FASTA file
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox id="feature-group" />
                <Label htmlFor="feature-group" className="text-sm">
                  Feature group
                </Label>
              </div>
            </div>

            <Textarea
              placeholder="Enter one or more protein sequences."
              className="min-h-[200px] font-mono text-sm"
              value={inputSequence}
              onChange={(e) => setInputSequence(e.target.value)}
            />

            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
              >
                <Upload className="h-4 w-4" />
                <span>Upload FASTA</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Conversion Sequence Numbering Scheme Section */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                Conversion Sequence Numbering Scheme
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="text-muted-foreground h-4 w-4" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="w-64">
                        Select the numbering scheme to apply
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {[
                "H1PDM34",
                "H1PR834",
                "H3post1968",
                "H5Haedin",
                "H2",
                "H3",
                "H4",
                "H5GAlamoaGsGD",
                "H5",
                "H5c221",
              ].map((scheme) => (
                <div className="flex items-center gap-2" key={scheme}>
                  <Checkbox
                    id={scheme}
                    checked={selectedScheme === scheme}
                    onCheckedChange={() => setSelectedScheme(scheme)}
                  />
                  <Label htmlFor={scheme} className="text-sm">
                    {scheme}
                  </Label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Output Options Section */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base font-medium">
                  Output Folder
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <HelpCircle className="text-muted-foreground h-4 w-4" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="w-64">
                          Specify where output files should be saved
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Output Folder"
                  value={outputFolder}
                  onChange={(e) => setOutputFolder(e.target.value)}
                  className="flex-1"
                />
                <Button variant="outline" size="icon">
                  <FileText className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base font-medium">
                  Output Name
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <HelpCircle className="text-muted-foreground h-4 w-4" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="w-64">Name for the output files</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <Input
                placeholder="Output Name"
                value={outputName}
                onChange={(e) => setOutputName(e.target.value)}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-8 flex justify-center gap-4">
        <Button variant="outline" onClick={handleReset}>
          Reset
        </Button>
        <Button type="submit">Submit</Button>
      </div>
    </div>
  );
}
