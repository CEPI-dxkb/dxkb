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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { X, ArrowRight, ChevronDown } from "lucide-react";
import { ServiceHeader } from "@/components/services/service-header";
import {
  phylogeneticTreeAlignmentParameters,
  phylogeneticTreeInfo,
  phylogeneticTreeInput,
  phylogeneticTreeTreeParameters,
} from "@/lib/service-info";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import SearchWorkspaceInput from "@/components/services/search-workspace-input";
import SelectedItemsTable from "@/components/services/selected-items-table";
import OutputFolder from "@/components/services/output-folder";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { handleFormSubmit } from "@/lib/service-utils";
import { toast } from "sonner";

interface SelectedFile {
  id: string;
  name: string;
  type: string;
}

export default function GeneProteinTreePage() {
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [sequenceType, setSequenceType] = useState<"dna" | "protein">("dna");
  const [selectedModel, setSelectedModel] = useState<string>("gtr");
  const [featureGroup, setFeatureGroup] = useState<string>("");
  const [alignedFasta, setAlignedFasta] = useState<string>("");
  const [unalignedFasta, setUnalignedFasta] = useState<string>("");
  const [_outputFolder, setOutputFolder] = useState<string>("");
  const [_outputName, setOutputName] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [metadataFields, setMetadataFields] = useState([
    { id: "genomeId", name: "Genome ID", selected: true },
    { id: "genomeName", name: "Genome Name", selected: true },
    { id: "species", name: "Species", selected: true },
    { id: "strain", name: "Strain", selected: true },
    { id: "accession", name: "Accession", selected: true },
    { id: "subtype", name: "Subtype", selected: true },
  ]);
  const [selectedMetadataField, setSelectedMetadataField] =
    useState<string>("");

  const handleFileSelect = (fileName: string, type: string) => {
    const trimmed = fileName.trim();
    if (trimmed) {
      if (
        selectedFiles.some(
          (file) => file.name === trimmed && file.type === type,
        )
      ) {
        toast.error("Duplicate file detected", {
          description: `This ${type.toLowerCase()} has already been added to the selection.`,
        });
        return;
      }
      setSelectedFiles([
        ...selectedFiles,
        {
          id: `${trimmed}_${type}_${Date.now()}`,
          name: trimmed,
          type,
        },
      ]);
    }
  };

  const addMetadataField = () => {
    if (selectedMetadataField) {
      setMetadataFields(
        metadataFields.map((field) =>
          field.id === selectedMetadataField
            ? { ...field, selected: true }
            : field,
        ),
      );
      setSelectedMetadataField("");
    }
  };

  const removeMetadataField = (fieldId: string) => {
    setMetadataFields(
      metadataFields.map((field) =>
        field.id === fieldId ? { ...field, selected: false } : field,
      ),
    );
  };

  return (
    <section>
      <ServiceHeader
        title="Gene / Protein Tree"
        description="The Gene / Protein Tree Service enables construction of custom
            phylogenetic trees built from user-selected genes or proteins."
        infoPopupTitle={phylogeneticTreeInfo.title}
        infoPopupDescription={phylogeneticTreeInfo.description}
        quickReferenceGuide="#"
        tutorial="#"
        instructionalVideo="#"
      />

      <form
        onSubmit={handleFormSubmit}
        className="grid grid-cols-1 gap-4 md:grid-cols-2"
      >
        {/* Input Section */}
        <Card>
          <CardHeader className="service-card-header">
            <CardTitle className="service-card-title">
              Input
              <DialogInfoPopup
                title={phylogeneticTreeInput.title}
                description={phylogeneticTreeInput.description}
                sections={phylogeneticTreeInput.sections}
              />
            </CardTitle>
            <CardDescription>
              Choose fasta file or features for tree.
            </CardDescription>
          </CardHeader>

          <CardContent className="service-card-content">
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <RadioGroup
                  defaultValue="dna"
                  className="service-radio-group"
                  onValueChange={(value: "dna" | "protein") => {
                    setSequenceType(value);
                    setSelectedModel(value === "dna" ? "gtr" : "lg");
                  }}
                >
                  <div className="service-radio-group-item">
                    <RadioGroupItem value="dna" id="dna" />
                    <Label htmlFor="dna">DNA</Label>
                  </div>
                  <div className="service-radio-group-item">
                    <RadioGroupItem value="protein" id="protein" />
                    <Label htmlFor="protein">Protein</Label>
                  </div>
                </RadioGroup>
              </div>

              <SearchWorkspaceInput
                title="Feature Group"
                placeholder="(Optional)"
                variant="add"
                value={featureGroup}
                onChange={setFeatureGroup}
                onAdd={() => {
                  if (featureGroup.trim()) {
                    handleFileSelect(featureGroup, "Feature Group");
                    setFeatureGroup("");
                  }
                }}
              />

              <SearchWorkspaceInput
                title="Uploaded Aligned Fasta"
                placeholder="(Optional)"
                variant="add"
                value={alignedFasta}
                onChange={setAlignedFasta}
                onAdd={() => {
                  if (alignedFasta.trim()) {
                    handleFileSelect(alignedFasta, "Aligned Fasta File");
                    setAlignedFasta("");
                  }
                }}
              />

              <SearchWorkspaceInput
                title="Submitted Unaligned Fasta"
                placeholder="(Optional)"
                variant="add"
                value={unalignedFasta}
                onChange={setUnalignedFasta}
                onAdd={() => {
                  if (unalignedFasta.trim()) {
                    handleFileSelect(unalignedFasta, "Unaligned Fasta File");
                    setUnalignedFasta("");
                  }
                }}
              />

              <SelectedItemsTable
                title="Selected Files/Feature Group"
                items={selectedFiles}
                onRemove={(id) => {
                  setSelectedFiles((prev) =>
                    prev.filter((file) => file.id !== id),
                  );
                }}
                className="max-h-84 overflow-y-auto"
                allowDuplicates={false}
              />
            </div>
          </CardContent>
        </Card>

        {/* Right Column - Parameters */}
        <div className="space-y-4">
          {/* Alignment Parameters */}
          <Card>
            <CardHeader className="service-card-header">
              <CardTitle className="service-card-title">
                Alignment Parameters
                <DialogInfoPopup
                  title={phylogeneticTreeAlignmentParameters.title}
                  description={phylogeneticTreeAlignmentParameters.description}
                  sections={phylogeneticTreeAlignmentParameters.sections}
                />
              </CardTitle>
            </CardHeader>

            <CardContent className="service-card-content">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="service-card-label">
                    Trim Ends of Alignment Threshold
                  </Label>
                  <Select defaultValue="0">
                    <SelectTrigger className="service-card-select-trigger">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="0">0</SelectItem>
                      <SelectItem value="0.1">0.1</SelectItem>
                      <SelectItem value="0.2">0.2</SelectItem>
                      <SelectItem value="0.3">0.3</SelectItem>
                      <SelectItem value="0.4">0.4</SelectItem>
                      <SelectItem value="0.5">0.5</SelectItem>
                      <SelectItem value="0.6">0.6</SelectItem>
                      <SelectItem value="0.7">0.7</SelectItem>
                      <SelectItem value="0.8">0.8</SelectItem>
                      <SelectItem value="0.9">0.9</SelectItem>
                      <SelectItem value="1">1</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="service-card-label">
                    Remove Gappy Sequences Threshold
                  </Label>
                  <Select defaultValue="0">
                    <SelectTrigger className="service-card-select-trigger">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="0">0</SelectItem>
                      <SelectItem value="0.1">0.1</SelectItem>
                      <SelectItem value="0.2">0.2</SelectItem>
                      <SelectItem value="0.3">0.3</SelectItem>
                      <SelectItem value="0.4">0.4</SelectItem>
                      <SelectItem value="0.5">0.5</SelectItem>
                      <SelectItem value="0.6">0.6</SelectItem>
                      <SelectItem value="0.7">0.7</SelectItem>
                      <SelectItem value="0.8">0.8</SelectItem>
                      <SelectItem value="0.9">0.9</SelectItem>
                      <SelectItem value="1">1</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tree Parameters */}
          <Card>
            <CardHeader className="service-card-header">
              <CardTitle className="service-card-title">
                Tree Parameters
                <DialogInfoPopup
                  title={phylogeneticTreeTreeParameters.title}
                  description={phylogeneticTreeTreeParameters.description}
                  sections={phylogeneticTreeTreeParameters.sections}
                />
              </CardTitle>
            </CardHeader>

            <CardContent className="service-card-content">
              <div className="space-y-4">
                <div className="flex gap-4">
                  <RadioGroup
                    defaultValue="raxml"
                    className="service-radio-group"
                  >
                    <div className="service-radio-group-item">
                      <RadioGroupItem value="raxml" id="raxml" />
                      <Label htmlFor="raxml">RAxML</Label>
                    </div>
                    <div className="service-radio-group-item">
                      <RadioGroupItem value="phyml" id="phyml" />
                      <Label htmlFor="phyml">PhyML</Label>
                    </div>
                    <div className="service-radio-group-item">
                      <RadioGroupItem value="fasttree" id="fasttree" />
                      <Label htmlFor="fasttree">FastTree</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="flex flex-col gap-2">
                  <Label className="service-card-label">Model</Label>
                  <Select
                    value={selectedModel}
                    onValueChange={setSelectedModel}
                  >
                    <SelectTrigger
                      id="model"
                      className="service-card-select-trigger"
                    >
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    {sequenceType === "dna" ? (
                      <SelectContent>
                        <SelectItem value="gtr">GTR</SelectItem>
                        <SelectItem value="tn93">TN93</SelectItem>
                        <SelectItem value="hky85">HKY85</SelectItem>
                        <SelectItem value="f84">F84</SelectItem>
                        <SelectItem value="f81">F81</SelectItem>
                        <SelectItem value="k80">K80</SelectItem>
                        <SelectItem value="jc96">JC96</SelectItem>
                      </SelectContent>
                    ) : (
                      <SelectContent>
                        <SelectItem value="lg">LG</SelectItem>
                        <SelectItem value="wag">WAG</SelectItem>
                        <SelectItem value="jtt">JTT</SelectItem>
                        <SelectItem value="blosum62">Blosum62</SelectItem>
                        <SelectItem value="dayhoff">Dayhoff</SelectItem>
                        <SelectItem value="hivw">HIVw</SelectItem>
                        <SelectItem value="hivb">HIVb</SelectItem>
                      </SelectContent>
                    )}
                  </Select>
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

        {/* Metadata Options */}
        <Collapsible
          open={showAdvanced}
          onOpenChange={setShowAdvanced}
          className="service-collapsible-container col-span-2 !bg-white"
        >
          <CollapsibleTrigger className="service-collapsible-trigger">
            Metadata Options
            <ChevronDown
              className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-180 transform" : ""}`}
            />
          </CollapsibleTrigger>

          <CollapsibleContent className="service-collapsible-content">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <Label>Metadata Fields</Label>
                  <p className="text-muted-foreground pt-2 pb-4 text-sm">
                    These fields will appear as options in the phylogeny
                    visualization
                  </p>

                  <div className="flex gap-2">
                    <Select
                      value={selectedMetadataField}
                      onValueChange={setSelectedMetadataField}
                    >
                      <SelectTrigger className="service-card-select-trigger">
                        <SelectValue placeholder="Select field" />
                      </SelectTrigger>
                      <SelectContent>
                        {metadataFields
                          .filter((field) => !field.selected)
                          .map((field) => (
                            <SelectItem key={field.id} value={field.id}>
                              {field.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={addMetadataField}
                      disabled={!selectedMetadataField}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div>
                <Label>Metadata Table</Label>
                <Table className="mt-2">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Field</TableHead>
                      <TableHead className="w-24 text-center">Remove</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metadataFields
                      .filter((field) => field.selected)
                      .map((field) => (
                        <TableRow key={field.id}>
                          <TableCell>{field.name}</TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeMetadataField(field.id)}
                              className="text-destructive hover:text-destructive/90"
                            >
                              <X size={16} />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </form>

      {/* Form Controls */}
      <div className="service-form-controls">
        <Button variant="outline">Reset</Button>
        <Button>Submit</Button>
      </div>
    </section>
  );
}
