"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FiInfo, FiFolder } from "react-icons/fi";
import { BsLinkedin, BsTwitter } from "react-icons/bs";

const MetagenomicReadMappingService = () => {
  const [pairedFiles, setPairedFiles] = useState([
    { id: 1, name: "READ_FILE_1", selected: false },
    { id: 2, name: "READ_FILE_2", selected: false },
  ]);

  const [singleFile, setSingleFile] = useState({
    name: "READ_FILE",
    selected: false,
  });

  const [sraAccession, setSraAccession] = useState("SRR");

  const [selectedLibraries, setSelectedLibraries] = useState([]);

  return (
    <div className="container mx-auto max-w-6xl py-8">
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-2xl font-bold">Metagenomic Read Mapping</h1>
        <div className="mb-3 flex justify-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <FiInfo className="text-primary-500 h-5 w-5" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-md">
                  Information about Metagenomic Read Mapping
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <a href="#" aria-label="LinkedIn">
            <BsLinkedin className="text-primary-500 h-5 w-5" />
          </a>
          <a href="#" aria-label="Twitter">
            <BsTwitter className="text-primary-500 h-5 w-5" />
          </a>
        </div>
        <p className="text-muted-foreground mx-auto max-w-3xl text-sm">
          The Metagenomic Read Mapping Service uses KMA to align reads against
          antibiotic resistance genes from CARD and virulence factors from VFDB.
          For further explanation, please see the
          <a href="#" className="text-primary-500 ml-1 hover:underline">
            Metagenomic Read Mapping Service Quick Reference Guide
          </a>{" "}
          and
          <a href="#" className="text-primary-500 ml-1 hover:underline">
            Tutorial
          </a>
          .
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
        <div className="md:col-span-7">
          {/* Input File Section */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                Input File
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <FiInfo className="text-primary-500 h-4 w-4" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Select your input files here</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="mb-2 flex items-center">
                  <h3 className="text-sm font-medium">PAIRED READ LIBRARY</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto h-6 w-6"
                  >
                    <FiInfo className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {pairedFiles.map((file) => (
                    <div key={file.id} className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-36 justify-start text-xs"
                      >
                        {file.name}
                      </Button>
                      <div className="w-full">
                        <Input type="file" className="text-xs" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div>
                <div className="mb-2 flex items-center">
                  <h3 className="text-sm font-medium">SINGLE READ LIBRARY</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto h-6 w-6"
                  >
                    <FiInfo className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-36 justify-start text-xs"
                  >
                    {singleFile.name}
                  </Button>
                  <div className="w-full">
                    <Input type="file" className="text-xs" />
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <div className="mb-2 flex items-center">
                  <h3 className="text-sm font-medium">SRA RUN ACCESSION</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto h-6 w-6"
                  >
                    <FiInfo className="h-4 w-4" />
                  </Button>
                </div>
                <Input
                  value={sraAccession}
                  onChange={(e) => setSraAccession(e.target.value)}
                  className="mb-2 h-8"
                  placeholder="SRR"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-5">
          {/* Selected Libraries Section */}
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                Selected Libraries
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <FiInfo className="text-primary-500 h-4 w-4" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Place read files here using the arrow buttons</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
              <CardDescription className="text-xs">
                Place read files here using the arrow buttons.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-background-100 h-64 rounded-md border p-4">
                {selectedLibraries.length === 0 ? (
                  <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                    No libraries selected
                  </div>
                ) : (
                  <ul>
                    {selectedLibraries.map((library, index) => (
                      <li key={index}>{library}</li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-12">
          {/* Parameters Section */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                Parameters
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <FiInfo className="text-primary-500 h-4 w-4" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Configure analysis parameters</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div>
                    <div className="mb-2 flex items-center">
                      <h3 className="text-sm font-medium">GENE SET TYPE</h3>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="ml-2 h-6 w-6"
                            >
                              <FiInfo className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Select the gene set type</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <RadioGroup
                      defaultValue="predefined_list"
                      className="space-y-1"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem
                          value="predefined_list"
                          id="predefined_list"
                        />
                        <Label htmlFor="predefined_list" className="text-sm">
                          PREDEFINED LIST
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="fasta_file" id="fasta_file" />
                        <Label htmlFor="fasta_file" className="text-sm">
                          FASTA FILE
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem
                          value="feature_group"
                          id="feature_group"
                        />
                        <Label htmlFor="feature_group" className="text-sm">
                          FEATURE GROUP
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center">
                      <h3 className="text-sm font-medium">
                        PREDEFINED GENE SET NAME
                      </h3>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="ml-2 h-6 w-6"
                            >
                              <FiInfo className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Select the predefined gene set</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Select defaultValue="card">
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Select gene set" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="card">CARD</SelectItem>
                        <SelectItem value="vfdb">VFDB</SelectItem>
                        <SelectItem value="custom">Custom Gene Set</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="mb-2 text-sm font-medium">OUTPUT FOLDER</h3>
                    <div className="flex gap-2">
                      <Input
                        defaultValue=""
                        placeholder="Select output folder"
                        className="h-8"
                      />
                      <Button variant="outline" size="sm" className="h-8 px-2">
                        <FiFolder className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-2 text-sm font-medium">OUTPUT NAME</h3>
                    <Input
                      defaultValue=""
                      placeholder="Output Name"
                      className="h-8"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
              <Button variant="outline">Reset</Button>
              <Button>Submit</Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default MetagenomicReadMappingService;
