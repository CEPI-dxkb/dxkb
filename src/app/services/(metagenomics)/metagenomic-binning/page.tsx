"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { ServiceHeader } from "@/components/services/service-header";
import SearchWorkspaceInput from "@/components/services/search-workspace-input";
import SearchReadLibrary from "@/components/services/search-read-library";
import SelectedItemsTable from "@/components/services/selected-items-table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { NumberInput } from "@/components/ui/number-input";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import SraRunAccession from "@/components/services/sra-run-accession";
import OutputFolder from "@/components/services/output-folder";
import { ChevronDown, HelpCircle } from "lucide-react";
import { Library } from "@/types/services";
import {
  metagenomicBinningInfo,
  metagenomicBinningInputFile,
  metagenomicBinningParameters,
  metagenomicBinningStartWith,
} from "@/lib/service-info";
import {
  handlePairedLibraryAdd,
  handleSingleLibraryAdd,
  removeFromSelectedLibraries,
  handleFormSubmit,
} from "@/lib/service-utils";

const MetagenomicBinningService = () => {
  const [selectedLibraries, setSelectedLibraries] = useState<Library[]>([]);
  const [showAdvanced, setAdvanced] = useState(false);
  const [startingDataType, setStartingDataType] = useState("read-file");
  const [_outputFolder, setOutputFolder] = useState("");
  const [_outputName, setOutputName] = useState("");
  const [assemblyStrategy, setAssemblyStrategy] = useState("auto");
  const [organismsOfInterest, setOrganismsOfInterest] = useState("both");

  return (
    <section>
      <ServiceHeader
        title="Metagenomic Binning"
        description="The Metagenomic Binning Service accepts either reads or contigs, and
          attempts to 'bin' the data into a set of genomes. This service can be
          used to reconstruct bacterial and archaeal genomes from environmental
          samples."
        infoPopupTitle={metagenomicBinningInfo.title}
        infoPopupDescription={metagenomicBinningInfo.description}
        quickReferenceGuide="#"
        tutorial="#"
        instructionalVideo="#"
      />

      <form
        onSubmit={handleFormSubmit}
        className="grid grid-cols-1 gap-6 md:grid-cols-12"
      >
        <div className="md:col-span-12" id="start-with-section">
          {/* Start With Section */}
          <Card>
            <CardHeader className="service-card-header">
              <CardTitle className="service-card-title">
                Start With
                <DialogInfoPopup
                  title={metagenomicBinningStartWith.title}
                  description={metagenomicBinningStartWith.description}
                  sections={metagenomicBinningStartWith.sections}
                />
              </CardTitle>
            </CardHeader>

            <CardContent className="service-card-content">
              <RadioGroup
                defaultValue="read-file"
                className="service-radio-group"
                onValueChange={setStartingDataType}
              >
                <div className="service-radio-group-item">
                  <RadioGroupItem value="read-file" id="read-file" />
                  <Label htmlFor="read-file">Read Files</Label>
                </div>
                <div className="service-radio-group-item">
                  <RadioGroupItem
                    value="assembled-contigs"
                    id="assembled-contigs"
                  />
                  <Label htmlFor="assembled-contigs">Assembled Contigs</Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>
        </div>

        {startingDataType === "read-file" && (
          <>
            <div className="md:col-span-7" id="input-file-section">
              {/* Input File Section */}
              <Card className="h-full">
                <CardHeader className="service-card-header">
                  <CardTitle className="service-card-title">
                    Input File
                    <DialogInfoPopup
                      title={metagenomicBinningInputFile.title}
                      description={metagenomicBinningInputFile.description}
                      sections={metagenomicBinningInputFile.sections}
                    />
                  </CardTitle>
                </CardHeader>

                <CardContent className="service-card-content space-y-4">
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
                  />

                  <SearchReadLibrary
                    title="Single Read Library"
                    firstPlaceholder="Select File 1..."
                    variant="single"
                    onAdd={(files) => {
                      const newLibraries = handleSingleLibraryAdd(
                        files,
                        selectedLibraries,
                      );
                      setSelectedLibraries(newLibraries);
                    }}
                  />

                  <SraRunAccession
                    selectedLibraries={selectedLibraries}
                    setSelectedLibraries={setSelectedLibraries}
                  />
                </CardContent>
              </Card>
            </div>

            <div className="md:col-span-5" id="selected-libraries-section">
              {/* Selected Libraries Section */}
              <Card className="h-full">
                <CardHeader className="service-card-header">
                  <CardTitle className="service-card-title">
                    Selected Libraries
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <HelpCircle className="service-card-tooltip-icon" />
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
                    onRemove={(id: string) => {
                      const newLibraries = removeFromSelectedLibraries(
                        id,
                        selectedLibraries,
                      );
                      setSelectedLibraries(newLibraries);
                    }}
                  />
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {startingDataType === "assembled-contigs" && (
          <div className="md:col-span-12" id="assembled-contigs-section">
            <Card>
              <CardHeader className="service-card-header">
                <CardTitle className="service-card-title">
                  Input File
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <HelpCircle className="service-card-tooltip-icon" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Select your input files here</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardTitle>
              </CardHeader>

              <CardContent className="service-card-content space-y-6">
                <SearchWorkspaceInput
                  title="Assembled Contigs"
                  placeholder="Select Assembled Contigs..."
                />
              </CardContent>
            </Card>
          </div>
        )}

        <div className="md:col-span-12" id="parameters-section">
          {/* Parameters Section */}
          <Card>
            <CardHeader className="service-card-header">
              <CardTitle className="service-card-title">
                Parameters
                <DialogInfoPopup
                  title={metagenomicBinningParameters.title}
                  description={metagenomicBinningParameters.description}
                  sections={metagenomicBinningParameters.sections}
                />
              </CardTitle>
            </CardHeader>

            <CardContent>
              <div className="space-y-6">
                <div className="flex w-full flex-col gap-4 md:flex-row">
                  {startingDataType === "read-file" && (
                    <div className="w-full">
                      <Label className="service-card-label">
                        Assembly Strategy
                      </Label>

                      <RadioGroup
                        defaultValue={assemblyStrategy}
                        className="service-radio-group"
                        onValueChange={setAssemblyStrategy}
                      >
                        <div className="service-radio-group-item">
                          <RadioGroupItem value="metaspades" id="metaspades" />
                          <Label htmlFor="metaspades" className="text-sm">
                            MetaSPAdes
                          </Label>
                        </div>
                        <div className="service-radio-group-item">
                          <RadioGroupItem value="megahit" id="megahit" />
                          <Label htmlFor="megahit" className="text-sm">
                            MEGAHIT
                          </Label>
                        </div>
                        <div className="service-radio-group-item">
                          <RadioGroupItem value="auto" id="auto" />
                          <Label htmlFor="auto" className="text-sm">
                            Auto
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                  )}

                  <div className="w-full">
                    <Label className="service-card-label">
                      Organisms of Interest
                    </Label>

                    <RadioGroup
                      defaultValue={organismsOfInterest}
                      className="service-radio-group"
                      onValueChange={setOrganismsOfInterest}
                    >
                      <div className="service-radio-group-item">
                        <RadioGroupItem
                          value="bacteria-archaea"
                          id="bacteria-archaea"
                        />
                        <Label htmlFor="bacteria-archaea" className="text-sm">
                          Bacteria/Archaea
                        </Label>
                      </div>
                      <div className="service-radio-group-item">
                        <RadioGroupItem value="viruses" id="viruses" />
                        <Label htmlFor="viruses" className="text-sm">
                          Viruses
                        </Label>
                      </div>
                      <div className="service-radio-group-item">
                        <RadioGroupItem value="both" id="both" />
                        <Label htmlFor="both" className="text-sm">
                          Both
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>

                <div className="mt-4 space-y-6">
                  <div className="flex flex-col space-y-4">
                    <div className="w-full">
                      <OutputFolder onChange={setOutputFolder} />
                    </div>
                    <div className="w-full">
                      <OutputFolder variant="name" onChange={setOutputName} />
                    </div>
                  </div>

                  <div>
                    <Label className="service-card-label">
                      Genome Group Name
                    </Label>
                    <Input
                      defaultValue=""
                      placeholder="My Genome Group"
                      className="service-card-input"
                    />
                  </div>
                </div>

                <Collapsible
                  open={showAdvanced}
                  onOpenChange={setAdvanced}
                  className="service-collapsible-container"
                >
                  <CollapsibleTrigger className="service-collapsible-trigger text-sm font-medium">
                    Advanced Parameters
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-180 transform" : ""}`}
                    />
                  </CollapsibleTrigger>

                  <CollapsibleContent className="service-collapsible-content">
                    <div className="mt-6 space-y-4">
                      <div className="service-card-row">
                        <div className="w-full">
                          <Label className="service-card-sublabel">
                            Minimum Contig Length
                          </Label>
                          <NumberInput
                            id="minimum-contig-length"
                            defaultValue={300}
                            min={100}
                            max={100000}
                            stepper={10}
                          />
                        </div>

                        <div className="w-full">
                          <Label className="service-card-sublabel">
                            Minimum Contig Coverage
                          </Label>
                          <NumberInput
                            id="minimum-contig-coverage"
                            defaultValue={5}
                            min={0}
                            max={100000}
                            stepper={1}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="disable-search"
                          className="mb-2 bg-white"
                        />
                        <Label
                          htmlFor="disable-search"
                          className="service-card-sublabel"
                        >
                          Disable Search For Dangling Contigs (Decreases Memory
                          Use)
                        </Label>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>

      <div className="service-form-controls">
        <Button variant="outline">Reset</Button>
        <Button>Submit</Button>
      </div>
    </section>
  );
};

export default MetagenomicBinningService;
