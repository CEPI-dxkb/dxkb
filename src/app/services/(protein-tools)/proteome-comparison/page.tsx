"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { NumberInput } from "@/components/ui/number-input";
import { ServiceHeader } from "@/components/services/service-header";
import SearchWorkspaceInput from "@/components/services/search-workspace-input";
import {
  proteomeComparisonInfo,
  proteomeComparisonParameters,
  proteomeComparisonComparisonGenomes,
  proteomeComparisonReferenceGenome,
} from "@/lib/service-info";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import OutputFolder from "@/components/services/output-folder";
import { handleFormSubmit } from "@/lib/service-utils";
import SelectedItemsTable from "@/components/services/selected-items-table";
import { toast } from "sonner";

export default function ProteomeComparisonPage() {
  const [selectComparisonGenome, setSelectComparisonGenome] = useState("");
  const [selectReferenceGenome, setSelectReferenceGenome] = useState("");
  const [selectedGenomes, setSelectedGenomes] = useState<
    { name: string; type: string }[]
  >([]);
  const [showAdvancedParams, setAdvancedParams] = useState(false);
  const [proteinFastaInput, setProteinFastaInput] = useState("");
  const [featureGroupInput, setFeatureGroupInput] = useState("");
  const [genomeGroupInput, setGenomeGroupInput] = useState("");
  const [_outputFolder, setOutputFolder] = useState("");
  const [_outputName, setOutputName] = useState("");

  const MAX_GENOMES = 9;

  const genomeOptions = {
    tuberculosis: "Mycobacterium tuberculosis H37Rv",
    coli: "Escherichia coli K-12",
    subtilis: "Bacillus subtilis 168",
    cerevisiae: "Saccharomyces cerevisiae S288C",
  };

  const addComparisonGenome = () => {
    const genomeName =
      genomeOptions[selectComparisonGenome as keyof typeof genomeOptions];
    const isDuplicate = selectedGenomes.some(
      (item) => item.name === genomeName && item.type === "Genome",
    );
    if (isDuplicate) {
      toast.error("Each item must be unique (name + type)", {
        closeButton: true,
      });
      return;
    }
    if (selectedGenomes.length < MAX_GENOMES) {
      setSelectedGenomes([
        ...selectedGenomes,
        { name: genomeName, type: "Genome" },
      ]);
    }
  };

  const addProteinFasta = () => {
    if (!proteinFastaInput.trim()) return;
    const isDuplicate = selectedGenomes.some(
      (item) => item.name === proteinFastaInput && item.type === "Protein",
    );
    if (isDuplicate) {
      toast.error("Each item must be unique (name + type)", {
        closeButton: true,
      });
      return;
    }
    if (selectedGenomes.length < MAX_GENOMES) {
      setSelectedGenomes([
        ...selectedGenomes,
        { name: proteinFastaInput, type: "Protein" },
      ]);
      setProteinFastaInput("");
    }
  };

  const addFeatureGroup = () => {
    if (!featureGroupInput.trim()) return;
    const isDuplicate = selectedGenomes.some(
      (item) =>
        item.name === featureGroupInput && item.type === "Feature Group",
    );
    if (isDuplicate) {
      toast.error("Each item must be unique (name + type)", {
        closeButton: true,
      });
      return;
    }
    if (selectedGenomes.length < MAX_GENOMES) {
      setSelectedGenomes([
        ...selectedGenomes,
        { name: featureGroupInput, type: "Feature Group" },
      ]);
      setFeatureGroupInput("");
    }
  };

  const addGenomeGroup = () => {
    if (!genomeGroupInput.trim()) return;
    const isDuplicate = selectedGenomes.some(
      (item) => item.name === genomeGroupInput && item.type === "Genome Group",
    );
    if (isDuplicate) {
      toast.error("Each item must be unique (name + type)", {
        closeButton: true,
      });
      return;
    }
    if (selectedGenomes.length < MAX_GENOMES) {
      setSelectedGenomes([
        ...selectedGenomes,
        { name: genomeGroupInput, type: "Genome Group" },
      ]);
      setGenomeGroupInput("");
    }
  };

  const resetForm = () => {
    setSelectedGenomes([]);
    setSelectComparisonGenome("");
    setSelectReferenceGenome("");
    setProteinFastaInput("");
    setFeatureGroupInput("");
    setGenomeGroupInput("");
  };

  return (
    <section>
      <ServiceHeader
        title="Proteome Comparison"
        description="The Proteome Comparison Service performs protein sequence-based genome
          comparison using bidirectional BLASTP. This service allows users to
          select genomes and compare them to reference genome."
        infoPopupTitle={proteomeComparisonInfo.title}
        infoPopupDescription={proteomeComparisonInfo.description}
        quickReferenceGuide="#"
        tutorial="#"
        instructionalVideo="#"
      />

      {/* Main Content */}
      <form onSubmit={handleFormSubmit} className="service-form-section">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-6">
            {/* Parameters */}
            <Card>
              <CardHeader className="service-card-header">
                <CardTitle className="service-card-title">
                  Parameters
                  <DialogInfoPopup
                    title={proteomeComparisonParameters.title}
                    description={proteomeComparisonParameters.description}
                    sections={proteomeComparisonParameters.sections}
                  />
                </CardTitle>
              </CardHeader>

              <CardContent className="service-card-content">
                <div className="space-y-4">
                  <div className="flex flex-col space-y-4">
                    <div className="w-full">
                      <OutputFolder onChange={setOutputFolder} />
                    </div>
                    <div className="w-full">
                      <OutputFolder variant="name" onChange={setOutputName} />
                    </div>
                  </div>

                  <Collapsible
                    open={showAdvancedParams}
                    onOpenChange={setAdvancedParams}
                    className="service-collapsible-container"
                  >
                    <CollapsibleTrigger className="service-collapsible-trigger text-sm font-medium">
                      Advanced Parameters (Optional)
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${showAdvancedParams ? "rotate-180 transform" : ""}`}
                      />
                    </CollapsibleTrigger>

                    <CollapsibleContent className="service-collapsible-content">
                      <div className="service-card-content-grid">
                        <div>
                          <Label className="service-card-sublabel">
                            Minimum % Coverage
                          </Label>
                          <NumberInput
                            id="minimum-coverage"
                            defaultValue={30}
                            min={10}
                            max={100}
                            stepper={5}
                          />
                        </div>

                        <div>
                          <Label className="service-card-sublabel">
                            BLAST E-Value
                          </Label>
                          <Input
                            defaultValue="1e-5"
                            className="service-card-input"
                          />
                        </div>

                        <div>
                          <Label className="service-card-sublabel">
                            Minimum % Identity
                          </Label>
                          <NumberInput
                            id="minimum-identity"
                            defaultValue={10}
                            min={10}
                            max={100}
                            stepper={5}
                          />
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </CardContent>
            </Card>

            {/* Reference Genome */}
            <Card>
              <CardHeader className="service-card-header">
                <CardTitle className="service-card-title">
                  Reference Genome
                  <DialogInfoPopup
                    title={proteomeComparisonReferenceGenome.title}
                    description={proteomeComparisonReferenceGenome.description}
                    sections={proteomeComparisonReferenceGenome.sections}
                  />
                </CardTitle>
                <CardDescription>
                  Select 1 reference genome from the following options
                </CardDescription>
              </CardHeader>

              <CardContent className="service-card-content">
                <div className="space-y-4">
                  <div>
                    <Label className="service-card-label">
                      Select a Genome
                    </Label>
                    <div className="flex gap-2">
                      <Select
                        value={selectReferenceGenome}
                        onValueChange={setSelectReferenceGenome}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select genome" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tuberculosis">
                            Mycobacterium tuberculosis H37Rv
                          </SelectItem>
                          <SelectItem value="coli">
                            Escherichia coli K-12
                          </SelectItem>
                          <SelectItem value="subtilis">
                            Bacillus subtilis 168
                          </SelectItem>
                          <SelectItem value="cerevisiae">
                            Saccharomyces cerevisiae S288C
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <SearchWorkspaceInput
                    title="Or a FASTA File"
                    placeholder="(Optional)"
                  />

                  <SearchWorkspaceInput
                    title="Or a Feature Group"
                    placeholder="(Optional)"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Comparison Genomes */}
          <Card>
            <CardHeader className="service-card-header">
              <CardTitle className="service-card-title">
                Comparison Genomes
                <DialogInfoPopup
                  title={proteomeComparisonComparisonGenomes.title}
                  description={proteomeComparisonComparisonGenomes.description}
                  sections={proteomeComparisonComparisonGenomes.sections}
                />
              </CardTitle>
              <CardDescription>
                Add up to {MAX_GENOMES} genomes to compare (use plus buttons to
                add)
              </CardDescription>
            </CardHeader>

            <CardContent className="service-card-content">
              <div className="space-y-4">
                <div>
                  <Label className="service-card-label">Select Genome</Label>
                  <div className="flex gap-2">
                    <Select
                      value={selectComparisonGenome}
                      onValueChange={setSelectComparisonGenome}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select genome" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tuberculosis">
                          Mycobacterium tuberculosis H37Rv
                        </SelectItem>
                        <SelectItem value="coli">
                          Escherichia coli K-12
                        </SelectItem>
                        <SelectItem value="subtilis">
                          Bacillus subtilis 168
                        </SelectItem>
                        <SelectItem value="cerevisiae">
                          Saccharomyces cerevisiae S288C
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={addComparisonGenome}
                      disabled={selectedGenomes.length >= MAX_GENOMES}
                    >
                      <Plus size={16} />
                    </Button>
                  </div>
                </div>

                <SearchWorkspaceInput
                  title="And/Or Select Protein FASTA File"
                  placeholder="(Optional)"
                  variant="add"
                  value={proteinFastaInput}
                  onChange={setProteinFastaInput}
                  onAdd={addProteinFasta}
                  disabled={selectedGenomes.length >= MAX_GENOMES}
                />

                <SearchWorkspaceInput
                  title="And/Or Select Feature Group"
                  placeholder="(Optional)"
                  variant="add"
                  value={featureGroupInput}
                  onChange={setFeatureGroupInput}
                  onAdd={addFeatureGroup}
                  disabled={selectedGenomes.length >= MAX_GENOMES}
                />

                <SearchWorkspaceInput
                  title="And/Or Select Genome Group"
                  placeholder="(Optional)"
                  variant="add"
                  value={genomeGroupInput}
                  onChange={setGenomeGroupInput}
                  onAdd={addGenomeGroup}
                  disabled={selectedGenomes.length >= MAX_GENOMES}
                />

                <SelectedItemsTable
                  title="Selected Genome Table"
                  items={selectedGenomes.map(
                    (genome: { name: string; type: string }) => ({
                      id: genome.name,
                      name: genome.name,
                      type: genome.type,
                    }),
                  )}
                  onRemove={(id: string) => {
                    setSelectedGenomes(
                      (prev: { name: string; type: string }[]) =>
                        prev.filter(
                          (genome: { name: string; type: string }) =>
                            genome.name !== id,
                        ),
                    );
                  }}
                  className="max-h-96 overflow-y-auto"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </form>

      {/* Form Controls */}
      <div className="service-form-controls">
        <Button variant="outline" onClick={resetForm}>
          Reset
        </Button>
        <Button>Submit</Button>
      </div>
    </section>
  );
}
