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
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ServiceHeader } from "@/components/services/service-header";
import { Plus, HelpCircle } from "lucide-react";
import SelectedItemsTable from "@/components/services/selected-items-table";
import SearchReadLibrary from "@/components/services/search-read-library";
import {
  handlePairedLibraryAdd,
  handleSingleLibraryAdd,
  removeFromSelectedLibraries,
  PipelineAction,
  pipelineActionList,
  actionColors,
  actionShapes,
  removeFromSelectedPipelineActions,
  handleFormSubmit
} from "@/lib/service-utils";
import { Library } from "@/types/services";
import {
  fastqUtilitiesInfo,
  fastqUtilitiesParameters,
  fastqUtilitiesPipeline,
  readInputFileInfo,
} from "@/lib/service-info";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import OutputFolder from "@/components/services/output-folder";
import SraRunAccession from "@/components/services/sra-run-accession";

const FastqUtilitiesService = () => {
  const [selectedLibraries, setSelectedLibraries] = useState<Library[]>([]);
  const [srlPlatform, setSRLPlatform] = useState("");
  const [selectedAction, setSelectedAction] = useState<string>("");
  const [lastColorIndex, setLastColorIndex] = useState(0);
  const [lastShapeIndex, setLastShapeIndex] = useState(0);
  const [_outputFolder, setOutputFolder] = useState("");
  const [_outputName, setOutputName] = useState("");
  const [selectedPipelineActions, setSelectedPipelineActions] = useState<
    PipelineAction[]
  >([]);

  const getNextColor = () => {
    const color = actionColors[lastColorIndex % actionColors.length];
    setLastColorIndex((prev) => prev + 1);
    return color;
  };

  const getNextShape = () => {
    const shape = actionShapes[lastShapeIndex % actionShapes.length];
    setLastShapeIndex((prev) => prev + 1);
    return shape;
  };


  return (
    <section>
      <ServiceHeader
        title="FastQ Utilities"
        description="The FastQ Utilities Service provides capability for aligning,
          measuring base call quality, and trimming fastq read files."
        infoPopupTitle={fastqUtilitiesInfo.title}
        infoPopupDescription={fastqUtilitiesInfo.description}
        quickReferenceGuide="#"
        tutorial="#"
        instructionalVideo="#"
      />

      <form
        onSubmit={handleFormSubmit}
        className="grid grid-cols-1 gap-6 md:grid-cols-12"
      >
        <div className="md:col-span-7">
          <Card className="h-full">
            <CardHeader className="service-card-header">
              <CardTitle className="service-card-title">
                Parameters
                <DialogInfoPopup
                  title={fastqUtilitiesParameters.title}
                  sections={fastqUtilitiesParameters.sections}
                />
              </CardTitle>
            </CardHeader>

            <CardContent className="service-card-content">
              <div className="w-full">
                <OutputFolder onChange={setOutputFolder} />
              </div>
              <div className="w-full">
                <OutputFolder variant="name" onChange={setOutputName} />
              </div>

              <div>
                <Label className="service-card-label">Target Genome</Label>
                <Select disabled={true}>
                  <SelectTrigger className="service-card-select-trigger">
                    <SelectValue placeholder="e.g. Mycobacterium tuberculosis H37Rv" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trim">Trim</SelectItem>
                    <SelectItem value="paired_filter">Paired Filter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-5">
          <Card className="h-full">
            <CardHeader className="service-card-header">
              <CardTitle className="service-card-title">
                Pipeline
                <DialogInfoPopup
                  title={fastqUtilitiesPipeline.title}
                  sections={fastqUtilitiesPipeline.sections}
                />
              </CardTitle>
            </CardHeader>

            <CardContent className="service-card-content">
              <div>
                <Label className="service-card-label">Select Action</Label>
                <div className="flex items-center gap-2">
                  <Select
                    value={selectedAction}
                    onValueChange={setSelectedAction}
                  >
                    <SelectTrigger className="service-card-select-trigger">
                      <SelectValue placeholder="Select Action" />
                    </SelectTrigger>
                    <SelectContent>
                      {pipelineActionList.map((action) => (
                        <SelectItem key={action.id} value={action.id}>
                          {action.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      if (selectedAction) {
                        const actionInfo = pipelineActionList.find(
                          (action) => action.id === selectedAction,
                        );
                        if (actionInfo) {
                          setSelectedPipelineActions([
                            ...selectedPipelineActions,
                            {
                              id: `${selectedAction}_${Date.now()}`,
                              name: actionInfo.name,
                              color: getNextColor(),
                              shape: getNextShape(),
                            },
                          ]);
                        }
                      }
                    }}
                    disabled={!selectedAction}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <SelectedItemsTable
                title=""
                description=""
                items={selectedPipelineActions}
                onRemove={(id) => {
                  setSelectedPipelineActions(
                    removeFromSelectedPipelineActions(id, selectedPipelineActions)
                  );
                }}
                className="max-h-48 overflow-y-auto"
              />
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-7">
          <div className="space-y-6">
            <Card>
              <CardHeader className="service-card-header">
                <CardTitle className="service-card-title">
                  Input Library
                  <DialogInfoPopup
                    title={readInputFileInfo.title}
                    description={readInputFileInfo.description}
                    sections={readInputFileInfo.sections}
                  />
                </CardTitle>
              </CardHeader>

              <CardContent className="service-card-content">
                <div id="paired-read-library">
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
                </div>

                <div id="single-read-library" className="space-y-4">
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
                    canAdd={Boolean(srlPlatform)}
                  />

                  <div className="flex flex-col">
                    <Label className="service-card-sublabel">Platform</Label>
                    <Select value={srlPlatform} onValueChange={setSRLPlatform}>
                      <SelectTrigger className="service-card-select-trigger">
                        <SelectValue
                          placeholder="Select a Platform..."
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="illumina">Illumina</SelectItem>
                        <SelectItem value="pacbio">PacBio</SelectItem>
                        <SelectItem value="nanopore">Nanopore</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div id="sra-run-accession">
                  <SraRunAccession
                    selectedLibraries={selectedLibraries}
                    setSelectedLibraries={setSelectedLibraries}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="md:col-span-5">
          <Card className="h-full max-h-full">
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
                onRemove={(id) => {
                  const newLibraries = removeFromSelectedLibraries(
                    id,
                    selectedLibraries,
                  );
                  setSelectedLibraries(newLibraries);
                }}
                className="max-h-150 overflow-y-auto"
              />
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

export default FastqUtilitiesService;
