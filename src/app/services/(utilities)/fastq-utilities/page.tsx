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
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FiInfo,
  FiUpload,
  FiFile,
  FiFolder,
  FiPlay,
  FiSettings,
  FiList,
  FiDatabase,
} from "react-icons/fi";
import { BsLinkedin, BsTwitter } from "react-icons/bs";

const FastqUtilitiesService = () => {
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

  const [platform, setPlatform] = useState("illumina");

  const [targetGenome, setTargetGenome] = useState(
    "e.g. Mycobacterium tuberculosis H37Rv",
  );

  return (
    <div className="container mx-auto max-w-6xl py-8">
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-2xl font-bold">FastQ Utilities</h1>
        <div className="mb-3 flex justify-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <FiInfo className="text-primary-500 h-5 w-5" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-md">Information about FastQ Utilities</p>
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
          The FastQ Utilities Service provides capability for aligning,
          measuring base call quality, and trimming fastq read files. For
          further explanation, please see the
          <a href="#" className="text-primary-500 ml-1 hover:underline">
            FastQ Utilities Service Quick Reference Guide
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
        <div className="md:col-span-6">
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
                      <p>Configure output parameters</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="output-folder" className="text-sm font-medium">
                  OUTPUT FOLDER
                </Label>
                <div className="mt-1 flex gap-2">
                  <Input
                    id="output-folder"
                    defaultValue=""
                    placeholder="Select output folder"
                    className="h-9"
                  />
                  <Button variant="outline" size="sm" className="h-9 px-2">
                    <FiFolder className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="output-name" className="text-sm font-medium">
                  OUTPUT NAME
                </Label>
                <Input
                  id="output-name"
                  defaultValue=""
                  placeholder="Output Name"
                  className="mt-1 h-9"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-6">
          {/* Pipeline Section */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                Pipeline
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <FiInfo className="text-primary-500 h-4 w-4" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Configure pipeline settings</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="select-action" className="text-sm font-medium">
                  SELECT ACTION
                </Label>
                <Select defaultValue="">
                  <SelectTrigger id="select-action" className="mt-1 h-9">
                    <SelectValue placeholder="Select Action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trim">Trim Reads</SelectItem>
                    <SelectItem value="align">Align Reads</SelectItem>
                    <SelectItem value="quality">Quality Assessment</SelectItem>
                    <SelectItem value="convert">Convert Format</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="bg-background-100 mt-2 h-24 rounded-md p-2">
                <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                  Selected action parameters will appear here
                </div>
              </div>

              <div>
                <Label htmlFor="target-genome" className="text-sm font-medium">
                  TARGET GENOME
                </Label>
                <div className="mt-1 flex items-center">
                  <Checkbox id="use-genome" className="mr-2" />
                  <Input
                    id="target-genome"
                    value={targetGenome}
                    onChange={(e) => setTargetGenome(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-6">
          {/* Input Sections */}
          <div className="space-y-6">
            {/* Paired Read Library */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  Paired Read Library
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <FiInfo className="text-primary-500 h-4 w-4" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Select paired-end read files</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="read-file-1" className="w-24 text-sm">
                    READ FILE 1
                  </Label>
                  <div className="flex-1">
                    <Input
                      id="read-file-1"
                      type="file"
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="read-file-2" className="w-24 text-sm">
                    READ FILE 2
                  </Label>
                  <div className="flex-1">
                    <Input
                      id="read-file-2"
                      type="file"
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Single Read Library */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  Single Read Library
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <FiInfo className="text-primary-500 h-4 w-4" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Select single-end read file</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <Label htmlFor="platform" className="text-sm font-medium">
                    PLATFORM
                  </Label>
                  <Select defaultValue="illumina">
                    <SelectTrigger id="platform" className="mt-1 h-9">
                      <SelectValue placeholder="Select Platform" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="illumina">Illumina</SelectItem>
                      <SelectItem value="nanopore">Nanopore</SelectItem>
                      <SelectItem value="pacbio">PacBio</SelectItem>
                      <SelectItem value="ion_torrent">Ion Torrent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <Label htmlFor="read-file" className="w-24 text-sm">
                    READ FILE
                  </Label>
                  <div className="flex-1">
                    <Input id="read-file" type="file" className="h-9 text-sm" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* SRA Run Accession */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  SRA Run Accession
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <FiInfo className="text-primary-500 h-4 w-4" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Provide SRA accession number</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div>
                  <Label
                    htmlFor="sra-accession"
                    className="text-sm font-medium"
                  >
                    SRA ACCESSION
                  </Label>
                  <Input
                    id="sra-accession"
                    value={sraAccession}
                    onChange={(e) => setSraAccession(e.target.value)}
                    className="mt-1 h-9"
                    placeholder="SRR"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="md:col-span-6">
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
              <div className="bg-background-100 h-96 rounded-md border p-4">
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
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline">Reset</Button>
        <Button>Submit</Button>
      </div>
    </div>
  );
};

export default FastqUtilitiesService;
