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
} from "@/components/forms/required-form-components";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import { WorkspaceObject } from "@/lib/workspace-client";

import { fetchGenomeGroupMembers, validateViralGenomes } from "@/lib/services/genome";
import { JobParamsDialog } from "@/components/services/job-params-dialog";
import { useServiceFormSubmission } from "@/hooks/services/use-service-form-submission";
import { useRerunForm } from "@/hooks/services/use-rerun-form";
import { useDefaultOutputPath } from "@/hooks/services/use-default-output-path";
import { normalizeToArray } from "@/lib/rerun-utility";
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
import * as ViralGenomeTree from "@/lib/forms/(phylogenomics)/viral-genome-tree/viral-genome-tree-form-schema";
import * as ViralGenomeTreeUtils from "@/lib/forms/(phylogenomics)/viral-genome-tree/viral-genome-tree-form-utils";

interface MetadataField {
  id: string;
  name: string;
  selected: boolean;
}

export default function ViralGenomeTreePage() {
  const [selectedGenomeGroupObject, setSelectedGenomeGroupObject] =
    useState<WorkspaceObject | null>(null);
  const [selectedAlignedFastaObject, setSelectedAlignedFastaObject] =
    useState<WorkspaceObject | null>(null);
  const [selectedUnalignedFastaObject, setSelectedUnalignedFastaObject] =
    useState<WorkspaceObject | null>(null);
  const [metadataFields, setMetadataFields] =
    useState<MetadataField[]>(ViralGenomeTree.defaultMetadataFields as MetadataField[]);
  const [selectedMetadataField, setSelectedMetadataField] =
    useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isOutputNameValid, setIsOutputNameValid] = useState(true);
  const [isValidatingGenomeGroup, setIsValidatingGenomeGroup] = useState(false);

  // Setup service debugging and form submission
  const {
    handleSubmit,
    showParamsDialog,
    setShowParamsDialog,
    currentParams,
    serviceName,
    isSubmitting,
  } = useServiceFormSubmission<ViralGenomeTree.ViralGenomeTreeFormData>({
    serviceName: "GeneTree",
    displayName: "Viral Genome Tree",
    transformParams: ViralGenomeTreeUtils.transformViralGenomeTreeParams,
    onSuccess: handleReset,
  });

  const form = useForm({
    defaultValues: ViralGenomeTree.defaultViralGenomeTreeFormValues as ViralGenomeTree.ViralGenomeTreeFormData,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validators: { onChange: ViralGenomeTree.viralGenomeTreeFormSchema as any },
    onSubmit: async ({ value }) => {
      await handleSubmit(value as ViralGenomeTree.ViralGenomeTreeFormData);
    },
  });

  const sequences = useStore(form.store, (s) => s.values.sequences);
  const outputPath = useStore(form.store, (s) => s.values.output_path);
  const canSubmit = useStore(form.store, (s) => s.canSubmit);

  // Update metadata fields in form when they change
  useEffect(() => {
    const selectedFields = metadataFields
      .filter((field) => field.selected)
      .map((field) => field.id);
    form.setFieldValue("metadata_fields", selectedFields);
  }, [metadataFields, form]);

  // Rerun: pre-fill form from job parameters
  const { rerunData, markApplied } = useRerunForm<Record<string, unknown>>();
  useDefaultOutputPath(form, rerunData);

  useEffect(() => {
    if (!rerunData || !markApplied()) return;

    if (rerunData.recipe) form.setFieldValue("recipe", rerunData.recipe as ViralGenomeTree.ViralGenomeTreeFormData["recipe"]);
    if (rerunData.substitution_model) form.setFieldValue("substitution_model", rerunData.substitution_model as never);
    if (rerunData.trim_threshold != null) form.setFieldValue("trim_threshold", String(rerunData.trim_threshold));
    if (rerunData.gap_threshold != null) form.setFieldValue("gap_threshold", String(rerunData.gap_threshold));
    if (rerunData.output_path) form.setFieldValue("output_path", rerunData.output_path as never);
    if (rerunData.output_file) form.setFieldValue("output_file", rerunData.output_file as never);

    const sequences = normalizeToArray<ViralGenomeTree.ViralGenomeSequenceItem>(rerunData.sequences);
    if (sequences.length > 0) {
      form.setFieldValue("sequences", sequences);
    }

    // Restore metadata fields from genome_metadata_fields
    const genomeMetadataFieldIds = normalizeToArray<string>(rerunData.genome_metadata_fields);
    if (genomeMetadataFieldIds.length > 0) {
      setMetadataFields(
        genomeMetadataFieldIds.map((id) => ViralGenomeTreeUtils.createMetadataField(id)),
      );
    }
  }, [rerunData, markApplied, form]);

  const selectedMetadataIds = useMemo(
    () => new Set(metadataFields.filter((field) => field.selected).map((f) => f.id)),
    [metadataFields],
  );

  // Always show all metadata fields with labels, excluding already selected ones
  const availableMetadataOptions = useMemo(() => {
    const allOptions = ViralGenomeTree.getMetadataSelectOptions(
      ViralGenomeTreeUtils.formatMetadataLabel,
    );
    return allOptions.filter(
      (option) =>
        option.isLabel || // Always show section labels
        !selectedMetadataIds.has(option.value), // Hide already selected fields
    );
  }, [selectedMetadataIds]);

  // TODO: Make this validation faster, it takes a while to validate currently.
  // Slowdown seems to be in the 'validate-viral' API call.
  async function handleAddGenomeGroup() {
    if (!selectedGenomeGroupObject || !selectedGenomeGroupObject.path) {
      toast.error("No object selected", {
        description: "Please select a workspace object before adding.",
        closeButton: true,
      });
      return;
    }

    const inputValue = selectedGenomeGroupObject.path;
    const currentSequences = form.state.values.sequences;

    // Check for duplicate genome group
    if (ViralGenomeTreeUtils.checkDuplicateSequence(currentSequences, inputValue, "genome_group")) {
      toast.error("Duplicate selection detected", {
        description: "This genome group is already selected.",
        closeButton: true,
      });
      return;
    }

    if (ViralGenomeTreeUtils.checkSequenceLimit(currentSequences)) {
      toast.error("Selection limit reached", {
        description: "A maximum of 5000 sequences can be added.",
        closeButton: true,
      });
      return;
    }

    setIsValidatingGenomeGroup(true);

    try {
      // Fetch genome group members to get genome IDs
      const genomes = await fetchGenomeGroupMembers(inputValue);

      if (genomes.length === 0) {
        toast.error("Empty genome group", {
          description: "The selected genome group is empty.",
          closeButton: true,
        });
        setIsValidatingGenomeGroup(false);
        return;
      }

      const genomeIds = genomes.map((g) => g.genome_id);

      // Validate viral genomes
      const validation = await validateViralGenomes(genomeIds, {
        maxGenomeLength: 250000,
      });

      if (!validation.allValid) {
        const errorMessages = Object.values(validation.errors).filter(Boolean);
        const errorMsg = errorMessages.length > 0
          ? errorMessages.join("\n")
          : "Invalid genome group. Please check that all genomes are viruses with single contigs.";

        toast.error("Genome group validation failed", {
          description: errorMsg,
          duration: 10000,
          closeButton: true,
        });
        setIsValidatingGenomeGroup(false);
        return;
      }

      // Check for duplicate genome IDs within already selected sequences
      // (This would require fetching genome IDs from other genome groups, which is complex)
      // For now, we'll just add the group if validation passes

      const newSequence = ViralGenomeTreeUtils.createSequenceItem(inputValue, "genome_group");

      form.setFieldValue("sequences", [...currentSequences, newSequence]);
      setSelectedGenomeGroupObject(null);

      toast.success("Genome group added", {
        description: `Added genome group with ${genomeIds.length} genome${genomeIds.length === 1 ? "" : "s"}.`,
        closeButton: true,
      });
    } catch (error) {
      console.error("Failed to validate genome group:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to validate genome group";
      toast.error("Validation error", {
        description: errorMessage,
        closeButton: true,
      });
    } finally {
      setIsValidatingGenomeGroup(false);
    }
  }

  function handleAddSequence(source: "aligned" | "unaligned") {
    let selectedObject: WorkspaceObject | null = null;
    let type: ViralGenomeTree.ViralGenomeSequenceItem["type"];

    if (source === "aligned") {
      selectedObject = selectedAlignedFastaObject;
      // Both aligned_dna_fasta and contigs workspace types map to aligned_dna_fasta sequence type
      type = "aligned_dna_fasta";
    } else {
      selectedObject = selectedUnalignedFastaObject;
      type = "feature_dna_fasta";
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

    if (ViralGenomeTreeUtils.checkDuplicateSequence(currentSequences, inputValue, type)) {
      toast.error("Duplicate selection detected", {
        description: `${ViralGenomeTreeUtils.getSequenceTypeLabel(type)} is already selected.`,
        closeButton: true,
      });
      return;
    }

    if (ViralGenomeTreeUtils.checkSequenceLimit(currentSequences)) {
      toast.error("Selection limit reached", {
        description: "A maximum of 5000 sequences can be added.",
        closeButton: true,
      });
      return;
    }

    const newSequence = ViralGenomeTreeUtils.createSequenceItem(inputValue, type);

    form.setFieldValue("sequences", [...currentSequences, newSequence]);

    if (source === "aligned") setSelectedAlignedFastaObject(null);
    if (source === "unaligned") setSelectedUnalignedFastaObject(null);
  }

  function removeSequence(index: number) {
    const currentSequences = form.state.values.sequences;
    form.setFieldValue(
      "sequences",
      ViralGenomeTreeUtils.removeSequenceAtIndex(currentSequences, index),
    );
  }

  function handleMetadataSelection(value: string) {
    // Don't allow selection of label items
    if (ViralGenomeTree.isMetadataLabel(value)) {
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

    const newField = ViralGenomeTreeUtils.createMetadataField(selectedMetadataField);
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
    form.reset(ViralGenomeTree.defaultViralGenomeTreeFormValues);
    setSelectedGenomeGroupObject(null);
    setSelectedAlignedFastaObject(null);
    setSelectedUnalignedFastaObject(null);
    setMetadataFields(ViralGenomeTree.defaultMetadataFields as MetadataField[]);
    setSelectedMetadataField("");
    setShowAdvanced(false);
  }

  const selectedItemsForTable = useMemo(
    () =>
      sequences.map((seq, index) => ({
        id: `${index}`,
        name: ViralGenomeTreeUtils.getDisplayName(seq.filename.split("/").pop() || seq.filename),
        type: ViralGenomeTreeUtils.getSequenceTypeLabel(seq.type),
        description: seq.filename,
      })),
    [sequences],
  );

  return (
    <section>
      <ServiceHeader
        title="Viral Genome Tree"
        description="The Viral Genome Tree Service enables construction of whole genome alignment based phylogenetic trees for user-selected viral genomes."
        infoPopupTitle={phylogeneticTreeInfo.title}
        infoPopupDescription={phylogeneticTreeInfo.description}
        quickReferenceGuide="https://www.bv-brc.org/docs/quick_references/services/genetree.html"
        tutorial="https://www.bv-brc.org/docs/tutorial/genetree/genetree.html"
        instructionalVideo="https://www.youtube.com/watch?v=VtXWBRSdXRo"
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
              Choose genome group or FASTA files for tree.
            </CardDescription>
          </CardHeader>

          <CardContent className="service-card-content">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="service-card-label">
                  Genome Group
                </Label>
                <div className="flex gap-2">
                  <WorkspaceObjectSelector
                    types={["genome_group"]}
                    placeholder="Optional"
                    onSelectedObjectChange={(object: WorkspaceObject | null) => {
                      setSelectedGenomeGroupObject(object);
                    }}
                    value={selectedGenomeGroupObject?.path}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={handleAddGenomeGroup}
                    disabled={!selectedGenomeGroupObject || isValidatingGenomeGroup}
                  >
                    {isValidatingGenomeGroup ? <Spinner className="h-4 w-4" /> : <Plus size={16} />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="service-card-label">
                  Aligned FASTA
                </Label>
                <div className="flex gap-2">
                  <WorkspaceObjectSelector
                    types={["aligned_dna_fasta", "contigs"]}
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
                    disabled={!selectedAlignedFastaObject || isValidatingGenomeGroup}
                  >
                    <Plus size={16} />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="service-card-label">
                  Unaligned FASTA
                </Label>
                <div className="flex gap-2">
                  <WorkspaceObjectSelector
                    types={["feature_dna_fasta"]}
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
                    disabled={!selectedUnalignedFastaObject || isValidatingGenomeGroup}
                  >
                    <Plus size={16} />
                  </Button>
                </div>
              </div>

              <form.Field name="sequences">
                {(field) => (
                  <FieldItem>
                    <SelectedItemsTable
                      title="Selected genome group / FASTA files"
                      items={selectedItemsForTable}
                      onRemove={(id) => removeSequence(parseInt(id, 10))}
                      className="max-h-84 overflow-y-auto"
                      allowDuplicates={false}
                      description="Selected genome groups and FASTA files will be used to construct the phylogenetic tree."
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
                      <Label className="service-card-label">
                        Trim Ends of Alignment Threshold
                      </Label>
                      <Select
                        items={ViralGenomeTree.thresholdOptions.map((v) => ({ value: v, label: v }))}
                        value={field.state.value}
                        onValueChange={(value) => value != null && field.handleChange(value)}
                      >
                        <SelectTrigger className="service-card-select-trigger">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {ViralGenomeTree.thresholdOptions.map((value) => (
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
                      <Label className="service-card-label">
                        Remove Gappy Sequences Threshold
                      </Label>
                      <Select
                        items={ViralGenomeTree.thresholdOptions.map((v) => ({ value: v, label: v }))}
                        value={field.state.value}
                        onValueChange={(value) => value != null && field.handleChange(value)}
                      >
                        <SelectTrigger className="service-card-select-trigger">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {ViralGenomeTree.thresholdOptions.map((value) => (
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
                        onValueChange={(value) => value != null && field.handleChange(value as ViralGenomeTree.ViralGenomeTreeFormData["recipe"])}
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
                      <Label className="service-card-label">
                        Model
                      </Label>
                      <Select
                        items={ViralGenomeTree.dnaModels.map((m) => ({ value: m.value, label: m.label }))}
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
                            {ViralGenomeTree.dnaModels.map((model) => (
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
