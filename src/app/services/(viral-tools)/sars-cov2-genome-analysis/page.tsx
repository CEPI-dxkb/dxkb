"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle, Info } from "lucide-react";
import { ServiceHeader } from "@/components/services/service-header";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import SearchWorkspaceInput from "@/components/services/search-workspace-input";
import { Library, primerOptions } from "@/types/services";
import SearchReadLibrary from "@/components/services/search-read-library";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import OutputFolder from "@/components/services/output-folder";
import SelectedItemsTable from "@/components/services/selected-items-table";
import SraRunAccession from "@/components/services/sra-run-accession";
import {
  handlePairedLibraryAdd,
  handleSingleLibraryAdd,
  removeFromSelectedLibraries,
  handleFormSubmit,
} from "@/lib/services/service-utils";
import {
  readInputFileInfo,
  sarsCov2GenomeAnalysisInfo,
  sarsCov2GenomeAnalysisParameters,
  sarsCov2GenomeAnalysisStartWith,
} from "@/lib/services/service-info";

export default function GenomeAnalysis() {
  const [_selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [_outputFolder, setOutputFolder] = useState<string>("");
  const [_outputName, setOutputName] = useState<string>("");
  const [analysisInput, setAnalysisInput] = useState<string>("read-file");
  const [_strategy, setStrategy] = useState<string>("one-codex");
  const [primer, setPrimer] = useState<string>("artic");
  const [_taxonomyName, setTaxonomyName] = useState<string>("sars");
  const [_contigsFolder, setContigsFolder] = useState<string>("");
  const [selectedLibraries, setSelectedLibraries] = useState<Library[]>([]);
  const [prlPlatform, setPrlPlatform] = useState<string>("");
  const [srlPlatform, setSrlPlatform] = useState<string>("");
  const [version, setVersion] = useState<string>(
    primerOptions.find((option) => option.id === primer)?.versions[0] ?? "",
  );

  const handleReset = () => {
    setSelectedFiles([]);
    setOutputFolder("");
    setOutputName("");
    setAnalysisInput("read-file");
  };

  return (
    <section>
      <ServiceHeader
        title="SARS-CoV-2 Genome Analysis"
        description="The SARS-CoV-2 Genome Analysis Service provides a streamlined
          meta-service that accepts raw reads and performs genome assembly,
          annotation, and variation analysis."
        infoPopupTitle={sarsCov2GenomeAnalysisInfo.title}
        infoPopupDescription={sarsCov2GenomeAnalysisInfo.description}
        quickReferenceGuide="#"
        tutorial="#"
        instructionalVideo="#"
      />

      {/* Main Content */}
      <form
        onSubmit={handleFormSubmit}
        className="grid grid-cols-1 gap-6 md:grid-cols-6"
      >
        {/* Start With Section */}
        <Card className="md:col-span-2">
          <CardHeader className="service-card-header">
            <CardTitle className="service-card-title">
              Start With:
              <DialogInfoPopup
                title={sarsCov2GenomeAnalysisStartWith.title}
                description={sarsCov2GenomeAnalysisStartWith.description}
                sections={sarsCov2GenomeAnalysisStartWith.sections}
              />
            </CardTitle>
          </CardHeader>

          <CardContent className="service-card-content">
            <RadioGroup
              defaultValue="read-file"
              className="gap-4; flex flex-col lg:flex-row"
              onValueChange={setAnalysisInput}
            >
              <div className="service-radio-group-item">
                <RadioGroupItem value="read-file" id="read-file" />
                <Label htmlFor="read-file">Read File</Label>
              </div>
              <div className="service-radio-group-item">
                <RadioGroupItem
                  value="assembly-contigs"
                  id="assembly-contigs"
                />
                <Label htmlFor="assembly-contigs">Assembly/Contigs</Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Parameters Section */}
        <Card className="md:col-span-4">
          <CardHeader className="service-card-header">
            <CardTitle className="service-card-title">
              Parameters
              <DialogInfoPopup
                title={sarsCov2GenomeAnalysisParameters.title}
                description={sarsCov2GenomeAnalysisParameters.description}
                sections={sarsCov2GenomeAnalysisParameters.sections}
              />
            </CardTitle>
          </CardHeader>

          <CardContent className="service-card-content">
            {analysisInput === "read-file" && (
              <div className="flex flex-col gap-4">
                <div className="space-y-2">
                  <Label className="service-card-label">Strategy</Label>

                  <Select defaultValue="one-codex" onValueChange={setStrategy}>
                    <SelectTrigger className="service-card-select-trigger">
                      <SelectValue placeholder="Select a strategy" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="one-codex">One Codex</SelectItem>
                      <SelectItem value="cdc-illumina">CDC-Illumina</SelectItem>
                      <SelectItem value="cdc-nanopore">CDC-Nanopore</SelectItem>
                      <SelectItem value="artic-nanopore">
                        ARTIC-Nanopore
                      </SelectItem>
                      <SelectItem value="auto">Auto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <div className="flex w-full flex-col gap-4 sm:flex-row sm:gap-6">
                    <div className="w-full space-y-2">
                      <Label className="service-card-label">Primer</Label>

                      <Select
                        defaultValue="artic"
                        onValueChange={(value) => {
                          setPrimer(value);
                          const selectedPrimer = primerOptions.find(
                            (option) => option.id === value,
                          );
                          setVersion(selectedPrimer?.versions[0] ?? "");
                        }}
                      >
                        <SelectTrigger className="service-card-select-trigger">
                          <SelectValue placeholder="Select primer" />
                        </SelectTrigger>
                        <SelectContent>
                          {primerOptions.map((option) => (
                            <SelectItem key={option.id} value={option.id}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="w-[50%] space-y-2">
                      <Label className="service-card-label">Version</Label>

                      <Select value={version} onValueChange={setVersion}>
                        <SelectTrigger className="service-card-select-trigger">
                          <SelectValue placeholder="Select version" />
                        </SelectTrigger>
                        <SelectContent>
                          {primerOptions
                            .find((option) => option.id === primer)
                            ?.versions.map((version) => (
                              <SelectItem key={version} value={version}>
                                {version}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
              <div className="w-full">
                <div className="flex items-center">
                  <Label className="service-card-label">Taxonomy Name</Label>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <HelpCircle className="service-card-tooltip-icon mb-2 ml-2" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Select the taxonomy name</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                <Select defaultValue="sars" onValueChange={setTaxonomyName}>
                  <SelectTrigger className="service-card-select-trigger">
                    <SelectValue placeholder="Select taxonomy" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sars">
                      Severe acute respiratory syndrome
                    </SelectItem>
                    <SelectItem value="other">Other Taxonomy</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex w-[50%] flex-col">
                <Label className="service-card-label">Taxonomy ID</Label>
                <Select defaultValue="2697049">
                  <SelectTrigger className="service-card-select-trigger">
                    <SelectValue placeholder="Select taxonomy ID" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2697049">2697049</SelectItem>
                    <SelectItem value="other">Other ID</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="service-card-label">My Label</Label>
              <Input
                className="service-card-input"
                placeholder="My identifier123"
              />
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
              <div className="w-full">
                <OutputFolder onChange={setOutputFolder} />
              </div>
              <div className="w-full">
                <OutputFolder variant="name" onChange={setOutputName} />
              </div>
            </div>
          </CardContent>
        </Card>

        {analysisInput === "read-file" && (
          <>
            {/* Input File Section */}
            <Card className="md:col-span-3">
              <CardHeader className="service-card-header">
                <CardTitle className="service-card-title">
                  Input File
                  <DialogInfoPopup
                    title={readInputFileInfo.title}
                    description={readInputFileInfo.description}
                    sections={readInputFileInfo.sections}
                  />
                </CardTitle>
              </CardHeader>

              <CardContent className="service-card-content">
                {/* TODO: Should only be able to submit Libraries once a platform is selected */}
                <div className="flex flex-col gap-4">
                  <SearchReadLibrary
                    title="Paired Read Library"
                    firstPlaceholder="Select File 1..."
                    secondPlaceholder="Select File 2..."
                    variant="pair"
                    onAdd={(files) => {
                      const newLibraries = handlePairedLibraryAdd(
                        files,
                        selectedLibraries,
                      );
                      setSelectedLibraries(newLibraries);
                    }}
                    canAdd={Boolean(prlPlatform)}
                  />
                  <Select
                    value={prlPlatform}
                    onValueChange={(value) => setPrlPlatform(value)}
                  >
                    <SelectTrigger className="service-card-select-trigger">
                      <SelectValue placeholder="Select a platform..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="illumina">Illumina</SelectItem>
                      <SelectItem value="ion-torrent">Ion Torrent</SelectItem>
                      <SelectItem value="infer-platform">
                        Infer Platform
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* TODO: Should only be able to submit Libraries once a platform is selected */}
                <div className="flex flex-col gap-4">
                  <SearchReadLibrary
                    title="Single Read Library"
                    firstPlaceholder="Select File 1..."
                    variant="single"
                    canAdd={Boolean(srlPlatform)}
                    onAdd={(files) => {
                      const newLibraries = handleSingleLibraryAdd(
                        files,
                        selectedLibraries,
                      );
                      setSelectedLibraries(newLibraries);
                    }}
                  />

                  <Select
                    value={srlPlatform}
                    onValueChange={(value) => setSrlPlatform(value)}
                  >
                    <SelectTrigger className="service-card-select-trigger">
                      <SelectValue placeholder="Select a platform..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="illumina">Illumina</SelectItem>
                      <SelectItem value="ion-torrent">Ion Torrent</SelectItem>
                      <SelectItem value="nanopore">Nanopore</SelectItem>
                      <SelectItem value="pacbio">PacBio</SelectItem>
                      <SelectItem value="infer-platform">
                        Infer Platform
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <SraRunAccession
                    selectedLibraries={selectedLibraries}
                    setSelectedLibraries={setSelectedLibraries}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Selected Libraries Section */}
            <Card className="md:col-span-3">
              <CardHeader className="service-card-header">
                <CardTitle className="service-card-title">
                  Selected Libraries
                </CardTitle>
                <CardDescription>
                  Place read files here using the arrow buttons.
                </CardDescription>
              </CardHeader>

              <CardContent className="service-card-content">
                <SelectedItemsTable
                  items={selectedLibraries.map((lib) => ({
                    id: lib.id,
                    name: lib.name,
                    type:
                      lib.type === "paired"
                        ? "Paired Read"
                        : lib.type === "single"
                          ? "Single Read"
                          : "SRA Accession",
                  }))}
                  onRemove={(id) => {
                    const newLibraries = removeFromSelectedLibraries(
                      id,
                      selectedLibraries,
                    );
                    setSelectedLibraries(newLibraries);
                  }}
                  className="max-h-84 overflow-y-auto"
                />
              </CardContent>
            </Card>
          </>
        )}

        {analysisInput === "assembly-contigs" && (
          <Card className="md:col-span-3">
            <CardHeader className="service-card-header">
              <CardTitle className="service-card-title">
                Input File
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="service-card-tooltip-icon" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Select input files for analysis</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
            </CardHeader>

            <CardContent className="service-card-content">
              <SearchWorkspaceInput
                title="Contigs"
                placeholder="Select Contigs Folder"
                onChange={setContigsFolder}
              />
            </CardContent>
          </Card>
        )}
      </form>

      {/* Action Buttons */}
      <div className="service-form-controls">
        <Button variant="outline" onClick={handleReset}>
          Reset
        </Button>
        <Button type="submit">Submit</Button>
      </div>
    </section>
  );
}
