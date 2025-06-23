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
import { Dna, HelpCircle } from "lucide-react";
import { ServiceHeader } from "@/components/services/service-header";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import SearchReadLibrary from "@/components/services/search-read-library";
import SraRunAccession from "@/components/services/sra-run-accession";
import SelectedItemsTable from "@/components/services/selected-items-table";
import OutputFolder from "@/components/services/output-folder";
import { Library } from "@/types/services";
import {
  readInputFileInfo,
  variationAnalysisInfo,
  variationAnalysisParameters,
} from "@/lib/service-info";
import {
  handlePairedLibraryAdd,
  handleSingleLibraryAdd,
  removeFromSelectedLibraries,
  handleFormSubmit,
} from "@/lib/service-utils";

const VariationAnalysisInterface = () => {
  const [selectedLibraries, setSelectedLibraries] = useState<Library[]>([]);
  const [_outputFolder, setOutputFolder] = useState<string>("");
  const [_outputName, setOutputName] = useState<string>("");

  return (
    <section>
      <ServiceHeader
        title="Variation Analysis"
        description="The Variation Analysis Service can be used to identify and annotate sequence variations."
        infoPopupTitle={variationAnalysisInfo.title}
        infoPopupDescription={variationAnalysisInfo.description}
        quickReferenceGuide="#"
        tutorial="#"
        instructionalVideo="#"
      />

      <form onSubmit={handleFormSubmit} className="space-y-6">
        <div className="mx-auto grid grid-cols-1 gap-6 md:grid-cols-2">
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
                      <p className="max-w-md">Files selected for analysis</p>
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

        <Card>
          <CardHeader className="service-card-header">
            <CardTitle className="service-card-title">
              Parameters
              <DialogInfoPopup
                title={variationAnalysisParameters.title}
                description={variationAnalysisParameters.description}
                sections={variationAnalysisParameters.sections}
              />
            </CardTitle>
          </CardHeader>

          <CardContent className="service-card-content">
            <div className="space-y-2">
              <Label className="service-card-label">Target Genome</Label>
              <div className="relative">
                <Input
                  placeholder="e.g. Mycobacterium tuberculosis H37Rv"
                  className="service-card-input pl-9"
                />
                <Dna className="absolute top-2.5 left-3 h-4 w-4 text-gray-400" />
              </div>
            </div>

            <div className="space-y-4">
              <div className="w-full space-y-2">
                <Label className="service-card-label">Aligner</Label>
                <Select defaultValue="bwa-mem">
                  <SelectTrigger className="service-card-select-trigger">
                    <SelectValue placeholder="Select aligner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bwa-mem">BWA-mem</SelectItem>
                    <SelectItem value="bwa-mem-strict">
                      BWA-mem-strict
                    </SelectItem>
                    <SelectItem value="bowtie2">Bowtie2</SelectItem>
                    <SelectItem value="last">LAST</SelectItem>
                    <SelectItem value="minimap2">Minimap2</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full space-y-2">
                <Label className="service-card-label">SNP Caller</Label>
                <Select defaultValue="freebayes">
                  <SelectTrigger className="service-card-select-trigger">
                    <SelectValue placeholder="Select SNP caller" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="freebayes">FreeBayes</SelectItem>
                    <SelectItem value="bcftools">BCFtools</SelectItem>
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

      <div className="service-form-controls">
        <Button variant="outline" type="reset">
          Reset
        </Button>
        <Button type="submit">Submit</Button>
      </div>
    </section>
  );
};

export default VariationAnalysisInterface;
