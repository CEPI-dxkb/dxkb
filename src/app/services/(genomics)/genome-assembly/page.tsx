"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  HelpCircle,
  ChevronDown,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { NumberInput } from "@/components/ui/number-input";
import { ServiceHeader } from "@/components/services/service-header";
import {
  genomeAssemblyInfo,
  genomeAssemblyParameters,
  readInputFileInfo,
} from "@/lib/service-info";
import {
  handleFormSubmit,
  handlePairedLibraryAdd,
  handleSingleLibraryAdd,
  removeFromSelectedLibraries,
} from "@/lib/service-utils";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import SearchReadLibrary from "@/components/services/search-read-library";
import SraRunAccession from "@/components/services/sra-run-accession";
import SelectedItemsTable from "@/components/services/selected-items-table";
import OutputFolder from "@/components/services/output-folder";
import { Library } from "@/types/services";

export default function GenomeAssemblyPage() {
  const [selectedLibraries, setSelectedLibraries] = useState<Library[]>([]);
  const [_outputFolder, setOutputFolder] = useState("");
  const [_outputName, setOutputName] = useState("");
  const [assemblyStrategy, setAssemblyStrategy] = useState("auto");
  const [genomeSizeUnit, setGenomeSizeUnit] = useState("M");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const resetForm = () => {
    setSelectedLibraries([]);
    setOutputFolder("");
    setOutputName("");
    setAssemblyStrategy("auto");
    setShowAdvanced(false);
  };

  return (
    <section>
      <ServiceHeader
        title="Genome Assembly"
        description="The Genome Assembly Service allows single or multiple assemblers to be invoked to compare results. The service attempts to select the best assembly."
        infoPopupTitle={genomeAssemblyInfo.title}
        infoPopupDescription={genomeAssemblyInfo.description}
        quickReferenceGuide="#"
        tutorial="#"
        instructionalVideo="#"
      />

      <form
        onSubmit={handleFormSubmit}
        className="grid grid-cols-1 space-x-6 lg:grid-cols-12"
      >
        {/* Left Column */}
        <div className="space-y-6 lg:col-span-7">
          <Card>
            <CardHeader className="service-card-header">
              <CardTitle className="service-card-title">
                Input Files
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

          <Card>
            <CardHeader className="service-card-header">
              <CardTitle className="service-card-title">
                Parameters
                <DialogInfoPopup
                  title={genomeAssemblyParameters.title}
                  description={genomeAssemblyParameters.description}
                  sections={genomeAssemblyParameters.sections}
                />
              </CardTitle>
            </CardHeader>

            <CardContent className="service-card-content">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label
                    htmlFor="assembly-strategy"
                    className="service-card-label"
                  >
                    Assembly Strategy
                  </Label>
                  <Select
                    value={assemblyStrategy}
                    onValueChange={setAssemblyStrategy}
                  >
                    <SelectTrigger id="assembly-strategy">
                      <SelectValue placeholder="Select strategy" />
                    </SelectTrigger>
                    <SelectContent className="service-card-select-content">
                      <SelectItem value="auto">Auto</SelectItem>
                      <SelectItem value="unicycler">Unicycler</SelectItem>
                      <SelectItem value="spades">SPAdes</SelectItem>
                      <SelectItem value="canu">Canu</SelectItem>
                      <SelectItem value="metaspades">MetaSPAdes</SelectItem>
                      <SelectItem value="plasmidspades">
                        PlasmidSPAdes
                      </SelectItem>
                      <SelectItem value="mda">MDA (single-cell)</SelectItem>
                      <SelectItem value="flye">Flye</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <OutputFolder onChange={setOutputFolder} />

                <OutputFolder variant="name" onChange={setOutputName} />

                <Collapsible
                  open={showAdvanced}
                  onOpenChange={setShowAdvanced}
                  className="service-collapsible-container"
                >
                  <CollapsibleTrigger className="service-collapsible-trigger">
                    Advanced Options
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-180 transform" : ""}`}
                    />
                  </CollapsibleTrigger>

                  <CollapsibleContent className="service-collapsible-content">
                    <div className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-3">
                      <div className="space-y-2">
                        <Label
                          htmlFor="illumina-reads"
                          className="service-card-label"
                        >
                          Normalize Illumina Reads
                        </Label>
                        <Switch id="illumina-reads" defaultChecked={true} />
                      </div>
                      <div className="space-y-2">
                        <Label
                          htmlFor="trim-short-reads"
                          className="service-card-label"
                        >
                          Trim Short Reads
                        </Label>
                        <Switch id="trim-short-reads" defaultChecked={true} />
                      </div>
                      <div className="space-y-2">
                        <Label
                          htmlFor="filter-long-reads"
                          className="service-card-label"
                        >
                          Filter Long Reads
                        </Label>
                        <Switch id="filter-long-reads" defaultChecked={true} />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <Label className="service-card-label">
                        Genome Parameters
                      </Label>

                      <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-end">
                        <div className="flex flex-col gap-2">
                          <Label
                            htmlFor="genome-coverage"
                            className="service-card-sublabel"
                          >
                            Genome Coverage
                          </Label>
                          <NumberInput
                            id="genome-coverage"
                            min={100}
                            max={500}
                            stepper={50}
                            defaultValue={200}
                          />
                        </div>
                        <p className="p-1 text-lg">x</p>
                        <div className="flex flex-col gap-2">
                          <Label
                            htmlFor="genome-size"
                            className="service-card-sublabel"
                          >
                            Genome Size
                          </Label>
                          <div className="flex flex-row items-center gap-2">
                            <NumberInput
                              id="genome-size"
                              min={1}
                              max={500}
                              stepper={50}
                              defaultValue={200}
                            />
                            <Select
                              value={genomeSizeUnit}
                              onValueChange={setGenomeSizeUnit}
                            >
                              <SelectTrigger
                                id="genome-size-unit"
                                className="service-card-select-trigger"
                              >
                                <SelectValue placeholder="Select unit" />
                              </SelectTrigger>
                              <SelectContent className="service-card-select-content">
                                <SelectItem value="M">M</SelectItem>
                                <SelectItem value="K">K</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <Label className="service-card-label">
                        Assembly Polishing
                      </Label>
                      <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-end">
                        <div className="flex flex-col gap-2">
                          <Label
                            htmlFor="racon-iterations"
                            className="service-card-sublabel"
                          >
                            Racon Iterations
                          </Label>
                          <NumberInput
                            id="racon-iterations"
                            min={0}
                            max={4}
                            defaultValue={2}
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label
                            htmlFor="pilon-iterations"
                            className="service-card-sublabel"
                          >
                            Pilon Iterations
                          </Label>
                          <NumberInput
                            id="pilon-iterations"
                            min={0}
                            max={4}
                            defaultValue={2}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <Label className="service-card-label">
                        Assembly Thresholds
                      </Label>
                      <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-end">
                        <div className="flex flex-col gap-2">
                          <Label
                            htmlFor="genome-coverage"
                            className="service-card-sublabel"
                          >
                            Genome Coverage
                          </Label>
                          <NumberInput
                            id="genome-coverage"
                            min={100}
                            max={10000}
                            stepper={10}
                            defaultValue={300}
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label
                            htmlFor="genome-size"
                            className="service-card-sublabel"
                          >
                            Genome Size
                          </Label>
                          <NumberInput
                            id="genome-size"
                            min={0}
                            max={10000}
                            stepper={5}
                            defaultValue={5}
                          />
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-5">
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
                      <p>
                        Read files placed here will contribute to a single
                        analysis.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
              <CardDescription>
                Place read files here using the arrow buttons.
              </CardDescription>
            </CardHeader>

            <CardContent className="service-card-content">
              <SelectedItemsTable
                items={selectedLibraries.map((library) => ({
                  id: library.id,
                  name: library.name,
                  type: library.type,
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
        </div>
      </form>

      <div className="service-form-controls">
        <Button variant="outline" onClick={resetForm}>
          Reset
        </Button>
        <Button>Assemble</Button>
      </div>
    </section>
  );
}
