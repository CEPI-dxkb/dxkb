"use client";

import { useRef, useState } from "react";
import { useServiceRuntime } from "@/hooks/services/use-service-runtime";
import { useForm } from "@tanstack/react-form";
import { useSelector } from "@tanstack/react-store";
import { FieldItem, FieldErrors } from "@/components/ui/tanstack-form";
import { ServiceHeader } from "@/components/services/service-header";
import { Card } from "@/components/ui/card";
import { ChevronDown } from "lucide-react";
import {
  proteomeComparisonInfo,
  proteomeComparisonParameters,
  proteomeComparisonComparisonGenomes,
  proteomeComparisonReferenceGenome,
} from "@/lib/services/info/proteome-comparison";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import { ServiceOutputFields } from "@/components/services/service-output-fields";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import { WorkspaceObject } from "@/lib/services/workspace/types";
import { SingleGenomeSelector } from "@/components/services/single-genome-selector";
import { JobParamsDialog } from "@/components/services/job-params-dialog";
import { toast } from "sonner";
import SelectedItemsTable from "@/components/services/selected-items-table";
import {
  ServiceCardContent,
  ServiceCardDescription,
  ServiceCardHeader,
  ServiceCardTitle,
} from "@/components/services/form-ui/service-card";
import {
  ServiceCollapsible,
  ServiceCollapsibleContent,
  ServiceCollapsibleTrigger,
} from "@/components/services/form-ui/service-collapsible";
import {
  ServiceInput,
  ServiceNumberInput,
} from "@/components/services/form-ui/service-input";
import { ServiceAddButton } from "@/components/services/form-ui/service-add-button";
import { ServiceFieldSubLabel } from "@/components/services/form-ui/service-field";
import { ServiceFormFooter } from "@/components/services/form-ui/service-form-footer";
import {
  ServiceLabel,
  ServiceSubLabel,
} from "@/components/services/form-ui/service-label";
import {
  getGenomeIdsFromGroup,
  fetchGenomesByIds,
} from "@/lib/services/genome";
import { formatUserFacingErrorMessage } from "@/lib/utils";
import {
  proteomeComparisonFormSchema,
  defaultProteomeComparisonFormValues,
  maxComparisonGenomes,
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

function useProteomeComparisonPage() {
  const [selectedCompGenomeId, setSelectedCompGenomeId] = useState<string>("");
  const [selectedCompFasta, setSelectedCompFasta] =
    useState<WorkspaceObject | null>(null);
  const [selectedCompFeatureGroup, setSelectedCompFeatureGroup] =
    useState<WorkspaceObject | null>(null);
  const [selectedCompGenomeGroup, setSelectedCompGenomeGroup] =
    useState<WorkspaceObject | null>(null);
  const [isLoadingGenomeGroup, setIsLoadingGenomeGroup] = useState(false);
  const [isLoadingCompGenome, setIsLoadingCompGenome] = useState(false);
  const [compGenomeLookupNote, setCompGenomeLookupNote] = useState<
    string | null
  >(null);
  // Reset bumps this so reads still in flight neither add to the new comparison nor clear a newer add's spinner.
  const resetRevisionRef = useRef(0);

  const [showAdvancedParams, setShowAdvancedParams] = useState(false);

  const [isOutputNameValid, setIsOutputNameValid] = useState(true);

  const form = useForm({
    defaultValues: defaultProteomeComparisonFormValues,
    validators: { onChange: proteomeComparisonFormSchema },
    onSubmit: async ({ value }) => {
      await runtime.submitFormData(value);
    },
  });

  function handleReset() {
    resetRevisionRef.current += 1;
    form.reset(defaultProteomeComparisonFormValues);
    setSelectedCompGenomeId("");
    setSelectedCompFasta(null);
    setSelectedCompFeatureGroup(null);
    setSelectedCompGenomeGroup(null);
    setIsLoadingGenomeGroup(false);
    setIsLoadingCompGenome(false);
    setCompGenomeLookupNote(null);
    setShowAdvancedParams(false);
  }

  const runtime = useServiceRuntime({
    definition: proteomeComparisonService,
    form,
    onSuccess: handleReset,
  });
  const { isSubmitting, jobParamsDialogProps } = runtime;

  const comparisonItems = useSelector(
    form.store,
    (s) => s.values.comparison_items,
  );
  const canSubmit = useSelector(form.store, (s) => s.canSubmit);

  const totalGenomeCount = countTotalComparisonGenomes(comparisonItems);

  async function handleAddCompGenome() {
    if (!selectedCompGenomeId || selectedCompGenomeId.trim() === "") {
      toast.error("No genome selected", {
        description: "Please select a genome before adding.",
        closeButton: true,
      });
      return;
    }

    if (totalGenomeCount >= maxComparisonGenomes) {
      toast.error("Maximum genomes reached", {
        description: `Maximum of ${String(maxComparisonGenomes)} comparison genomes allowed.`,
        closeButton: true,
      });
      return;
    }

    const currentItems = form.state.values.comparison_items;

    if (
      isDuplicateComparisonItem(currentItems, {
        genome_id: selectedCompGenomeId,
      })
    ) {
      toast.error("Duplicate genome", {
        description: "This genome is already in the comparison list.",
        closeButton: true,
      });
      return;
    }

    const resetRevision = resetRevisionRef.current;
    setIsLoadingCompGenome(true);

    let genomeName = selectedCompGenomeId;
    let lookupNote: string | null = null;
    try {
      const genomes = await fetchGenomesByIds([selectedCompGenomeId]);
      if (genomes.length > 0) genomeName = genomes[0].genome_name;
    } catch (error) {
      console.error("Failed to fetch genome info:", error);
      lookupNote = `Added ${selectedCompGenomeId} by ID: its name could not be loaded (${formatUserFacingErrorMessage(
        error,
        "the genome service did not answer",
      )}).`;
    }

    if (resetRevision !== resetRevisionRef.current) return;

    setIsLoadingCompGenome(false);

    const latestItems = form.state.values.comparison_items;
    if (countTotalComparisonGenomes(latestItems) >= maxComparisonGenomes) {
      toast.error("Maximum genomes reached", {
        description: `Maximum of ${String(maxComparisonGenomes)} comparison genomes allowed.`,
        closeButton: true,
      });
      return;
    }

    const newItem = createGenomeComparisonItem(
      selectedCompGenomeId,
      genomeName,
    );
    form.setFieldValue("comparison_items", [...latestItems, newItem]);
    setCompGenomeLookupNote(lookupNote);
    setSelectedCompGenomeId("");
  }

  function handleAddCompFasta() {
    if (!selectedCompFasta?.path) {
      toast.error("No FASTA file selected", {
        description: "Please select a protein FASTA file before adding.",
        closeButton: true,
      });
      return;
    }

    if (totalGenomeCount >= maxComparisonGenomes) {
      toast.error("Maximum genomes reached", {
        description: `Maximum of ${String(maxComparisonGenomes)} comparison genomes allowed.`,
        closeButton: true,
      });
      return;
    }

    const currentItems = form.state.values.comparison_items;
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
  }

  function handleAddCompFeatureGroup() {
    if (!selectedCompFeatureGroup?.path) {
      toast.error("No feature group selected", {
        description: "Please select a feature group before adding.",
        closeButton: true,
      });
      return;
    }

    if (totalGenomeCount >= maxComparisonGenomes) {
      toast.error("Maximum genomes reached", {
        description: `Maximum of ${String(maxComparisonGenomes)} comparison genomes allowed.`,
        closeButton: true,
      });
      return;
    }

    const currentItems = form.state.values.comparison_items;
    const newItem = createFeatureGroupComparisonItem(
      selectedCompFeatureGroup.path,
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
  }

  async function handleAddCompGenomeGroup() {
    if (!selectedCompGenomeGroup?.path) {
      toast.error("No genome group selected", {
        description: "Please select a genome group before adding.",
        closeButton: true,
      });
      return;
    }

    const resetRevision = resetRevisionRef.current;
    setIsLoadingGenomeGroup(true);

    try {
      // The spinner ends on `.finally()`, not a `finally` clause, which would make the React Compiler skip this page.
      const genomeIds = await getGenomeIdsFromGroup(
        selectedCompGenomeGroup.path,
      ).finally(() => {
        if (resetRevision === resetRevisionRef.current) {
          setIsLoadingGenomeGroup(false);
        }
      });

      if (resetRevision !== resetRevisionRef.current) return;

      if (genomeIds.length === 0) {
        toast.error("Empty genome group", {
          description: "The selected genome group has no genomes.",
          closeButton: true,
        });
        return;
      }

      const currentItems = form.state.values.comparison_items;

      const validation = validateGenomeGroupAddition(
        currentItems,
        genomeIds,
        maxComparisonGenomes,
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
        genomeIds,
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

      toast.success(
        `Added genome group with ${String(genomeIds.length)} genome(s)`,
        {
          closeButton: true,
        },
      );
    } catch (error) {
      if (resetRevision !== resetRevisionRef.current) return;
      console.error("Failed to add genome group:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to add genome group";
      toast.error("Failed to add genome group", {
        description: errorMessage,
        closeButton: true,
      });
    }
  }

  function handleRemoveComparisonItem(itemId: string) {
    const currentItems = form.state.values.comparison_items;
    form.setFieldValue(
      "comparison_items",
      removeComparisonItemById(currentItems, itemId),
    );
  }

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
          void form.handleSubmit();
        }}
        className="flex flex-col gap-4"
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-6">
            <Card>
              <ServiceCardHeader>
                <ServiceCardTitle>
                  Parameters
                  <DialogInfoPopup
                    title={proteomeComparisonParameters.title}
                    description={proteomeComparisonParameters.description}
                    sections={proteomeComparisonParameters.sections}
                  />
                </ServiceCardTitle>
              </ServiceCardHeader>

              <ServiceCardContent>
                <div className="space-y-4">
                  <form.Field name="output_path">
                    {(outputPathField) => (
                      <form.Field name="output_file">
                        {(outputNameField) => (
                          <ServiceOutputFields
                            outputPath={{
                              value: outputPathField.state.value,
                              onChange: outputPathField.handleChange,
                              errors: <FieldErrors field={outputPathField} />,
                            }}
                            outputName={{
                              value: outputNameField.state.value,
                              onChange: outputNameField.handleChange,
                              errors: <FieldErrors field={outputNameField} />,
                            }}
                            onOutputNameValidationChange={setIsOutputNameValid}
                          />
                        )}
                      </form.Field>
                    )}
                  </form.Field>

                  <ServiceCollapsible
                    open={showAdvancedParams}
                    onOpenChange={setShowAdvancedParams}
                  >
                    <ServiceCollapsibleTrigger>
                      Advanced Parameters (Optional)
                      <ChevronDown
                        className={`size-4 transition-transform ${showAdvancedParams ? "rotate-180 transform" : ""}`}
                      />
                    </ServiceCollapsibleTrigger>

                    <ServiceCollapsibleContent>
                      <div className="service-card-content-grid">
                        <form.Field name="min_seq_cov">
                          {(field) => (
                            <FieldItem>
                              <ServiceFieldSubLabel field={field}>
                                Minimum % Coverage
                              </ServiceFieldSubLabel>
                              <ServiceNumberInput
                                id={field.name}
                                name={field.name}
                                value={field.state.value}
                                min={10}
                                max={100}
                                stepper={5}
                                onValueChange={(value) => {
                                  if (value !== undefined)
                                    field.handleChange(value);
                                }}
                              />
                              <FieldErrors field={field} />
                            </FieldItem>
                          )}
                        </form.Field>

                        <form.Field name="max_e_val">
                          {(field) => (
                            <FieldItem>
                              <ServiceSubLabel>BLAST E-Value</ServiceSubLabel>
                              <ServiceInput
                                value={field.state.value}
                                onChange={(e) => {
                                  field.handleChange(e.target.value);
                                }}
                                placeholder="1e-5"
                              />
                              <FieldErrors field={field} />
                            </FieldItem>
                          )}
                        </form.Field>

                        <form.Field name="min_ident">
                          {(field) => (
                            <FieldItem>
                              <ServiceFieldSubLabel field={field}>
                                Minimum % Identity
                              </ServiceFieldSubLabel>
                              <ServiceNumberInput
                                id={field.name}
                                name={field.name}
                                value={field.state.value}
                                min={10}
                                max={100}
                                stepper={5}
                                onValueChange={(value) => {
                                  if (value !== undefined)
                                    field.handleChange(value);
                                }}
                              />
                              <FieldErrors field={field} />
                            </FieldItem>
                          )}
                        </form.Field>
                      </div>
                    </ServiceCollapsibleContent>
                  </ServiceCollapsible>
                </div>
              </ServiceCardContent>
            </Card>

            <Card>
              <ServiceCardHeader>
                <RequiredFormCardTitle>
                  Reference Genome
                  <DialogInfoPopup
                    title={proteomeComparisonReferenceGenome.title}
                    description={proteomeComparisonReferenceGenome.description}
                    sections={proteomeComparisonReferenceGenome.sections}
                  />
                </RequiredFormCardTitle>
                <ServiceCardDescription>
                  Select 1 reference genome from the following options
                </ServiceCardDescription>
              </ServiceCardHeader>

              <ServiceCardContent>
                <div className="space-y-4">
                  <form.Field name="ref_genome_id">
                    {(field) => (
                      <FieldItem>
                        <ServiceLabel>Select a Genome</ServiceLabel>
                        <SingleGenomeSelector
                          placeholder="e.g. Mycobacterium tuberculosis H37Rv"
                          value={field.state.value ?? ""}
                          onChange={(genomeId) => {
                            field.handleChange(genomeId);
                            form.setFieldValue("ref_source_type", "genome");
                            form.setFieldValue("ref_fasta_file", "");
                            form.setFieldValue("ref_feature_group", "");
                          }}
                        />
                        <FieldErrors field={field} />
                      </FieldItem>
                    )}
                  </form.Field>

                  <form.Field name="ref_fasta_file">
                    {(field) => (
                      <FieldItem>
                        <ServiceLabel>Or a Protein FASTA File</ServiceLabel>
                        <WorkspaceObjectSelector
                          preset="featureProteinFasta"
                          placeholder="Select protein FASTA file (Optional)"
                          value={field.state.value}
                          onSelectedObjectChange={(
                            object: WorkspaceObject | null,
                          ) => {
                            if (object?.path) {
                              field.handleChange(object.path);
                              form.setFieldValue("ref_source_type", "fasta");
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

                  <form.Field name="ref_feature_group">
                    {(field) => (
                      <FieldItem>
                        <ServiceLabel>Or a Feature Group</ServiceLabel>
                        <WorkspaceObjectSelector
                          preset="featureGroup"
                          placeholder="Select feature group (Optional)"
                          value={field.state.value}
                          onSelectedObjectChange={(
                            object: WorkspaceObject | null,
                          ) => {
                            if (object?.path) {
                              field.handleChange(object.path);
                              form.setFieldValue(
                                "ref_source_type",
                                "feature_group",
                              );
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
              </ServiceCardContent>
            </Card>
          </div>

          <Card>
            <ServiceCardHeader>
              <RequiredFormCardTitle>
                Comparison Genomes
                <DialogInfoPopup
                  title={proteomeComparisonComparisonGenomes.title}
                  description={proteomeComparisonComparisonGenomes.description}
                  sections={proteomeComparisonComparisonGenomes.sections}
                />
              </RequiredFormCardTitle>
              <ServiceCardDescription>
                Add up to {maxComparisonGenomes} genomes to compare (use plus
                buttons to add)
              </ServiceCardDescription>
            </ServiceCardHeader>

            <ServiceCardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <ServiceLabel>Select Genome</ServiceLabel>
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
                    <ServiceAddButton
                      aria-label="Add genome"
                      onClick={() => {
                        void handleAddCompGenome();
                      }}
                      disabled={
                        !selectedCompGenomeId ||
                        totalGenomeCount >= maxComparisonGenomes
                      }
                      pending={isLoadingCompGenome}
                    />
                  </div>
                  {compGenomeLookupNote ? (
                    <p role="alert" className="text-xs text-muted-foreground">
                      {compGenomeLookupNote}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <ServiceLabel>And/Or Select Protein FASTA File</ServiceLabel>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <WorkspaceObjectSelector
                        preset="featureProteinFasta"
                        placeholder="Select protein FASTA file (Optional)"
                        value={selectedCompFasta?.path}
                        onSelectedObjectChange={(
                          object: WorkspaceObject | null,
                        ) => {
                          setSelectedCompFasta(object);
                        }}
                      />
                    </div>
                    <ServiceAddButton
                      aria-label="Add protein FASTA file"
                      onClick={handleAddCompFasta}
                      disabled={
                        !selectedCompFasta ||
                        totalGenomeCount >= maxComparisonGenomes
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <ServiceLabel>And/Or Select Feature Group</ServiceLabel>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <WorkspaceObjectSelector
                        preset="featureGroup"
                        placeholder="Select feature group (Optional)"
                        value={selectedCompFeatureGroup?.path}
                        onSelectedObjectChange={(
                          object: WorkspaceObject | null,
                        ) => {
                          setSelectedCompFeatureGroup(object);
                        }}
                      />
                    </div>
                    <ServiceAddButton
                      aria-label="Add feature group"
                      onClick={handleAddCompFeatureGroup}
                      disabled={
                        !selectedCompFeatureGroup ||
                        totalGenomeCount >= maxComparisonGenomes
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <ServiceLabel>And/Or Select Genome Group</ServiceLabel>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <WorkspaceObjectSelector
                        preset="genomeGroup"
                        placeholder="Select genome group (Optional)"
                        value={selectedCompGenomeGroup?.path}
                        onSelectedObjectChange={(
                          object: WorkspaceObject | null,
                        ) => {
                          setSelectedCompGenomeGroup(object);
                        }}
                      />
                    </div>
                    <ServiceAddButton
                      aria-label="Add genome group"
                      onClick={() => {
                        void handleAddCompGenomeGroup();
                      }}
                      disabled={
                        !selectedCompGenomeGroup ||
                        totalGenomeCount >= maxComparisonGenomes
                      }
                      pending={isLoadingGenomeGroup}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <SelectedItemsTable
                    title="Selected Genome Table"
                    items={comparisonItems.map((item: ComparisonItem) => ({
                      id: item.id,
                      name: getProteomeComparisonDisplayName(item.name),
                      type: getComparisonItemTypeLabel(item.type),
                      description:
                        item.type === "genome_group" && item.genome_ids
                          ? `${String(item.genome_ids.length)} genome(s)`
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
            </ServiceCardContent>
          </Card>
        </div>

        <ServiceFormFooter
          form={form}
          onReset={handleReset}
          isSubmitting={isSubmitting}
          submitDisabled={!canSubmit || !isOutputNameValid}
          spinnerClassName="mr-2 size-4"
        />
      </form>

      <JobParamsDialog {...jobParamsDialogProps} />
    </section>
  );
}

export default function ProteomeComparisonPage() {
  return useProteomeComparisonPage();
}
