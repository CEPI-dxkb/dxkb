"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info, Upload, X, ChevronRight, Trash2 } from "lucide-react";

interface Library {
  id: string;
  name: string;
  type: "paired" | "single" | "sra";
}

interface ReadFile {
  id: number;
  filename: string;
}

export default function GenomeAssemblyPage() {
  const [pairedReadFiles, setPairedReadFiles] = useState<ReadFile[]>([
    { id: 1, filename: "" },
    { id: 2, filename: "" },
  ]);
  const [singleReadFiles, setSingleReadFiles] = useState<ReadFile[]>([
    { id: 1, filename: "" },
  ]);
  const [sraAccession, setSraAccession] = useState("");
  const [selectedLibraries, setSelectedLibraries] = useState<Library[]>([]);
  const [outputFolder, setOutputFolder] = useState("");
  const [outputName, setOutputName] = useState("");
  const [assemblyStrategy, setAssemblyStrategy] = useState("auto");

  const addPairedReadFile = () => {
    const newId =
      pairedReadFiles.length > 0
        ? Math.max(...pairedReadFiles.map((file) => file.id)) + 1
        : 1;
    setPairedReadFiles([...pairedReadFiles, { id: newId, filename: "" }]);
  };

  const addSingleReadFile = () => {
    const newId =
      singleReadFiles.length > 0
        ? Math.max(...singleReadFiles.map((file) => file.id)) + 1
        : 1;
    setSingleReadFiles([...singleReadFiles, { id: newId, filename: "" }]);
  };

  const removePairedReadFile = (id: number) => {
    setPairedReadFiles(pairedReadFiles.filter((file) => file.id !== id));
  };

  const removeSingleReadFile = (id: number) => {
    setSingleReadFiles(singleReadFiles.filter((file) => file.id !== id));
  };

  const updatePairedReadFile = (id: number, filename: string) => {
    setPairedReadFiles(
      pairedReadFiles.map((file) =>
        file.id === id ? { ...file, filename } : file,
      ),
    );
  };

  const updateSingleReadFile = (id: number, filename: string) => {
    setSingleReadFiles(
      singleReadFiles.map((file) =>
        file.id === id ? { ...file, filename } : file,
      ),
    );
  };

  const addToSelectedLibraries = (file: ReadFile, type: "paired" | "single") => {
    if (
      file.filename &&
      !selectedLibraries.some((lib) => lib.id === `${type}-${file.id}`)
    ) {
      setSelectedLibraries([
        ...selectedLibraries,
        {
          id: `${type}-${file.id}`,
          name: file.filename,
          type,
        },
      ]);
    }
  };

  const removeFromSelectedLibraries = (id: string) => {
    setSelectedLibraries(selectedLibraries.filter((lib) => lib.id !== id));
  };

  const resetForm = () => {
    setPairedReadFiles([
      { id: 1, filename: "" },
      { id: 2, filename: "" },
    ]);
    setSingleReadFiles([{ id: 1, filename: "" }]);
    setSraAccession("");
    setSelectedLibraries([]);
    setOutputFolder("");
    setOutputName("");
    setAssemblyStrategy("auto");
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">Genome Assembly</h1>
        <div className="mb-4 flex items-center gap-2">
          <p className="text-gray-600">
            The Genome Assembly Service allows single or multiple assemblies to
            be involved to compare results. The service attempts to select the
            best assembly.
          </p>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-blue-500" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">
                  The Genome Assembly Service compares multiple assemblies to
                  find the optimal result.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <a
            href="/docs/assembly-guide"
            className="text-sm text-blue-500 hover:underline"
          >
            Quick Reference Guide
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column */}
        <div className="lg:col-span-7">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                Input Files
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="ml-2">
                      <Info className="h-4 w-4 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        Upload your paired-end reads, single reads, or provide
                        SRA accession numbers
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="paired-reads">
                  <AccordionTrigger className="text-base font-medium">
                    Paired Read Library
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4">
                      {pairedReadFiles.map((file) => (
                        <div key={file.id} className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <Input
                              placeholder={`READ FILE ${file.id}`}
                              value={file.filename}
                              onChange={(e) =>
                                updatePairedReadFile(file.id, e.target.value)
                              }
                              className="pr-10"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute top-0 right-0"
                              onClick={() => removePairedReadFile(file.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() =>
                              addToSelectedLibraries(file, "paired")
                            }
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={addPairedReadFile}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Add Paired Read File
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="single-reads">
                  <AccordionTrigger className="text-base font-medium">
                    Single Read Library
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4">
                      {singleReadFiles.map((file) => (
                        <div key={file.id} className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <Input
                              placeholder="READ FILE"
                              value={file.filename}
                              onChange={(e) =>
                                updateSingleReadFile(file.id, e.target.value)
                              }
                              className="pr-10"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute top-0 right-0"
                              onClick={() => removeSingleReadFile(file.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() =>
                              addToSelectedLibraries(file, "single")
                            }
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={addSingleReadFile}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Add Single Read File
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="sra">
                  <AccordionTrigger className="text-base font-medium">
                    SRA Run Accession
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="SRR"
                        value={sraAccession}
                        onChange={(e) => setSraAccession(e.target.value)}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          if (sraAccession) {
                            setSelectedLibraries([
                              ...selectedLibraries,
                              {
                                id: `sra-${Date.now()}`,
                                name: sraAccession,
                                type: "sra",
                              },
                            ]);
                            setSraAccession("");
                          }
                        }}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                Parameters
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="ml-2">
                      <Info className="h-4 w-4 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Configure the assembly parameters</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="assembly-strategy">Assembly Strategy</Label>
                  <Select
                    value={assemblyStrategy}
                    onValueChange={setAssemblyStrategy}
                  >
                    <SelectTrigger id="assembly-strategy">
                      <SelectValue placeholder="Select strategy" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto</SelectItem>
                      <SelectItem value="fast">Fast</SelectItem>
                      <SelectItem value="thorough">Thorough</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="output-folder">Output Folder</Label>
                  <Input
                    id="output-folder"
                    value={outputFolder}
                    onChange={(e) => setOutputFolder(e.target.value)}
                    placeholder="Specify output folder"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="output-name">Output Name</Label>
                  <Input
                    id="output-name"
                    value={outputName}
                    onChange={(e) => setOutputName(e.target.value)}
                    placeholder="Output Name"
                  />
                </div>

                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="advanced">
                    <AccordionTrigger>Advanced Options</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pt-2">
                        <div className="space-y-2">
                          <Label htmlFor="threads">Threads</Label>
                          <Input
                            id="threads"
                            type="number"
                            min="1"
                            defaultValue="4"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="memory">Memory (GB)</Label>
                          <Input
                            id="memory"
                            type="number"
                            min="1"
                            defaultValue="16"
                          />
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-5">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center">
                Selected Libraries
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="ml-2">
                      <Info className="h-4 w-4 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Files that will be used for assembly</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
              <CardDescription>
                Place read files here using the arrow buttons.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="min-h-48 rounded-md border p-2">
                {selectedLibraries.length === 0 ? (
                  <div className="flex h-48 items-center justify-center text-gray-400">
                    No libraries selected
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedLibraries.map((lib) => (
                      <div
                        key={lib.id}
                        className="flex items-center justify-between rounded bg-gray-50 p-2"
                      >
                        <div>
                          <div className="font-medium">{lib.name}</div>
                          <div className="text-xs text-gray-500">
                            {lib.type === "paired"
                              ? "Paired Read"
                              : lib.type === "single"
                                ? "Single Read"
                                : "SRA Accession"}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFromSelectedLibraries(lib.id)}
                        >
                          <Trash2 className="h-4 w-4 text-gray-400" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-4">
              <Button variant="outline" onClick={resetForm}>
                Reset
              </Button>
              <Button>Assemble</Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
