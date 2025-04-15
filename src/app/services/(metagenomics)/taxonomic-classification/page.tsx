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
import { Badge } from "@/components/ui/badge";
import {
  FiInfo,
  FiUpload,
  FiFile,
  FiPlus,
  FiMinus,
  FiDatabase,
  FiFilter,
  FiPercent,
  FiFolder,
} from "react-icons/fi";
import { BsLinkedin, BsTwitter } from "react-icons/bs";

const TaxonomicClassificationService = () => {
  const [pairedFiles, setPairedFiles] = useState([
    { id: 1, name: "READ_FILE_1", selected: false },
    { id: 2, name: "READ_FILE_2", selected: false },
  ]);

  const [singleFile, setSingleFile] = useState({
    name: "READ_FILE",
    selected: false,
  });

  const [sampleIdentifiers, setSampleIdentifiers] = useState({
    paired: "Sample ID",
    single: "Sample ID",
    sra: "Sample ID",
  });

  const [sraAccession, setSraAccession] = useState("SRR");

  const [selectedLibraries, setSelectedLibraries] = useState([]);

  return (
    <div className="container mx-auto max-w-6xl py-8">
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-2xl font-bold">Taxonomic Classification</h1>
        <div className="mb-3 flex justify-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <FiInfo className="text-primary-500 h-5 w-5" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-md">
                  Information about Taxonomic Classification
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
          The Taxonomic Classification Service computes taxonomic classification
          for read data. For further explanation, please see the
          <a href="#" className="text-primary-500 ml-1 hover:underline">
            Taxonomic Classification Service Quick Reference Guide
          </a>
          ,
          <a href="#" className="text-primary-500 ml-1 hover:underline">
            Tutorial
          </a>{" "}
          and
          <a href="#" className="text-primary-500 ml-1 hover:underline">
            Instructional Video
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
                <div className="mt-2">
                  <Label className="text-xs">SAMPLE IDENTIFIER</Label>
                  <Input
                    value={sampleIdentifiers.paired}
                    onChange={(e) =>
                      setSampleIdentifiers({
                        ...sampleIdentifiers,
                        paired: e.target.value,
                      })
                    }
                    className="mt-1 h-8"
                  />
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
                <div className="mt-2">
                  <Label className="text-xs">SAMPLE IDENTIFIER</Label>
                  <Input
                    value={sampleIdentifiers.single}
                    onChange={(e) =>
                      setSampleIdentifiers({
                        ...sampleIdentifiers,
                        single: e.target.value,
                      })
                    }
                    className="mt-1 h-8"
                  />
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
                <div className="mt-2">
                  <Label className="text-xs">SAMPLE IDENTIFIER</Label>
                  <Input
                    value={sampleIdentifiers.sra}
                    onChange={(e) =>
                      setSampleIdentifiers({
                        ...sampleIdentifiers,
                        sra: e.target.value,
                      })
                    }
                    className="mt-1 h-8"
                  />
                </div>
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
                      <h3 className="text-sm font-medium">SEQUENCING TYPE</h3>
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
                            <p>Select the sequencing type</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <RadioGroup defaultValue="wgs" className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="wgs" id="wgs" />
                        <Label htmlFor="wgs" className="text-sm">
                          WHOLE GENOME SEQUENCING (WGS)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="16s" id="16s" />
                        <Label htmlFor="16s" className="text-sm">
                          16S RIBOSOMAL RNA
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center">
                      <h3 className="text-sm font-medium">ANALYSIS TYPE</h3>
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
                            <p>Select the analysis type</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Select defaultValue="microbiome">
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Select analysis type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="microbiome">
                          Microbiome Analysis
                        </SelectItem>
                        <SelectItem value="genomic">
                          Genomic Analysis
                        </SelectItem>
                        <SelectItem value="metagenome">
                          Metagenome Analysis
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center">
                      <h3 className="text-sm font-medium">DATABASE</h3>
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
                            <p>Select the reference database</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Select defaultValue="bvbrc">
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Select database" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bvbrc">BV-BRC Database</SelectItem>
                        <SelectItem value="ncbi">NCBI Database</SelectItem>
                        <SelectItem value="custom">Custom Database</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="mb-2 flex items-center">
                      <h3 className="text-sm font-medium">FILTER HOST READS</h3>
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
                            <p>Filter out host genome reads</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Select defaultValue="none">
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Select filter option" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="human">Human</SelectItem>
                        <SelectItem value="mouse">Mouse</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center">
                      <h3 className="text-sm font-medium">
                        CONFIDENCE INTERVAL
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
                            <p>Set confidence interval for classification</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Select defaultValue="0.1">
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Select confidence interval" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0.1">0.1</SelectItem>
                        <SelectItem value="0.05">0.05</SelectItem>
                        <SelectItem value="0.01">0.01</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <h3 className="mb-2 text-sm font-medium">
                        SAVE CLASSIFIED SEQUENCES
                      </h3>
                      <RadioGroup
                        defaultValue="no"
                        className="flex items-center space-x-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="no" id="classified-no" />
                          <Label htmlFor="classified-no" className="text-sm">
                            NO
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="yes" id="classified-yes" />
                          <Label htmlFor="classified-yes" className="text-sm">
                            YES
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <div>
                      <h3 className="mb-2 text-sm font-medium">
                        SAVE UNCLASSIFIED SEQUENCES
                      </h3>
                      <RadioGroup
                        defaultValue="no"
                        className="flex items-center space-x-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="no" id="unclassified-no" />
                          <Label htmlFor="unclassified-no" className="text-sm">
                            NO
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="yes" id="unclassified-yes" />
                          <Label htmlFor="unclassified-yes" className="text-sm">
                            YES
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 md:col-span-2">
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

export default TaxonomicClassificationService;
