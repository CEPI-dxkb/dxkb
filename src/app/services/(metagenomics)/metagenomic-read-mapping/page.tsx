"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  handlePairedLibraryAdd,
  handleSingleLibraryAdd,
  removeFromSelectedLibraries,
  handleFormSubmit,
} from "@/lib/service-utils";
import { ServiceHeader } from "@/components/services/service-header";
import SearchReadLibrary from "@/components/services/search-read-library";
import SelectedItemsTable from "@/components/services/selected-items-table";
import SearchWorkspaceInput from "@/components/services/search-workspace-input";
import { Library } from "@/types/services";
import {
  metagenomicReadMappingInfo,
  metagenomicReadMappingParameters,
  readInputFileInfo,
} from "@/lib/service-info";
import SraRunAccession from "@/components/services/sra-run-accession";
import { HelpCircle } from "lucide-react";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import OutputFolder from "@/components/services/output-folder";

const MetagenomicReadMappingService = () => {
  const [selectedLibraries, setSelectedLibraries] = useState<Library[]>([]);
  const [geneSetType, setGeneSetType] = useState("predefined-list");
  // const [_geneSetName, setGeneSetName] = useState("card");
  const [_outputFolder, setOutputFolder] = useState("");
  const [_outputName, setOutputName] = useState("");

  return (
    <section>
      <ServiceHeader
        title="Metagenomic Read Mapping"
        description="The Metagenomic Read Mapping Service uses KMA to align reads against
          antibiotic resistance genes from CARD and virulence factors from VFDB."
        infoPopupTitle={metagenomicReadMappingInfo.title}
        infoPopupDescription={metagenomicReadMappingInfo.description}
        quickReferenceGuide="#"
        tutorial="#"
        instructionalVideo="#"
      />

      <form
        onSubmit={handleFormSubmit}
        className="grid grid-cols-1 gap-6 md:grid-cols-12"
      >
        <div className="md:col-span-7">
          <Card>
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

        <div className="md:col-span-5">
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

            <CardContent>
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
              />
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-12">
          {/* Parameters Section */}
          <Card>
            <CardHeader className="service-card-header">
              <CardTitle className="service-card-title">
                Parameters
                <DialogInfoPopup
                  title={metagenomicReadMappingParameters.title}
                  description={metagenomicReadMappingParameters.description}
                  sections={metagenomicReadMappingParameters.sections}
                />
              </CardTitle>
            </CardHeader>

            <CardContent>
              <div className="space-y-6">
                <div className="flex w-full flex-col gap-4 space-y-4 md:flex-row md:space-y-0">
                  <div className="w-full">
                    <Label className="service-card-label">Gene Set Type</Label>

                    <RadioGroup
                      defaultValue="predefined-list"
                      className="service-radio-group"
                      onValueChange={setGeneSetType}
                    >
                      <div className="service-radio-group-item">
                        <RadioGroupItem
                          value="predefined-list"
                          id="predefined-list"
                        />
                        <Label htmlFor="predefined-list" className="text-sm">
                          Predefined List
                        </Label>
                      </div>
                      <div className="service-radio-group-item">
                        <RadioGroupItem value="fasta-file" id="fasta-file" />
                        <Label htmlFor="fasta-file" className="text-sm">
                          FASTA File
                        </Label>
                      </div>
                      <div className="service-radio-group-item">
                        <RadioGroupItem
                          value="feature-group"
                          id="feature-group"
                        />
                        <Label htmlFor="feature-group" className="text-sm">
                          Feature Group
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>

                {geneSetType === "predefined-list" && (
                  <div className="w-full">
                    <Label className="service-card-label">
                      Predefined Gene Set Name
                    </Label>
                    <Select defaultValue="card">
                      <SelectTrigger className="service-card-select-trigger">
                        <SelectValue placeholder="Select Genome Group" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="card">CARD</SelectItem>
                        <SelectItem value="vfdb">VFDB</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {geneSetType === "fasta-file" && (
                  <div className="w-full">
                    <SearchWorkspaceInput
                      title="Gene Set FASTA"
                      placeholder="Select Gene Set FASTA File..."
                    />
                  </div>
                )}

                {geneSetType === "feature-group" && (
                  <div className="w-full">
                    <SearchWorkspaceInput
                      title="Gene Set Feature Group"
                      placeholder="Select Gene Set Feature Group..."
                    />
                  </div>
                )}

                <div className="flex flex-col space-y-4">
                  <div className="w-full">
                    <OutputFolder onChange={setOutputFolder} />
                  </div>
                  <div className="w-full">
                    <OutputFolder variant="name" onChange={setOutputName} />
                  </div>
                </div>
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

export default MetagenomicReadMappingService;
