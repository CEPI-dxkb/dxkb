"use client";

import { useForm, useStore } from "@tanstack/react-form";
import { FieldItem, FieldErrors } from "@/components/ui/tanstack-form";
import { useState, useMemo, useEffect } from "react";
import { ServiceHeader } from "@/components/services/service-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Plus, X, ArrowRight } from "lucide-react";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import {
  phylogeneticTreeInfo,
  phylogeneticTreeInput,
  phylogeneticTreeAlignmentParameters,
  phylogeneticTreeTreeParameters,
} from "@/lib/services/service-info";
import OutputFolder from "@/components/services/output-folder";
import {
  RequiredFormCardTitle,
  RequiredFormLabel,
} from "@/components/forms/required-form-components";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import { WorkspaceObject } from "@/lib/workspace-client";
import { ValidWorkspaceObjectTypes } from "@/lib/services/workspace/types";
import { JobParamsDialog } from "@/components/services/job-params-dialog";
import { useServiceFormSubmission } from "@/hooks/services/use-service-form-submission";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import SelectedItemsTable from "@/components/services/selected-items-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DEFAULT_METADATA_FIELDS,
  type GeneProteinTreeFormData,
  DEFAULT_GENE_PROTEIN_TREE_FORM_VALUES,
  geneProteinTreeFormSchema,
  DNA_MODELS,
  PROTEIN_MODELS,
  type SequenceItem,
  THRESHOLD_OPTIONS,
  getMetadataSelectOptions,
  isMetadataLabel,
} from "@/lib/forms/(phylogenomics)/gene-protein-tree/gene-protein-tree-form-schema";
import {
  transformGeneProteinTreeParams,
  formatMetadataLabel,
  getSequenceTypeLabel,
  type Alphabet,
  checkDuplicateSequence,
  checkSequenceLimit,
  createSequenceItem,
  removeSequenceAtIndex,
  createMetadataField,
  getDisplayName,
} from "@/lib/forms/(phylogenomics)/gene-protein-tree/gene-protein-tree-form-utils";

interface MetadataField {
  id: string;
  name: string;
  selected: boolean;
}


export default function GeneProteinTreePage() {
  const [selectedFeatureGroupObject, setSelectedFeatureGroupObject] =
    useState<WorkspaceObject | null>(null);
  const [selectedAlignedFastaObject, setSelectedAlignedFastaObject] =
    useState<WorkspaceObject | null>(null);
  const [selectedUnalignedFastaObject, setSelectedUnalignedFastaObject] =
    useState<WorkspaceObject | null>(null);
  const [metadataFields, setMetadataFields] =
    useState<MetadataField[]>(DEFAULT_METADATA_FIELDS);
  const [selectedMetadataField, setSelectedMetadataField] =
    useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isOutputNameValid, setIsOutputNameValid] = useState(true);

  // Setup service debugging and form submission
  const {
    handleSubmit,
    showParamsDialog,
    setShowParamsDialog,
    currentParams,
    serviceName,
    isSubmitting,
  } = useServiceFormSubmission<GeneProteinTreeFormData>({
    serviceName: "GeneTree",
    displayName: "Gene/Protein Tree",
    transformParams: transformGeneProteinTreeParams,
    onSuccess: handleReset,
  });

  const form = useForm({
    defaultValues: DEFAULT_GENE_PROTEIN_TREE_FORM_VALUES as GeneProteinTreeFormData,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validators: { onChange: geneProteinTreeFormSchema as any },
    onSubmit: async ({ value }) => {
      await handleSubmit(value as GeneProteinTreeFormData);
    },
  });

  const alphabet = useStore(form.store, (s) => s.values.alphabet);
  const sequences = useStore(form.store, (s) => s.values.sequences);
  const outputPath = useStore(form.store, (s) => s.values.output_path);
  const canSubmit = useStore(form.store, (s) => s.canSubmit);

  const substitutionModelOptions = useMemo(
    () => (alphabet === "DNA" ? DNA_MODELS : PROTEIN_MODELS),
    [alphabet],
  );

  // Reset model when alphabet changes
  useEffect(() => {
    const resetModel = alphabet === "DNA" ? DNA_MODELS[0].value : PROTEIN_MODELS[0].value;
    form.setFieldValue("substitution_model", resetModel);

    // Clear sequences that don't match the new alphabet
    const isDNA = alphabet === "DNA";
    const validTypes = isDNA
      ? ["feature_group", "aligned_dna_fasta", "feature_dna_fasta"]
      : ["feature_group", "aligned_protein_fasta", "feature_protein_fasta"];

    const filteredSequences = sequences.filter((seq) =>
      validTypes.includes(seq.type),
    );

    if (filteredSequences.length !== sequences.length) {
      form.setFieldValue("sequences", filteredSequences);
      toast.info("Switched alphabet. Cleared incompatible sequences.");
    }


    queueMicrotask(() => {
      setSelectedAlignedFastaObject(null);
      setSelectedUnalignedFastaObject(null);
    });
  }, [alphabet, form, sequences]);

  // Update metadata fields in form when they change
  useEffect(() => {
    const selectedFields = metadataFields
      .filter((field) => field.selected)
      .map((field) => field.id);
    form.setFieldValue("metadata_fields", selectedFields);
  }, [metadataFields, form]);

  const selectedMetadataIds = useMemo(
    () => new Set(metadataFields.filter((field) => field.selected).map((f) => f.id)),
    [metadataFields],
  );

  // Always show all metadata fields with labels, excluding already selected ones
  const availableMetadataOptions = useMemo(() => {
    const allOptions = getMetadataSelectOptions(
      formatMetadataLabel,
    );
    return allOptions.filter(
      (option) =>
        option.isLabel || // Always show section labels
        !selectedMetadataIds.has(option.value), // Hide already selected fields
    );
  }, [selectedMetadataIds]);

  const inputFastaTypes = useMemo((): ValidWorkspaceObjectTypes[] => {
    if (alphabet === "DNA") {
      return ["aligned_dna_fasta", "feature_dna_fasta"];
    }
    return ["aligned_protein_fasta", "feature_protein_fasta"];
  }, [alphabet]);

  function handleAddSequence(source: "feature" | "aligned" | "unaligned") {
    let selectedObject: WorkspaceObject | null = null;
    let type: SequenceItem["type"];

    if (source === "feature") {
      selectedObject = selectedFeatureGroupObject;
      type = "feature_group";
    } else if (source === "aligned") {
      selectedObject = selectedAlignedFastaObject;
      type = alphabet === "DNA" ? "aligned_dna_fasta" : "aligned_protein_fasta";
    } else {
      selectedObject = selectedUnalignedFastaObject;
      type = alphabet === "DNA" ? "feature_dna_fasta" : "feature_protein_fasta";
    }

    if (!selectedObject || !selectedObject.path) {
      toast.error("No object selected", {
        description: "Please select a workspace object before adding.",
        closeButton: true,
      });
      return;
    }

    const inputValue = selectedObject.path;

    const currentSequences = form.state.values.sequences;

    if (checkDuplicateSequence(currentSequences, inputValue, type)) {
      toast.error("Duplicate selection detected", {
        description: `${getSequenceTypeLabel(type, alphabet as Alphabet)} is already selected.`,
        closeButton: true,
      });
      return;
    }

    if (checkSequenceLimit(currentSequences)) {
      toast.error("Selection limit reached", {
        description: "A maximum of 5000 sequences can be added.",
        closeButton: true,
      });
      return;
    }

    const newSequence = createSequenceItem(inputValue, type);

    form.setFieldValue("sequences", [...currentSequences, newSequence]);

    if (source === "feature") setSelectedFeatureGroupObject(null);
    if (source === "aligned") setSelectedAlignedFastaObject(null);
    if (source === "unaligned") setSelectedUnalignedFastaObject(null);
  }

  function removeSequence(index: number) {
    const currentSequences = form.state.values.sequences;
    form.setFieldValue(
      "sequences",
      removeSequenceAtIndex(currentSequences, index),
    );
  }

  function handleMetadataSelection(value: string) {
    // Don't allow selection of label items
    if (isMetadataLabel(value)) {
      setSelectedMetadataField("");
      return;
    }
    setSelectedMetadataField(value);
  }

  function addMetadataField() {
    if (!selectedMetadataField) return;
    if (selectedMetadataIds.has(selectedMetadataField)) {
      setSelectedMetadataField("");
      return;
    }

    const newField = createMetadataField(selectedMetadataField);
    setMetadataFields((prev) => [newField, ...prev]);
    setSelectedMetadataField("");
  }

  function removeMetadataField(fieldId: string) {
    setMetadataFields((prev) =>
      prev.map((field) =>
        field.id === fieldId ? { ...field, selected: false } : field,
      ),
    );
  }

  function handleReset() {
    form.reset(DEFAULT_GENE_PROTEIN_TREE_FORM_VALUES);
    setSelectedFeatureGroupObject(null);
    setSelectedAlignedFastaObject(null);
    setSelectedUnalignedFastaObject(null);
    setMetadataFields(DEFAULT_METADATA_FIELDS);
    setSelectedMetadataField("");
    setShowAdvanced(false);
  }

  const selectedItemsForTable = useMemo(
    () =>
      sequences.map((seq, index) => ({
        id: `${index}`,
        name: getDisplayName(seq.filename.split("/").pop() || seq.filename),
        type: getSequenceTypeLabel(seq.type, alphabet as Alphabet),
        description: seq.filename,
      })),
    [alphabet, sequences],
  );

  return (
    <section>
      <ServiceHeader
        title="Gene / Protein Tree"
        description="The Gene / Protein Tree Service enables construction of custom phylogenetic trees built from user-selected genes or proteins."
        infoPopupTitle={phylogeneticTreeInfo.title}
        infoPopupDescription={phylogeneticTreeInfo.description}
        quickReferenceGuide="https://www.bv-brc.org/docs/quick_references/services/genetree.html"
        tutorial="https://www.bv-brc.org/docs/tutorial/genetree/genetree.html"
        instructionalVideo="https://youtu.be/VtXWBRSdXRo"
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="grid grid-cols-1 gap-4 md:grid-cols-2"
      >
        <Card>
          <CardHeader className="service-card-header">
            <RequiredFormCardTitle className="service-card-title">
              Input
              <DialogInfoPopup
                title={phylogeneticTreeInput.title}
                description={phylogeneticTreeInput.description}
                sections={phylogeneticTreeInput.sections}
              />
            </RequiredFormCardTitle>
            <CardDescription>
              Choose fasta file or features for tree.
            </CardDescription>
          </CardHeader>

          <CardContent className="service-card-content">
            <div className="space-y-4">
              <form.Field name="alphabet">
                {(field) => (
                  <FieldItem>
                    <RadioGroup
                      value={field.state.value}
                      onValueChange={(value) => value != null && field.handleChange(value as GeneProteinTreeFormData["alphabet"])}
                      className="service-radio-group-horizontal"
                    >
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value="DNA" id="DNA" />
                        <Label htmlFor="DNA">DNA</Label>
                      </div>
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value="Protein" id="Protein" />
                        <Label htmlFor="Protein">Protein</Label>
                      </div>
                    </RadioGroup>
                    <FieldErrors field={field} />
                  </FieldItem>
                )}
              </form.Field>

              <div className="space-y-2">
                <Label className="service-card-label">
                  Feature Group
                </Label>
                <div className="flex gap-2">
                  <WorkspaceObjectSelector
                    types={["feature_group"]}
                    placeholder="Optional"
                    onSelectedObjectChange={(object: WorkspaceObject | null) => {
                      setSelectedFeatureGroupObject(object);
                    }}
                    value={selectedFeatureGroupObject?.path}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => handleAddSequence("feature")}
                    disabled={!selectedFeatureGroupObject}
                  >
                    <Plus size={16} />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="service-card-label">
                  DNA/Protein Aligned FASTA
                </Label>
                <div className="flex gap-2">
                  <WorkspaceObjectSelector
                    types={inputFastaTypes.filter((t) =>
                      t.includes("aligned"),
                    ) as ValidWorkspaceObjectTypes[]}
                    placeholder="Optional"
                    onSelectedObjectChange={(object: WorkspaceObject | null) => {
                      setSelectedAlignedFastaObject(object);
                    }}
                    value={selectedAlignedFastaObject?.path}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => handleAddSequence("aligned")}
                    disabled={!selectedAlignedFastaObject}
                  >
                    <Plus size={16} />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="service-card-label">
                  DNA/Protein Unaligned FASTA
                </Label>
                <div className="flex gap-2">
                  <WorkspaceObjectSelector
                    types={inputFastaTypes.filter((t) =>
                      t.includes("feature"),
                    ) as ValidWorkspaceObjectTypes[]}
                    placeholder="Optional"
                    onSelectedObjectChange={(object: WorkspaceObject | null) => {
                      setSelectedUnalignedFastaObject(object);
                    }}
                    value={selectedUnalignedFastaObject?.path}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => handleAddSequence("unaligned")}
                    disabled={!selectedUnalignedFastaObject}
                  >
                    <Plus size={16} />
                  </Button>
                </div>
              </div>

              <form.Field name="sequences">
                {(field) => (
                  <FieldItem>
                    <SelectedItemsTable
                      title="Selected file / feature group"
                      items={selectedItemsForTable}
                      onRemove={(id) => removeSequence(parseInt(id, 10))}
                      className="max-h-84 overflow-y-auto"
                      allowDuplicates={false}
                      description="No mixing of DNA and Protein FASTA files is allowed."
                    />
                    <FieldErrors field={field} />
                  </FieldItem>
                )}
              </form.Field>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="service-card-header">
              <RequiredFormCardTitle className="service-card-title">
                Alignment Parameters
                <DialogInfoPopup
                  title={phylogeneticTreeAlignmentParameters.title}
                  description={phylogeneticTreeAlignmentParameters.description}
                  sections={phylogeneticTreeAlignmentParameters.sections}
                />
              </RequiredFormCardTitle>
            </CardHeader>

            <CardContent className="service-card-content">
              <div className="space-y-4">
                <form.Field name="trim_threshold">
                  {(field) => (
                    <FieldItem>
                      <RequiredFormLabel className="service-card-label">
                        Trim Ends of Alignment Threshold
                      </RequiredFormLabel>
                      <Select
                        items={THRESHOLD_OPTIONS.map((v) => ({ value: v, label: v }))}
                        value={field.state.value}
                        onValueChange={(value) => value != null && field.handleChange(value)}
                      >
                        <SelectTrigger className="service-card-select-trigger">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {THRESHOLD_OPTIONS.map((value) => (
                              <SelectItem key={value} value={value}>
                                {value}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <FieldErrors field={field} />
                    </FieldItem>
                  )}
                </form.Field>

                <form.Field name="gap_threshold">
                  {(field) => (
                    <FieldItem>
                      <RequiredFormLabel className="service-card-label">
                        Remove Gappy Sequences Threshold
                      </RequiredFormLabel>
                      <Select
                        items={THRESHOLD_OPTIONS.map((v) => ({ value: v, label: v }))}
                        value={field.state.value}
                        onValueChange={(value) => value != null && field.handleChange(value)}
                      >
                        <SelectTrigger className="service-card-select-trigger">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {THRESHOLD_OPTIONS.map((value) => (
                              <SelectItem key={value} value={value}>
                                {value}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <FieldErrors field={field} />
                    </FieldItem>
                  )}
                </form.Field>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="service-card-header">
              <RequiredFormCardTitle className="service-card-title">
                Tree Parameters
                <DialogInfoPopup
                  title={phylogeneticTreeTreeParameters.title}
                  description={phylogeneticTreeTreeParameters.description}
                  sections={phylogeneticTreeTreeParameters.sections}
                />
              </RequiredFormCardTitle>
            </CardHeader>

            <CardContent className="service-card-content">
              <div className="space-y-4">
                <form.Field name="recipe">
                  {(field) => (
                    <FieldItem>
                      <RadioGroup
                        value={field.state.value}
                        onValueChange={(value) => value != null && field.handleChange(value as GeneProteinTreeFormData["recipe"])}
                        className="service-radio-group-horizontal"
                      >
                        <div className="flex items-center gap-3">
                          <RadioGroupItem value="RAxML" id="raxml" />
                          <Label htmlFor="raxml">RAxML</Label>
                        </div>
                        <div className="flex items-center gap-3">
                          <RadioGroupItem value="PhyML" id="phyml" />
                          <Label htmlFor="phyml">PhyML</Label>
                        </div>
                        <div className="flex items-center gap-3">
                          <RadioGroupItem value="FastTree" id="fasttree" />
                          <Label htmlFor="fasttree">FastTree</Label>
                        </div>
                      </RadioGroup>
                      <FieldErrors field={field} />
                    </FieldItem>
                  )}
                </form.Field>

                <form.Field name="substitution_model">
                  {(field) => (
                    <FieldItem>
                      <RequiredFormLabel className="service-card-label">
                        Model
                      </RequiredFormLabel>
                      <Select
                        items={substitutionModelOptions.map((m) => ({ value: m.value, label: m.label }))}
                        value={field.state.value}
                        onValueChange={(value) => value != null && field.handleChange(value)}
                      >
                        <SelectTrigger
                          id="model"
                          className="service-card-select-trigger"
                        >
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {substitutionModelOptions.map((model) => (
                              <SelectItem key={model.value} value={model.value}>
                                {model.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <FieldErrors field={field} />
                    </FieldItem>
                  )}
                </form.Field>

                <div className="flex flex-col space-y-4">
                  <form.Field name="output_path">
                    {(field) => (
                      <FieldItem>
                        <OutputFolder
                          required={true}
                          value={field.state.value}
                          onChange={field.handleChange}
                        />
                        <FieldErrors field={field} />
                      </FieldItem>
                    )}
                  </form.Field>
                  <form.Field name="output_file">
                    {(field) => (
                      <FieldItem>
                        <OutputFolder
                          variant="name"
                          required={true}
                          value={field.state.value}
                          onChange={field.handleChange}
                          outputFolderPath={outputPath}
                          onValidationChange={setIsOutputNameValid}
                        />
                        <FieldErrors field={field} />
                      </FieldItem>
                    )}
                  </form.Field>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Collapsible
          open={showAdvanced}
          onOpenChange={setShowAdvanced}
          className="service-collapsible-container col-span-2"
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
                  <Label>Metadata Table Fields</Label>
                  <p className="text-muted-foreground pt-2 pb-4 text-sm">
                    These fields will appear as options in the phyloxml visualization
                  </p>

                  <div className="flex gap-2">
                    <Select
                      items={availableMetadataOptions
                        .filter((f) => !f.isLabel)
                        .map((f) => ({ value: f.value, label: f.label }))}
                      value={selectedMetadataField}
                      onValueChange={(value) => value != null && handleMetadataSelection(value)}
                    >
                      <SelectTrigger className="service-card-select-trigger">
                        <SelectValue placeholder="Select field" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[600px]">
                        <SelectGroup>
                          {availableMetadataOptions.map((field) => {
                            // Check if this is a label (section header)
                            if (field.isLabel) {
                              return (
                                <SelectLabel
                                  key={field.value}
                                  className="border-b border-border pb-1.5 mb-1 font-medium"
                                >
                                  {field.label}
                                </SelectLabel>
                              );
                            }
                            return (
                              <SelectItem key={field.value} value={field.value}>
                                {field.label}
                              </SelectItem>
                            );
                          })}
                        </SelectGroup>
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
                <Table className="mt-2">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-8 py-1">Field</TableHead>
                      <TableHead className="w-24 h-8 py-1 text-center">Remove</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metadataFields
                      .filter((field) => field.selected)
                      .map((field) => (
                        <TableRow key={field.id} className="h-8">
                          <TableCell className="py-1">{field.name}</TableCell>
                          <TableCell className="py-1 text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeMetadataField(field.id)}
                              className="h-6 w-6 text-destructive hover:text-destructive/90"
                            >
                              <X size={14} />
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

        <div className="service-form-controls col-span-2">
          <Button type="button" variant="outline" onClick={handleReset}>
            Reset
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || !canSubmit || !isOutputNameValid}
          >
            {isSubmitting ? <Spinner /> : null}
            Submit
          </Button>
        </div>
      </form>

      {/* Job Params Dialog */}
      <JobParamsDialog
        open={showParamsDialog}
        onOpenChange={setShowParamsDialog}
        params={currentParams}
        serviceName={serviceName}
      />
    </section>
  );
}
