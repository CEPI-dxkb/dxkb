"use client";

import { useState, useCallback } from "react";
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
} from "@/lib/services/service-info";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import OutputFolder from "@/components/services/output-folder";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import { WorkspaceObject } from "@/lib/workspace-client";
import { SingleGenomeSelector } from "@/components/services/single-genome-selector";
import { submitServiceJob } from "@/lib/services/service-utils";
import { JobParamsDialog } from "@/components/services/job-params-dialog";
import { useServiceFormSubmission } from "@/hooks/services/use-service-form-submission";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import SelectedItemsTable from "@/components/services/selected-items-table";
import { getGenomeIdsFromGroup, fetchGenomesByIds } from "@/lib/services/genome";
import {
  proteomeComparisonFormSchema,
  DEFAULT_PROTEOME_COMPARISON_FORM_VALUES,
  MAX_COMPARISON_GENOMES,
  type ProteomeComparisonFormData,
  type ComparisonItem,
} from "@/lib/forms/(protein-tools)/proteome-comparison/proteome-comparison-form-schema";
import {
  transformProteomeComparisonParams,
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

export default function ProteomeComparisonPage() {
  const form = useForm<ProteomeComparisonFormData>({
    resolver: zodResolver(proteomeComparisonFormSchema),
    defaultValues: DEFAULT_PROTEOME_COMPARISON_FORM_VALUES,
    mode: "onChange",
  });

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOutputNameValid, setIsOutputNameValid] = useState(true);

  // Watch form values
  const comparisonItems = form.watch("comparison_items") || [];
  const refSourceType = form.watch("ref_source_type");

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

    if (totalGenomeCount >= MAX_COMPARISON_GENOMES) {
      toast.error("Maximum genomes reached", {
        description: `Maximum of ${MAX_COMPARISON_GENOMES} comparison genomes allowed.`,
        closeButton: true,
      });
      return;
    }

    // Check for duplicates by genome_id
    if (isDuplicateComparisonItem(comparisonItems, { genome_id: selectedCompGenomeId })) {
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

      form.setValue("comparison_items", [...comparisonItems, newItem], {
        shouldValidate: true,
      });
      setSelectedCompGenomeId("");
    } catch (error) {
      console.error("Failed to fetch genome info:", error);
      // Fall back to using the genome ID as the name
      const newItem = createGenomeComparisonItem(selectedCompGenomeId, selectedCompGenomeId);
      form.setValue("comparison_items", [...comparisonItems, newItem], {
        shouldValidate: true,
      });
      setSelectedCompGenomeId("");
    } finally {
      setIsLoadingCompGenome(false);
    }
  }, [selectedCompGenomeId, comparisonItems, totalGenomeCount, form]);

  // Handle adding comparison fasta
  const handleAddCompFasta = useCallback(() => {
    if (!selectedCompFasta?.path) {
      toast.error("No FASTA file selected", {
        description: "Please select a protein FASTA file before adding.",
        closeButton: true,
      });
      return;
    }

    if (totalGenomeCount >= MAX_COMPARISON_GENOMES) {
      toast.error("Maximum genomes reached", {
        description: `Maximum of ${MAX_COMPARISON_GENOMES} comparison genomes allowed.`,
        closeButton: true,
      });
      return;
    }

    const newItem = createFastaComparisonItem(selectedCompFasta.path);

    if (isDuplicateComparisonItem(comparisonItems, newItem)) {
      toast.error("Duplicate file", {
        description: "This FASTA file is already in the comparison list.",
        closeButton: true,
      });
      return;
    }

    form.setValue("comparison_items", [...comparisonItems, newItem], {
      shouldValidate: true,
    });
    setSelectedCompFasta(null);
  }, [selectedCompFasta, comparisonItems, totalGenomeCount, form]);

  // Handle adding comparison feature group
  const handleAddCompFeatureGroup = useCallback(() => {
    if (!selectedCompFeatureGroup?.path) {
      toast.error("No feature group selected", {
        description: "Please select a feature group before adding.",
        closeButton: true,
      });
      return;
    }

    if (totalGenomeCount >= MAX_COMPARISON_GENOMES) {
      toast.error("Maximum genomes reached", {
        description: `Maximum of ${MAX_COMPARISON_GENOMES} comparison genomes allowed.`,
        closeButton: true,
      });
      return;
    }

    const newItem = createFeatureGroupComparisonItem(
      selectedCompFeatureGroup.path
    );

    if (isDuplicateComparisonItem(comparisonItems, newItem)) {
      toast.error("Duplicate feature group", {
        description: "This feature group is already in the comparison list.",
        closeButton: true,
      });
      return;
    }

    form.setValue("comparison_items", [...comparisonItems, newItem], {
      shouldValidate: true,
    });
    setSelectedCompFeatureGroup(null);
  }, [selectedCompFeatureGroup, comparisonItems, totalGenomeCount, form]);

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

      // Validate if adding would exceed max
      const validation = validateGenomeGroupAddition(
        comparisonItems,
        genomeIds,
        MAX_COMPARISON_GENOMES
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

      if (isDuplicateComparisonItem(comparisonItems, newItem)) {
        toast.error("Duplicate genome group", {
          description: "This genome group is already in the comparison list.",
          closeButton: true,
        });
        return;
      }

      form.setValue("comparison_items", [...comparisonItems, newItem], {
        shouldValidate: true,
      });
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
  }, [selectedCompGenomeGroup, comparisonItems, form]);

  // Handle removing comparison item
  const handleRemoveComparisonItem = useCallback(
    (itemId: string) => {
      const updatedItems = removeComparisonItemById(comparisonItems, itemId);
      form.setValue("comparison_items", updatedItems, { shouldValidate: true });
    },
    [comparisonItems, form]
  );

  // Handle reset
  const handleReset = useCallback(() => {
    form.reset(DEFAULT_PROTEOME_COMPARISON_FORM_VALUES);
    setSelectedCompGenomeId("");
    setSelectedCompFasta(null);
    setSelectedCompFeatureGroup(null);
    setSelectedCompGenomeGroup(null);
    setShowAdvancedParams(false);
  }, [form]);

  // Setup service form submission
  const {
    handleSubmit,
    showParamsDialog,
    setShowParamsDialog,
    currentParams,
    serviceName,
  } = useServiceFormSubmission<ProteomeComparisonFormData>({
    serviceName: "Proteome Comparison",
    transformParams: transformProteomeComparisonParams,
    onSubmit: async (data) => {
      try {
        setIsSubmitting(true);
        const result = await submitServiceJob(
          "GenomeComparison",
          transformProteomeComparisonParams(data)
        );

        if (result.success) {
          console.log(
            "Proteome Comparison job submitted successfully:",
            result.job?.[0]
          );

          toast.success("Proteome Comparison job submitted successfully!", {
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
        console.error("Failed to submit Proteome Comparison job:", error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to submit Proteome Comparison job";
        toast.error("Submission failed", {
          description: errorMessage,
          closeButton: true,
        });
      } finally {
        setIsSubmitting(false);
      }
    },
  });

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

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
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
                                outputFolderPath={form.watch("output_path")}
                                onValidationChange={setIsOutputNameValid}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
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
                          <FormField
                            control={form.control}
                            name="min_seq_cov"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="service-card-sublabel">
                                  Minimum % Coverage
                                </FormLabel>
                                <FormControl>
                                  <NumberInput
                                    ref={field.ref}
                                    name={field.name}
                                    value={field.value}
                                    min={10}
                                    max={100}
                                    stepper={5}
                                    onBlur={field.onBlur}
                                    onValueChange={(value) => {
                                      if (value !== undefined)
                                        field.onChange(value);
                                    }}
                                    className="relative [appearance:textfield] rounded-r-none bg-muted [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none service-card-input"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="max_e_val"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="service-card-sublabel">
                                  BLAST E-Value
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    placeholder="1e-5"
                                    className="service-card-input"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="min_ident"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="service-card-sublabel">
                                  Minimum % Identity
                                </FormLabel>
                                <FormControl>
                                  <NumberInput
                                    ref={field.ref}
                                    name={field.name}
                                    value={field.value}
                                    min={10}
                                    max={100}
                                    stepper={5}
                                    onBlur={field.onBlur}
                                    onValueChange={(value) => {
                                      if (value !== undefined)
                                        field.onChange(value);
                                    }}
                                    className="relative [appearance:textfield] rounded-r-none bg-muted [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none service-card-input"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
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
                    <FormField
                      control={form.control}
                      name="ref_genome_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="service-card-label">
                            Select a Genome
                          </FormLabel>
                          <FormControl>
                            <SingleGenomeSelector
                              placeholder="e.g. Mycobacterium tuberculosis H37Rv"
                              value={field.value ?? ""}
                              onChange={(genomeId) => {
                                field.onChange(genomeId);
                                form.setValue("ref_source_type", "genome");
                                // Clear other reference fields
                                form.setValue("ref_fasta_file", "");
                                form.setValue("ref_feature_group", "");
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Reference FASTA File */}
                    <FormField
                      control={form.control}
                      name="ref_fasta_file"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="service-card-label">
                            Or a Protein FASTA File
                          </FormLabel>
                          <FormControl>
                            <WorkspaceObjectSelector
                              types={["feature_protein_fasta"]}
                              placeholder="Select protein FASTA file (Optional)"
                              value={field.value}
                              onSelectedObjectChange={(
                                object: WorkspaceObject | null
                              ) => {
                                if (object?.path) {
                                  field.onChange(object.path);
                                  form.setValue("ref_source_type", "fasta");
                                  // Clear other reference fields
                                  form.setValue("ref_genome_id", "");
                                  form.setValue("ref_genome_name", "");
                                  form.setValue("ref_feature_group", "");
                                } else {
                                  field.onChange("");
                                }
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Reference Feature Group */}
                    <FormField
                      control={form.control}
                      name="ref_feature_group"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="service-card-label">
                            Or a Feature Group
                          </FormLabel>
                          <FormControl>
                            <WorkspaceObjectSelector
                              types={["feature_group"]}
                              placeholder="Select feature group (Optional)"
                              value={field.value}
                              onSelectedObjectChange={(
                                object: WorkspaceObject | null
                              ) => {
                                if (object?.path) {
                                  field.onChange(object.path);
                                  form.setValue("ref_source_type", "feature_group");
                                  // Clear other reference fields
                                  form.setValue("ref_genome_id", "");
                                  form.setValue("ref_genome_name", "");
                                  form.setValue("ref_fasta_file", "");
                                } else {
                                  field.onChange("");
                                }
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
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
                  Add up to {MAX_COMPARISON_GENOMES} genomes to compare (use plus
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
                          totalGenomeCount >= MAX_COMPARISON_GENOMES ||
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
                          totalGenomeCount >= MAX_COMPARISON_GENOMES
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
                          types={["feature_group"]}
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
                          totalGenomeCount >= MAX_COMPARISON_GENOMES
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
                          types={["genome_group"]}
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
                          totalGenomeCount >= MAX_COMPARISON_GENOMES ||
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
                        {totalGenomeCount} / {MAX_COMPARISON_GENOMES} genome(s)
                        selected
                      </span>
                    </div>

                    <FormField
                      control={form.control}
                      name="comparison_items"
                      render={() => (
                        <FormItem>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
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
              disabled={isSubmitting || !form.formState.isValid || !isOutputNameValid}
            >
              {isSubmitting ? <Spinner className="mr-2 h-4 w-4" /> : null}
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
