"use client";

import { useState, useCallback, useMemo } from "react";
import { useServiceRuntime } from "@/hooks/services/use-service-runtime";
import { useForm, useStore } from "@tanstack/react-form";
import { FieldItem, FieldErrors } from "@/components/ui/tanstack-form";
import { ServiceHeader } from "@/components/services/service-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Plus } from "lucide-react";
import {
  proteomeComparisonInfo,
  proteomeComparisonParameters,
  proteomeComparisonComparisonGenomes,
  proteomeComparisonReferenceGenome,
} from "@/lib/services/info/proteome-comparison";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import OutputFolder from "@/components/services/output-folder";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import { WorkspaceObject } from "@/lib/services/workspace/types";
import { SingleGenomeSelector } from "@/components/services/single-genome-selector";
import { JobParamsDialog } from "@/components/services/job-params-dialog";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import SelectedItemsTable from "@/components/services/selected-items-table";
import { getGenomeIdsFromGroup, fetchGenomesByIds } from "@/lib/services/genome";
import {
  proteomeComparisonFormSchema,
  defaultProteomeComparisonFormValues,
  maxComparisonGenomes,
  type ProteomeComparisonFormData,
  type ComparisonItem,
} from "@/lib/forms/(protein-tools)/proteome-comparison/proteome-comparison-form-schema";
import {
  getProteomeComparisonDisplayName,
  createGenomeComparisonItem,
  createFastaComparisonItem,
  createFeatureGroupComparisonItem,
  createGenomeGroupComparisonItem,
  isDuplicateComparisonItem,
  getComparisonItemTypeLabel,
  countTotalComparisonGenomes,
  removeComparisonItemById,
  validateGenomeGroupAddition,
} from "@/lib/forms/(protein-tools)/proteome-comparison/proteome-comparison-form-utils";
import { proteomeComparisonService } from "@/lib/forms/(protein-tools)/proteome-comparison/proteome-comparison-service";

export default function ProteomeComparisonPage() {
  // State for comparison genome selectors
  const [selectedCompGenomeId, setSelectedCompGenomeId] = useState<string>("");
  const [selectedCompFasta, setSelectedCompFasta] =
    useState<WorkspaceObject | null>(null);
  const [selectedCompFeatureGroup, setSelectedCompFeatureGroup] =
    useState<WorkspaceObject | null>(null);
  const [selectedCompGenomeGroup, setSelectedCompGenomeGroup] =
    useState<WorkspaceObject | null>(null);
  const [isLoadingGenomeGroup, setIsLoadingGenomeGroup] = useState(false);
  const [isLoadingCompGenome, setIsLoadingCompGenome] = useState(false);

  // State for advanced parameters visibility
  const [showAdvancedParams, setShowAdvancedParams] = useState(false);

  // State for submission
  const [isOutputNameValid, setIsOutputNameValid] = useState(true);

  const form = useForm({
    defaultValues: defaultProteomeComparisonFormValues as ProteomeComparisonFormData,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validators: { onChange: proteomeComparisonFormSchema as any },
    onSubmit: async ({ value }) => {
      await runtime.submitFormData(value as ProteomeComparisonFormData);
    },
  });

  // Handle reset
  const handleReset = useCallback(() => {
    form.reset(defaultProteomeComparisonFormValues);
    setSelectedCompGenomeId("");
    setSelectedCompFasta(null);
    setSelectedCompFeatureGroup(null);
    setSelectedCompGenomeGroup(null);
    setShowAdvancedParams(false);
  }, [form]);

  const runtime = useServiceRuntime({
    definition: proteomeComparisonService,
    form,
    onSuccess: handleReset,
  });
  const { isSubmitting, jobParamsDialogProps } = runtime;

  // Watch form values
  const rawComparisonItems = useStore(form.store, (s) => s.values.comparison_items);
  const comparisonItems = useMemo(() => rawComparisonItems || [], [rawComparisonItems]);
  const outputPath = useStore(form.store, (s) => s.values.output_path);
  const canSubmit = useStore(form.store, (s) => s.canSubmit);

  // Calculate total genome count (accounting for genome groups)
  const totalGenomeCount = countTotalComparisonGenomes(comparisonItems);

  // Handle adding comparison genome
  const handleAddCompGenome = useCallback(async () => {
    if (!selectedCompGenomeId || selectedCompGenomeId.trim() === "") {
      toast.error("No genome selected", {
        description: "Please select a genome before adding.",
        closeButton: true,
      });
      return;
    }

    if (totalGenomeCount >= maxComparisonGenomes) {
      toast.error("Maximum genomes reached", {
        description: `Maximum of ${maxComparisonGenomes} comparison genomes allowed.`,
        closeButton: true,
      });
      return;
    }

    const currentItems = form.state.values.comparison_items || [];

    // Check for duplicates by genome_id
    if (isDuplicateComparisonItem(currentItems, { genome_id: selectedCompGenomeId })) {
      toast.error("Duplicate genome", {
        description: "This genome is already in the comparison list.",
        closeButton: true,
      });
      return;
    }

    setIsLoadingCompGenome(true);

    try {
      // Fetch the genome name from the API
      const genomes = await fetchGenomesByIds([selectedCompGenomeId]);
      const genomeName = genomes.length > 0 ? genomes[0].genome_name : selectedCompGenomeId;

      const newItem = createGenomeComparisonItem(selectedCompGenomeId, genomeName);

      form.setFieldValue("comparison_items", [...currentItems, newItem]);
      setSelectedCompGenomeId("");
    } catch (error) {
      console.error("Failed to fetch genome info:", error);
      // Fall back to using the genome ID as the name
      const newItem = createGenomeComparisonItem(selectedCompGenomeId, selectedCompGenomeId);
      form.setFieldValue("comparison_items", [...currentItems, newItem]);
      setSelectedCompGenomeId("");
    } finally {
      setIsLoadingCompGenome(false);
    }
  }, [selectedCompGenomeId, totalGenomeCount, form]);

  // Handle adding comparison fasta
  const handleAddCompFasta = useCallback(() => {
    if (!selectedCompFasta?.path) {
      toast.error("No FASTA file selected", {
        description: "Please select a protein FASTA file before adding.",
        closeButton: true,
      });
      return;
    }

    if (totalGenomeCount >= maxComparisonGenomes) {
      toast.error("Maximum genomes reached", {
        description: `Maximum of ${maxComparisonGenomes} comparison genomes allowed.`,
        closeButton: true,
      });
      return;
    }

    const currentItems = form.state.values.comparison_items || [];
    const newItem = createFastaComparisonItem(selectedCompFasta.path);

    if (isDuplicateComparisonItem(currentItems, newItem)) {
      toast.error("Duplicate file", {
        description: "This FASTA file is already in the comparison list.",
        closeButton: true,
      });
      return;
    }

    form.setFieldValue("comparison_items", [...currentItems, newItem]);
    setSelectedCompFasta(null);
  }, [selectedCompFasta, totalGenomeCount, form]);

  // Handle adding comparison feature group
  const handleAddCompFeatureGroup = useCallback(() => {
    if (!selectedCompFeatureGroup?.path) {
      toast.error("No feature group selected", {
        description: "Please select a feature group before adding.",
        closeButton: true,
      });
      return;
    }

    if (totalGenomeCount >= maxComparisonGenomes) {
      toast.error("Maximum genomes reached", {
        description: `Maximum of ${maxComparisonGenomes} comparison genomes allowed.`,
        closeButton: true,
      });
      return;
    }

    const currentItems = form.state.values.comparison_items || [];
    const newItem = createFeatureGroupComparisonItem(
      selectedCompFeatureGroup.path
    );

    if (isDuplicateComparisonItem(currentItems, newItem)) {
      toast.error("Duplicate feature group", {
        description: "This feature group is already in the comparison list.",
        closeButton: true,
      });
      return;
    }

    form.setFieldValue("comparison_items", [...currentItems, newItem]);
    setSelectedCompFeatureGroup(null);
  }, [selectedCompFeatureGroup, totalGenomeCount, form]);

  // Handle adding comparison genome group
  const handleAddCompGenomeGroup = useCallback(async () => {
    if (!selectedCompGenomeGroup?.path) {
      toast.error("No genome group selected", {
        description: "Please select a genome group before adding.",
        closeButton: true,
      });
      return;
    }

    setIsLoadingGenomeGroup(true);

    try {
      // Fetch genome IDs from the group
      const genomeIds = await getGenomeIdsFromGroup(selectedCompGenomeGroup.path);

      if (genomeIds.length === 0) {
        toast.error("Empty genome group", {
          description: "The selected genome group has no genomes.",
          closeButton: true,
        });
        return;
      }

      const currentItems = form.state.values.comparison_items || [];

      // Validate if adding would exceed max
      const validation = validateGenomeGroupAddition(
        currentItems,
        genomeIds,
        maxComparisonGenomes
      );

      if (!validation.valid) {
        toast.error("Cannot add genome group", {
          description: validation.message,
          closeButton: true,
        });
        return;
      }

      const newItem = createGenomeGroupComparisonItem(
        selectedCompGenomeGroup.path,
        genomeIds
      );

      if (isDuplicateComparisonItem(currentItems, newItem)) {
        toast.error("Duplicate genome group", {
          description: "This genome group is already in the comparison list.",
          closeButton: true,
        });
        return;
      }

      form.setFieldValue("comparison_items", [...currentItems, newItem]);
      setSelectedCompGenomeGroup(null);

      toast.success(`Added genome group with ${genomeIds.length} genome(s)`, {
        closeButton: true,
      });
    } catch (error) {
      console.error("Failed to add genome group:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to add genome group";
      toast.error("Failed to add genome group", {
        description: errorMessage,
        closeButton: true,
      });
    } finally {
      setIsLoadingGenomeGroup(false);
    }
  }, [selectedCompGenomeGroup, form]);

  // Handle removing comparison item
  const handleRemoveComparisonItem = useCallback(
    (itemId: string) => {
      const currentItems = form.state.values.comparison_items || [];
      const updatedItems = removeComparisonItemById(currentItems, itemId);
      form.setFieldValue("comparison_items", updatedItems);
    },
    [form]
  );

  return (
    <section>
      <ServiceHeader
        title="Proteome Comparison"
        description="The Proteome Comparison Service performs protein sequence-based genome
          comparison using bidirectional BLASTP. This service allows users to
          select genomes and compare them to a reference genome."
        infoPopupTitle={proteomeComparisonInfo.title}
        infoPopupDescription={proteomeComparisonInfo.description}
        quickReferenceGuide="https://www.bv-brc.org/docs/quick_references/services/proteome_comparison_service.html"
        tutorial="https://www.bv-brc.org/docs/tutorial/proteome_comparison/proteome_comparison.html"
        instructionalVideo="https://www.youtube.com/watch?v=UJak-ifQ9FE"
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="flex flex-col gap-4"
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Left Column */}
          <div className="flex flex-col gap-6">
            {/* Parameters Card */}
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

                  {/* Advanced Parameters */}
                  <Collapsible
                    open={showAdvancedParams}
                    onOpenChange={setShowAdvancedParams}
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
                        <form.Field name="min_seq_cov">
                          {(field) => (
                            <FieldItem>
                              <Label className="service-card-sublabel">
                                Minimum % Coverage
                              </Label>
                              <NumberInput
                                name={field.name}
                                value={field.state.value}
                                min={10}
                                max={100}
                                stepper={5}
                                onValueChange={(value) => {
                                  if (value !== undefined)
                                    field.handleChange(value);
                                }}
                                className="relative [appearance:textfield] rounded-r-none bg-muted [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none service-card-input"
                              />
                              <FieldErrors field={field} />
                            </FieldItem>
                          )}
                        </form.Field>

                        <form.Field name="max_e_val">
                          {(field) => (
                            <FieldItem>
                              <Label className="service-card-sublabel">
                                BLAST E-Value
                              </Label>
                              <Input
                                value={field.state.value}
                                onChange={(e) => field.handleChange(e.target.value)}
                                placeholder="1e-5"
                                className="service-card-input"
                              />
                              <FieldErrors field={field} />
                            </FieldItem>
                          )}
                        </form.Field>

                        <form.Field name="min_ident">
                          {(field) => (
                            <FieldItem>
                              <Label className="service-card-sublabel">
                                Minimum % Identity
                              </Label>
                              <NumberInput
                                name={field.name}
                                value={field.state.value}
                                min={10}
                                max={100}
                                stepper={5}
                                onValueChange={(value) => {
                                  if (value !== undefined)
                                    field.handleChange(value);
                                }}
                                className="relative [appearance:textfield] rounded-r-none bg-muted [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none service-card-input"
                              />
                              <FieldErrors field={field} />
                            </FieldItem>
                          )}
                        </form.Field>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </CardContent>
            </Card>

            {/* Reference Genome Card */}
            <Card>
              <CardHeader className="service-card-header">
                <RequiredFormCardTitle className="service-card-title">
                  Reference Genome
                  <DialogInfoPopup
                    title={proteomeComparisonReferenceGenome.title}
                    description={proteomeComparisonReferenceGenome.description}
                    sections={proteomeComparisonReferenceGenome.sections}
                  />
                </RequiredFormCardTitle>
                <CardDescription>
                  Select 1 reference genome from the following options
                </CardDescription>
              </CardHeader>

              <CardContent className="service-card-content">
                <div className="space-y-4">
                  {/* Reference Genome Selector */}
                  <form.Field name="ref_genome_id">
                    {(field) => (
                      <FieldItem>
                        <Label className="service-card-label">
                          Select a Genome
                        </Label>
                        <SingleGenomeSelector
                          placeholder="e.g. Mycobacterium tuberculosis H37Rv"
                          value={field.state.value ?? ""}
                          onChange={(genomeId) => {
                            field.handleChange(genomeId);
                            form.setFieldValue("ref_source_type", "genome");
                            // Clear other reference fields
                            form.setFieldValue("ref_fasta_file", "");
                            form.setFieldValue("ref_feature_group", "");
                          }}
                        />
                        <FieldErrors field={field} />
                      </FieldItem>
                    )}
                  </form.Field>

                  {/* Reference FASTA File */}
                  <form.Field name="ref_fasta_file">
                    {(field) => (
                      <FieldItem>
                        <Label className="service-card-label">
                          Or a Protein FASTA File
                        </Label>
                        <WorkspaceObjectSelector
                          types={["feature_protein_fasta"]}
                          placeholder="Select protein FASTA file (Optional)"
                          value={field.state.value}
                          onSelectedObjectChange={(
                            object: WorkspaceObject | null
                          ) => {
                            if (object?.path) {
                              field.handleChange(object.path);
                              form.setFieldValue("ref_source_type", "fasta");
                              // Clear other reference fields
                              form.setFieldValue("ref_genome_id", "");
                              form.setFieldValue("ref_genome_name", "");
                              form.setFieldValue("ref_feature_group", "");
                            } else {
                              field.handleChange("");
                            }
                          }}
                        />
                        <FieldErrors field={field} />
                      </FieldItem>
                    )}
                  </form.Field>

                  {/* Reference Feature Group */}
                  <form.Field name="ref_feature_group">
                    {(field) => (
                      <FieldItem>
                        <Label className="service-card-label">
                          Or a Feature Group
                        </Label>
                        <WorkspaceObjectSelector
                          preset="featureGroup"
                          placeholder="Select feature group (Optional)"
                          value={field.state.value}
                          onSelectedObjectChange={(
                            object: WorkspaceObject | null
                          ) => {
                            if (object?.path) {
                              field.handleChange(object.path);
                              form.setFieldValue("ref_source_type", "feature_group");
                              // Clear other reference fields
                              form.setFieldValue("ref_genome_id", "");
                              form.setFieldValue("ref_genome_name", "");
                              form.setFieldValue("ref_fasta_file", "");
                            } else {
                              field.handleChange("");
                            }
                          }}
                        />
                        <FieldErrors field={field} />
                      </FieldItem>
                    )}
                  </form.Field>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Comparison Genomes */}
          <Card>
            <CardHeader className="service-card-header">
              <RequiredFormCardTitle className="service-card-title">
                Comparison Genomes
                <DialogInfoPopup
                  title={proteomeComparisonComparisonGenomes.title}
                  description={proteomeComparisonComparisonGenomes.description}
                  sections={proteomeComparisonComparisonGenomes.sections}
                />
              </RequiredFormCardTitle>
              <CardDescription>
                Add up to {maxComparisonGenomes} genomes to compare (use plus
                buttons to add)
              </CardDescription>
            </CardHeader>

            <CardContent className="service-card-content">
              <div className="space-y-4">
                {/* Select Genome */}
                <div className="space-y-2">
                  <Label className="service-card-label">Select Genome</Label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <SingleGenomeSelector
                        placeholder="Select genome"
                        value={selectedCompGenomeId}
                        onChange={(genomeId) => {
                          setSelectedCompGenomeId(genomeId);
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleAddCompGenome}
                      disabled={
                        !selectedCompGenomeId ||
                        totalGenomeCount >= maxComparisonGenomes ||
                        isLoadingCompGenome
                      }
                    >
                      {isLoadingCompGenome ? (
                        <Spinner className="h-4 w-4" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Select Protein FASTA File */}
                <div className="space-y-2">
                  <Label className="service-card-label">
                    And/Or Select Protein FASTA File
                  </Label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <WorkspaceObjectSelector
                        types={["feature_protein_fasta"]}
                        placeholder="Select protein FASTA file (Optional)"
                        value={selectedCompFasta?.path}
                        onSelectedObjectChange={(
                          object: WorkspaceObject | null
                        ) => {
                          setSelectedCompFasta(object);
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleAddCompFasta}
                      disabled={
                        !selectedCompFasta ||
                        totalGenomeCount >= maxComparisonGenomes
                      }
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Select Feature Group */}
                <div className="space-y-2">
                  <Label className="service-card-label">
                    And/Or Select Feature Group
                  </Label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <WorkspaceObjectSelector
                        preset="featureGroup"
                        placeholder="Select feature group (Optional)"
                        value={selectedCompFeatureGroup?.path}
                        onSelectedObjectChange={(
                          object: WorkspaceObject | null
                        ) => {
                          setSelectedCompFeatureGroup(object);
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleAddCompFeatureGroup}
                      disabled={
                        !selectedCompFeatureGroup ||
                        totalGenomeCount >= maxComparisonGenomes
                      }
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Select Genome Group */}
                <div className="space-y-2">
                  <Label className="service-card-label">
                    And/Or Select Genome Group
                  </Label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <WorkspaceObjectSelector
                        preset="genomeGroup"
                        placeholder="Select genome group (Optional)"
                        value={selectedCompGenomeGroup?.path}
                        onSelectedObjectChange={(
                          object: WorkspaceObject | null
                        ) => {
                          setSelectedCompGenomeGroup(object);
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleAddCompGenomeGroup}
                      disabled={
                        !selectedCompGenomeGroup ||
                        totalGenomeCount >= maxComparisonGenomes ||
                        isLoadingGenomeGroup
                      }
                    >
                      {isLoadingGenomeGroup ? (
                        <Spinner className="h-4 w-4" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Selected Genome Table */}
                <div className="space-y-2">
                  <SelectedItemsTable
                    title="Selected Genome Table"
                    items={comparisonItems.map((item: ComparisonItem) => ({
                      id: item.id,
                      name: getProteomeComparisonDisplayName(item.name),
                      type: getComparisonItemTypeLabel(item.type),
                      description:
                        item.type === "genome_group" && item.genome_ids
                          ? `${item.genome_ids.length} genome(s)`
                          : undefined,
                    }))}
                    onRemove={handleRemoveComparisonItem}
                    emptyMessage="No genomes selected. Add genomes using the options above."
                    className="max-h-80 overflow-y-auto"
                  />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {totalGenomeCount} / {maxComparisonGenomes} genome(s)
                      selected
                    </span>
                  </div>

                  <form.Field name="comparison_items">
                    {(field) => (
                      <FieldItem>
                        <FieldErrors field={field} />
                      </FieldItem>
                    )}
                  </form.Field>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Form Controls */}
        <div className="service-form-controls">
          <Button type="button" variant="outline" onClick={handleReset}>
            Reset
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || !canSubmit || !isOutputNameValid}
          >
            {isSubmitting ? <Spinner className="mr-2 h-4 w-4" /> : null}
            Submit
          </Button>
        </div>
      </form>

      <JobParamsDialog {...jobParamsDialogProps} />
    </section>
  );
}
