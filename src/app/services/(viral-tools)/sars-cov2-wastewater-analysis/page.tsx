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
import { Label } from "@/components/ui/label";
import { HelpCircle } from "lucide-react";
import { ServiceHeader } from "@/components/services/service-header";
import SearchReadLibrary from "@/components/services/search-read-library";
import { Library, primerOptions } from "@/types/services";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import SelectedItemsTable from "@/components/services/selected-items-table";
import OutputFolder from "@/components/services/output-folder";
import SraRunAccession from "@/components/services/sra-run-accession";
import {
  handlePairedLibraryAdd,
  handleSingleLibraryAdd,
  removeFromSelectedLibraries,
  handleFormSubmit,
} from "@/lib/service-utils";
import {
  sarsCov2WastewaterAnalysisInfo,
  sarsCov2WastewaterAnalysisInputLib,
} from "@/lib/service-info";

export default function WastewaterAnalysis() {
  const [selectedLibraries, setSelectedLibraries] = useState<Library[]>([]);
  const [primer, setPrimer] = useState<string>("artic");
  const [_outputFolder, setOutputFolder] = useState<string>("");
  const [_outputName, setOutputName] = useState<string>("");
  const [version, setVersion] = useState<string>(
    primerOptions.find((option) => option.id === primer)?.versions[0] ?? "",
  );

  return (
    <section>
      <ServiceHeader
        title="SARS-CoV-2 Wastewater Analysis"
        description="The SARS-CoV-2 Wastewater Analysis assembles raw reads with the Sara
          One Codex pipeline and performs variant analysis with Freyja."
        infoPopupTitle={sarsCov2WastewaterAnalysisInfo.title}
        infoPopupDescription={sarsCov2WastewaterAnalysisInfo.description}
        quickReferenceGuide="#"
        tutorial="#"
        instructionalVideo="#"
      />

      {/* Main Content */}
      <form
        onSubmit={handleFormSubmit}
        className="grid grid-cols-1 gap-6 lg:grid-cols-2"
      >
        {/* Input Library Section */}
        <Card>
          <CardHeader className="service-card-header">
            <CardTitle className="service-card-title">
              Input Library Selection
              <DialogInfoPopup
                title={sarsCov2WastewaterAnalysisInputLib.title}
                description={sarsCov2WastewaterAnalysisInputLib.description}
                sections={sarsCov2WastewaterAnalysisInputLib.sections}
              />
            </CardTitle>
            <CardDescription>
              Send to selected libraries using the arrow buttons.
            </CardDescription>
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

            <div className="service-card-row">
              <div className="flex w-full flex-col gap-2">
                <Label className="service-card-label">Primers</Label>
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

              <div className="flex w-full flex-col gap-2">
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

            <div className="space-y-3">
              <Label className="service-card-label">Sample Identifier</Label>
              <Input className="service-card-input" placeholder="SAMPLE ID" />
            </div>

            {/* TODO: Change to date picker with text input */}
            <div className="space-y-3">
              <Label className="service-card-label">Sample Date</Label>
              <DatePickerInput className="w-full" />
            </div>
          </CardContent>
        </Card>

        {/* Selected Libraries Section */}
        <Card>
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
          </CardHeader>

          <CardContent className="service-card-content">
            <SelectedItemsTable
              title="Selected Libraries"
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

        {/* Parameters Section */}
        <Card className="lg:col-span-2">
          <CardHeader className="service-card-header">
            <CardTitle className="service-card-title">
              Parameters
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="service-card-tooltip-icon" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Configure analysis parameters</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
          </CardHeader>

          <CardContent className="service-card-content">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="service-card-label">Strategy</Label>
                <Select defaultValue="codex">
                  <SelectTrigger className="service-card-select-trigger">
                    <SelectValue placeholder="Select a strategy" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="codex">One Codex</SelectItem>
                    <SelectItem value="other">Other Strategy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="service-card-row">
              <div className="w-full">
                <OutputFolder onChange={setOutputFolder} />
              </div>
              <div className="w-full">
                <OutputFolder variant="name" onChange={setOutputName} />
              </div>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Action Buttons */}
      <div className="service-form-controls">
        <Button variant="outline">Reset</Button>
        <Button type="submit">Submit</Button>
      </div>
    </section>
  );
}
