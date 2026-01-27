"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { submitServiceJob } from "@/lib/services/service-utils";
import { fetchGenomeGroupMembers, validateViralGenomes } from "@/lib/services/genome";
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
import * as ViralGenomeTree from "@/lib/forms/(phylogenomics)/viral-genome-tree/viral-genome-tree-form-schema";
import * as ViralGenomeTreeUtils from "@/lib/forms/(phylogenomics)/viral-genome-tree/viral-genome-tree-form-utils";

interface MetadataField {
  id: string;
  name: string;
  selected: boolean;
}

export default function ViralGenomeTreePage() {
  const form = useForm<ViralGenomeTree.ViralGenomeTreeFormData>({
    resolver: zodResolver(ViralGenomeTree.viralGenomeTreeFormSchema),
    defaultValues: ViralGenomeTree.DEFAULT_VIRAL_GENOME_TREE_FORM_VALUES,
    mode: "onChange",
  });

  const [selectedGenomeGroupObject, setSelectedGenomeGroupObject] =
    useState<WorkspaceObject | null>(null);
  const [selectedAlignedFastaObject, setSelectedAlignedFastaObject] =
    useState<WorkspaceObject | null>(null);
  const [selectedUnalignedFastaObject, setSelectedUnalignedFastaObject] =
    useState<WorkspaceObject | null>(null);
  const [metadataFields, setMetadataFields] =
    useState<MetadataField[]>(ViralGenomeTree.DEFAULT_METADATA_FIELDS as MetadataField[]);
  const [selectedMetadataField, setSelectedMetadataField] =
    useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidatingGenomeGroup, setIsValidatingGenomeGroup] = useState(false);

  const sequences = form.watch("sequences");
  const substitutionModel = form.watch("substitution_model");

  // Update metadata fields in form when they change
  useEffect(() => {
    const selectedFields = metadataFields
      .filter((field) => field.selected)
      .map((field) => field.id);
    form.setValue("metadata_fields", selectedFields);
  }, [metadataFields, form]);

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
    const currentSequences = form.getValues("sequences");
    
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

      form.setValue("sequences", [...currentSequences, newSequence]);
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

    const currentSequences = form.getValues("sequences");
    
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

    form.setValue("sequences", [...currentSequences, newSequence]);

    if (source === "aligned") setSelectedAlignedFastaObject(null);
    if (source === "unaligned") setSelectedUnalignedFastaObject(null);
  }

  function removeSequence(index: number) {
    const currentSequences = form.getValues("sequences");
    form.setValue(
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
    form.reset(ViralGenomeTree.DEFAULT_VIRAL_GENOME_TREE_FORM_VALUES);
    setSelectedGenomeGroupObject(null);
    setSelectedAlignedFastaObject(null);
    setSelectedUnalignedFastaObject(null);
    setMetadataFields(ViralGenomeTree.DEFAULT_METADATA_FIELDS as MetadataField[]);
    setSelectedMetadataField("");
    setShowAdvanced(false);
  }

  // Setup service debugging and form submission
  const {
    handleSubmit,
    showParamsDialog,
    setShowParamsDialog,
    currentParams,
    serviceName,
  } = useServiceFormSubmission<ViralGenomeTree.ViralGenomeTreeFormData>({
    serviceName: "Viral Genome Tree",
    transformParams: ViralGenomeTreeUtils.transformViralGenomeTreeParams,
    onSubmit: async (data) => {
      try {
        setIsSubmitting(true);
        const result = await submitServiceJob(
          "GeneTree",
          ViralGenomeTreeUtils.transformViralGenomeTreeParams(data),
        );

        if (result.success) {
          console.log("Viral Genome Tree job submitted successfully:", result.job?.[0]);

          toast.success("Viral Genome Tree job submitted successfully!", {
            description: result.job?.[0]?.id
              ? `Job ID: ${result.job[0].id}`
              : "Job submitted successfully",
            closeButton: true,
          });

          handleReset();
        } else {
          throw new Error(result.error || "Failed to submit job");
        }
      } catch (error) {
        console.error("Failed to submit Viral Genome Tree job:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Failed to submit Viral Genome Tree job";
        toast.error("Submission failed", {
          description: errorMessage,
          closeButton: true,
        });
      } finally {
        setIsSubmitting(false);
      }
    },
  });

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

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
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
                  <FormLabel className="service-card-label">
                    Genome Group
                  </FormLabel>
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
                  <FormLabel className="service-card-label">
                    Aligned FASTA
                  </FormLabel>
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
                  <FormLabel className="service-card-label">
                    Unaligned FASTA
                  </FormLabel>
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

                <FormField
                  control={form.control}
                  name="sequences"
                  render={() => (
                    <FormItem>
                      <FormControl>
                        <SelectedItemsTable
                          title="Selected genome group / FASTA files"
                          items={selectedItemsForTable}
                          onRemove={(id) => removeSequence(parseInt(id, 10))}
                          className="max-h-84 overflow-y-auto"
                          allowDuplicates={false}
                          description="Selected genome groups and FASTA files will be used to construct the phylogenetic tree."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                  <FormField
                    control={form.control}
                    name="trim_threshold"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="service-card-label">
                          Trim Ends of Alignment Threshold
                        </FormLabel>
                        <FormControl>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger className="service-card-select-trigger">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              {ViralGenomeTree.THRESHOLD_OPTIONS.map((value) => (
                                <SelectItem key={value} value={value}>
                                  {value}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="gap_threshold"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="service-card-label">
                          Remove Gappy Sequences Threshold
                        </FormLabel>
                        <FormControl>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger className="service-card-select-trigger">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              {ViralGenomeTree.THRESHOLD_OPTIONS.map((value) => (
                                <SelectItem key={value} value={value}>
                                  {value}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                  <FormField
                    control={form.control}
                    name="recipe"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <RadioGroup
                            value={field.value}
                            onValueChange={field.onChange}
                            className="service-radio-group"
                          >
                            <div className="service-radio-group-item">
                              <RadioGroupItem value="RAxML" id="raxml" />
                              <FormLabel htmlFor="raxml">RAxML</FormLabel>
                            </div>
                            <div className="service-radio-group-item">
                              <RadioGroupItem value="PhyML" id="phyml" />
                              <FormLabel htmlFor="phyml">PhyML</FormLabel>
                            </div>
                            <div className="service-radio-group-item">
                              <RadioGroupItem value="FastTree" id="fasttree" />
                              <FormLabel htmlFor="fasttree">FastTree</FormLabel>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="substitution_model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="service-card-label">
                          Model
                        </FormLabel>
                        <FormControl>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger
                              id="model"
                              className="service-card-select-trigger"
                            >
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              {ViralGenomeTree.DNA_MODELS.map((model) => (
                                <SelectItem key={model.value} value={model.value}>
                                  {model.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex flex-col space-y-4">
                    <FormField
                      control={form.control}
                      name="output_path"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <OutputFolder
                              required={true}
                              value={field.value}
                              onChange={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="output_file"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <OutputFolder
                              variant="name"
                              required={true}
                              value={field.value}
                              onChange={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
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
                        value={selectedMetadataField}
                        onValueChange={handleMetadataSelection}
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
              disabled={isSubmitting || !form.formState.isValid}
            >
              {isSubmitting ? <Spinner /> : null}
              Submit
            </Button>
          </div>
        </form>
      </Form>

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
