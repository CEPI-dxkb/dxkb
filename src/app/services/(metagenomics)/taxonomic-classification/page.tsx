"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ServiceHeader } from "@/components/services/service-header";
import SearchReadLibrary from "@/components/services/search-read-library";
import SelectedItemsTable from "@/components/services/selected-items-table";
import SraRunAccession from "@/components/services/sra-run-accession";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import OutputFolder from "@/components/services/output-folder";
import { HelpCircle } from "lucide-react";
import { Library } from "@/types/services";
import {
  handlePairedLibraryAdd,
  handleSingleLibraryAdd,
  removeFromSelectedLibraries,
  handleFormSubmit,
} from "@/lib/services/service-utils";
import {
  taxonomyClassificationAnalysisType,
  taxonomyClassificationDatabase,
  taxonomyClassificationFilterHostReads,
  taxonomyClassificatioConfidenceInterval,
  taxonomyClassificationInfo,
  taxonomyClassificationInput,
  taxonomyClassificationParameters,
} from "@/lib/services/service-info";

const TaxonomicClassificationService = () => {
  const [selectedLibraries, setSelectedLibraries] = useState<Library[]>([]);
  const [sequencingType, setSequencingType] = useState("wgs");
  const [_outputFolder, setOutputFolder] = useState("");
  const [_outputName, setOutputName] = useState("");
  const [selectedDatabase, setSelectedDatabase] = useState(
    sequencingType === "wgs" ? "bvbrc" : "silva",
  );
  const [selectedAnalysisType, setSelectedAnalysisType] = useState(
    sequencingType === "wgs" ? "microbiome" : "default",
  );
  const [saveClassifiedSequences, setSaveClassifiedSequences] = useState("no");
  const [saveUnclassifiedSequences, setSaveUnclassifiedSequences] =
    useState("no");

  useEffect(() => {
    setSelectedDatabase(sequencingType === "wgs" ? "bvbrc" : "silva");
  }, [sequencingType]);

  useEffect(() => {
    setSelectedAnalysisType(
      sequencingType === "wgs" ? "microbiome" : "default",
    );
  }, [sequencingType]);

  const [sampleIdentifiers, setSampleIdentifiers] = useState({
    paired: "Sample ID",
    single: "Sample ID",
    sra: "Sample ID",
  });

  return (
    <section>
      <ServiceHeader
        title="Taxonomic Classification"
        description="The Taxonomic Classification Service computes taxonomic classification
          for read data."
        infoPopupTitle={taxonomyClassificationInfo.title}
        infoPopupDescription={taxonomyClassificationInfo.description}
        quickReferenceGuide="#"
        tutorial="#"
        instructionalVideo="#"
      />

      <form
        onSubmit={handleFormSubmit}
        className="grid grid-cols-1 gap-6 md:grid-cols-12"
      >
        <div className="md:col-span-7">
          {/* Input File Section */}
          <Card>
            <CardHeader className="service-card-header">
              <CardTitle className="service-card-title">
                Input File
                <DialogInfoPopup
                  title={taxonomyClassificationInput.title}
                  description={taxonomyClassificationInput.description}
                />
              </CardTitle>
            </CardHeader>

            <CardContent className="service-card-content !space-y-8">
              <div id="paired-read-library" className="space-y-4">
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
                  // canAdd={Boolean(sampleIdentifiers)}
                />

                <div>
                  <Label className="service-card-sublabel">
                    Paired Sample Identifier
                  </Label>
                  <Input
                    onChange={(e) =>
                      setSampleIdentifiers({
                        ...sampleIdentifiers,
                        paired: e.target.value,
                      })
                    }
                    className="service-card-input"
                    placeholder="Sample ID"
                  />
                </div>
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
                  // canAdd={Boolean(sampleIdentifiers)}
                />

                <div className="mt-2">
                  <Label className="service-card-sublabel">
                    Single Sample Identifier
                  </Label>
                  <Input
                    onChange={(e) =>
                      setSampleIdentifiers({
                        ...sampleIdentifiers,
                        single: e.target.value,
                      })
                    }
                    className="service-card-input"
                    placeholder="Sample ID"
                  />
                </div>
              </div>

              <div id="sra-run-accession" className="space-y-4">
                <SraRunAccession
                  selectedLibraries={selectedLibraries}
                  setSelectedLibraries={setSelectedLibraries}
                />

                <div className="mt-2">
                  <Label className="service-card-sublabel">
                    SRA Sample Identifier
                  </Label>
                  <Input
                    onChange={(e) =>
                      setSampleIdentifiers({
                        ...sampleIdentifiers,
                        sra: e.target.value,
                      })
                    }
                    className="service-card-input"
                    placeholder="Sample ID"
                  />
                </div>
              </div>
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
                  title={taxonomyClassificationParameters.title}
                  description={taxonomyClassificationParameters.description}
                />
              </CardTitle>
            </CardHeader>

            <CardContent className="service-card-content">
              <div className="space-y-6">
                <div className="space-y-6">
                  <div id="sequencing-type-container">
                    <div className="flex items-center gap-2">
                      <Label className="service-card-label">
                        Sequencing Type
                      </Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <HelpCircle className="service-card-tooltip-icon mb-2" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              Please select the sequencing type according to
                              your input reads or SRA run accession.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>

                    <RadioGroup
                      defaultValue="wgs"
                      className="service-radio-group"
                      onValueChange={setSequencingType}
                    >
                      <div className="service-radio-group-item">
                        <RadioGroupItem value="wgs" id="wgs" />
                        <Label htmlFor="wgs" className="text-sm">
                          Whole Genome Sequencing (WGS)
                        </Label>
                      </div>
                      <div className="service-radio-group-item">
                        <RadioGroupItem value="16s" id="16s" />
                        <Label htmlFor="16s" className="text-sm">
                          16S Ribosomal RNA
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div
                      id="analysis-type"
                      className="service-card-content-grid-item"
                    >
                      <div className="flex items-center gap-2">
                        <Label className="service-card-label">
                          Analysis Type
                        </Label>
                        <DialogInfoPopup
                          title={taxonomyClassificationAnalysisType.title}
                          description={
                            taxonomyClassificationAnalysisType.description
                          }
                          sections={taxonomyClassificationAnalysisType.sections}
                          className="mb-2"
                        />
                      </div>

                      <Select
                        value={selectedAnalysisType}
                        onValueChange={setSelectedAnalysisType}
                        disabled={sequencingType === "16s"}
                      >
                        <SelectTrigger className="service-card-select-trigger">
                          <SelectValue placeholder="Select analysis type" />
                        </SelectTrigger>
                        <SelectContent>
                          {sequencingType === "wgs" && (
                            <>
                              <SelectItem value="microbiome">
                                Microbiome Analysis
                              </SelectItem>
                              <SelectItem value="species">
                                Species Identification
                              </SelectItem>
                            </>
                          )}
                          {sequencingType === "16s" && (
                            <SelectItem value="default">Default</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div
                      id="database"
                      className="service-card-content-grid-item"
                    >
                      <div className="flex items-center gap-2">
                        <Label className="service-card-label">Database</Label>
                        <DialogInfoPopup
                          title={taxonomyClassificationDatabase.title}
                          description={
                            taxonomyClassificationDatabase.description
                          }
                          sections={taxonomyClassificationDatabase.sections}
                          className="mb-2"
                        />
                      </div>

                      <Select
                        value={selectedDatabase}
                        onValueChange={setSelectedDatabase}
                      >
                        <SelectTrigger className="service-card-select-trigger">
                          <SelectValue placeholder="Select database" />
                        </SelectTrigger>
                        <SelectContent>
                          {sequencingType === "wgs" && (
                            <>
                              <SelectItem value="bvbrc">
                                BV-BRC Database
                              </SelectItem>
                              <SelectItem value="kraken2">
                                Kraken2 Standard Database
                              </SelectItem>
                            </>
                          )}
                          {sequencingType === "16s" && (
                            <>
                              <SelectItem value="silva">SILVA</SelectItem>
                              <SelectItem value="greengenes">
                                Greengenes
                              </SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div
                      id="filter-host-reads"
                      className="service-card-content-grid-item"
                    >
                      <div className="flex items-center gap-2">
                        <Label className="service-card-label">
                          Filter Host Reads
                        </Label>
                        <DialogInfoPopup
                          title={taxonomyClassificationFilterHostReads.title}
                          description={
                            taxonomyClassificationFilterHostReads.description
                          }
                          className="mb-2"
                        />
                      </div>

                      <Select
                        defaultValue="none"
                        disabled={sequencingType === "16s"}
                      >
                        <SelectTrigger className="service-card-select-trigger">
                          <SelectValue placeholder="Select filter option" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="human">Homo sapiens</SelectItem>
                          <SelectItem value="mouse">Mus musculus</SelectItem>
                          <SelectItem value="rat">Rattus norvegicus</SelectItem>
                          <SelectItem value="celegans">
                            Caenorhabditis elegans
                          </SelectItem>
                          <SelectItem value="drosophila">
                            Drosophila melanogaster strain y
                          </SelectItem>
                          <SelectItem value="danio">
                            Danio rerio strain tuebingen
                          </SelectItem>
                          <SelectItem value="gallus">Gallus gallus</SelectItem>
                          <SelectItem value="macaca">Macaca mulatta</SelectItem>
                          <SelectItem value="mustela">
                            Mustela putorius furo
                          </SelectItem>
                          <SelectItem value="sus">Sus scrofa</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div
                      id="confidence-interval"
                      className="service-card-content-grid-item"
                    >
                      <div className="flex items-center gap-2">
                        <Label className="service-card-label">
                          Confidence Interval
                        </Label>
                        <DialogInfoPopup
                          title={taxonomyClassificatioConfidenceInterval.title}
                          description={
                            taxonomyClassificatioConfidenceInterval.description
                          }
                          className="mb-2"
                        />
                      </div>

                      <Select defaultValue="0.1">
                        <SelectTrigger className="service-card-select-trigger">
                          <SelectValue placeholder="Select confidence interval" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0.1">0.1</SelectItem>
                          <SelectItem value="0.2">0.2</SelectItem>
                          <SelectItem value="0.3">0.3</SelectItem>
                          <SelectItem value="0.4">0.4</SelectItem>
                          <SelectItem value="0.5">0.5</SelectItem>
                          <SelectItem value="0.6">0.6</SelectItem>
                          <SelectItem value="0.7">0.7</SelectItem>
                          <SelectItem value="0.8">0.8</SelectItem>
                          <SelectItem value="0.9">0.9</SelectItem>
                          <SelectItem value="1.0">1.0</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div
                      id="save-classified-sequences"
                      className="service-card-content-grid-item"
                    >
                      <Label className="service-card-label">
                        Save Classified Sequences
                      </Label>

                      <RadioGroup
                        defaultValue={saveClassifiedSequences}
                        className="service-radio-group"
                        onValueChange={setSaveClassifiedSequences}
                      >
                        <div className="service-radio-group-item">
                          <RadioGroupItem value="no" id="classified-no" />
                          <Label htmlFor="classified-no" className="text-sm">
                            No
                          </Label>
                        </div>
                        <div className="service-radio-group-item">
                          <RadioGroupItem value="yes" id="classified-yes" />
                          <Label htmlFor="classified-yes" className="text-sm">
                            Yes
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <div id="save-unclassified-sequences">
                      <Label className="service-card-label">
                        Save Unclassified Sequences
                      </Label>

                      <RadioGroup
                        defaultValue={saveUnclassifiedSequences}
                        className="service-radio-group"
                        onValueChange={setSaveUnclassifiedSequences}
                      >
                        <div className="service-radio-group-item">
                          <RadioGroupItem value="no" id="unclassified-no" />
                          <Label htmlFor="unclassified-no" className="text-sm">
                            No
                          </Label>
                        </div>
                        <div className="service-radio-group-item">
                          <RadioGroupItem value="yes" id="unclassified-yes" />
                          <Label htmlFor="unclassified-yes" className="text-sm">
                            Yes
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </div>
                </div>

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

export default TaxonomicClassificationService;
