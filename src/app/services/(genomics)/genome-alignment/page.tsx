"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, useStore } from "@tanstack/react-form";
import { FieldItem, FieldErrors } from "@/components/ui/tanstack-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Plus } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { ServiceHeader } from "@/components/services/service-header";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import SelectedItemsTable from "@/components/services/selected-items-table";
import OutputFolder from "@/components/services/output-folder";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import { WorkspaceObject } from "@/lib/services/workspace/types";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { GenomeNameSelector } from "@/components/services/genome-name-selector";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import {
  genomeAlignmentAdvancedParameterOptions,
  genomeAlignmentMauveInfo,
  genomeAlignmentSelectGenomes,
} from "@/lib/services/info/genome-alignment";
import {
  defaultGenomeAlignmentFormValues,
  genomeAlignmentFormSchema,
  type GenomeAlignmentFormData,
} from "@/lib/forms/(genomics)/genome-alignment/genome-alignment-form-schema";
import { genomeAlignmentService } from "@/lib/forms/(genomics)/genome-alignment/genome-alignment-service";
import { useServiceRuntime } from "@/hooks/services/use-service-runtime";
import { rerunBooleanValue } from "@/lib/rerun-utility";
import { JobParamsDialog } from "@/components/services/job-params-dialog";
import {
  fetchGenomeGroupMembers,
  fetchGenomesByIds,
  type GenomeSummary,
} from "@/lib/services/genome";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";

const maxGenomes = 20;

export default function GenomeAlignmentServicePage() {
  const [selectedGenomes, setSelectedGenomes] = useState<GenomeSummary[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isOutputNameValid, setIsOutputNameValid] = useState(true);
  const [isFetchingGroup, setIsFetchingGroup] = useState(false);
  const [lastSelectedGroup, setLastSelectedGroup] = useState<string | null>(null);
  const [selectedGenomeGroup, setSelectedGenomeGroup] = useState<WorkspaceObject | null>(null);

  const form = useForm({
    defaultValues: defaultGenomeAlignmentFormValues,
    validators: { onChange: genomeAlignmentFormSchema },
    onSubmit: async ({ value }) => {
      await runtime.submitFormData(value as GenomeAlignmentFormData);
    },
  });

  const manualSeedWeight = useStore(form.store, (s) => s.values.manual_seed_weight);
  const seedWeightValue = useStore(form.store, (s) => s.values.seed_weight) ?? 15;
  const outputPath = useStore(form.store, (s) => s.values.output_path);

  useEffect(() => {
    const genomeIds = selectedGenomes.map((genome) => genome.genome_id);
    form.setFieldValue("genome_ids", genomeIds);
  }, [selectedGenomes, form]);

  const handleAddGenome = (genome: GenomeSummary) => {
    setSelectedGenomes((previous) => {
      if (previous.length >= maxGenomes) {
        toast.error("You can add up to 20 genomes");
        return previous;
      }

      if (previous.some((item) => item.genome_id === genome.genome_id)) {
        toast.error("Genome already added", {
          description: `${genome.genome_name} (${genome.genome_id}) is already in the selection`,
        });
        return previous;
      }

      toast.success(`Added ${genome.genome_name}`);
      return [...previous, genome];
    });
  };

  const handleRemoveGenome = (genomeId: string) => {
    setSelectedGenomes((previous) =>
      previous.filter((genome) => genome.genome_id !== genomeId),
    );
  };

  const handleGenomeGroupSelect = async (object: WorkspaceObject) => {
    if (!object?.path) {
      toast.error("Invalid genome group selection");
      return;
    }

    setIsFetchingGroup(true);

    try {
      const genomes = await fetchGenomeGroupMembers(object.path);

      if (!genomes.length) {
        toast.error("Selected genome group is empty");
        return;
      }

      setSelectedGenomes((previous) => {
        const existingIds = new Set(previous.map((item) => item.genome_id));
        const availableSlots = maxGenomes - previous.length;
        const uniqueNewGenomes = genomes.filter(
          (genome) => !existingIds.has(genome.genome_id),
        );

        if (!uniqueNewGenomes.length) {
          toast.info("All genomes in this group are already selected");
          return previous;
        }

        if (availableSlots <= 0) {
          toast.error("Genome selection limit reached (20 genomes)");
          return previous;
        }

        const genomesToAdd = uniqueNewGenomes.slice(0, availableSlots);

        if (uniqueNewGenomes.length > genomesToAdd.length) {
          toast.warning(
            "Some genomes were not added because the selection limit is 20",
          );
        }

        toast.success(
          `Added ${genomesToAdd.length} genome${
            genomesToAdd.length === 1 ? "" : "s"
          } from ${object.name ?? "genome group"}`,
        );

        return [...previous, ...genomesToAdd];
      });

      form.setFieldValue("genome_group_path", object.path);
      setLastSelectedGroup(object.name || object.path);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to load genome group";
      toast.error(message);
    } finally {
      setIsFetchingGroup(false);
    }
  };

  const runtime = useServiceRuntime({
    definition: genomeAlignmentService,
    form,
    rerun: {
      onApply: (rerunData, form) => {
        if (rerunData.manual_seed_weight != null) {
          form.setFieldValue(
            "manual_seed_weight",
            rerunBooleanValue(rerunData.manual_seed_weight) as never,
          );
        }
        if (rerunData.seed_weight != null) {
          form.setFieldValue("seed_weight", rerunData.seed_weight as never);
        }
        if (rerunData.weight != null) {
          form.setFieldValue("weight", rerunData.weight as never);
        }

        const genomeIds = Array.isArray(rerunData.genome_ids)
          ? (rerunData.genome_ids as string[])
          : [];
        if (genomeIds.length > 0) {
          fetchGenomesByIds(genomeIds)
            .then((genomes) => setSelectedGenomes(genomes))
            .catch(() => {
              toast.error("Could not restore genomes from previous job", {
                description: "Please re-add your genomes manually.",
              });
            });
        }
      },
    },
  });
  const { isSubmitting, jobParamsDialogProps } = runtime;

  const handleReset = () => {
    form.reset(defaultGenomeAlignmentFormValues);
    setSelectedGenomes([]);
    setShowAdvanced(false);
    setLastSelectedGroup(null);
  };

  const selectedItems = useMemo(
    () =>
      selectedGenomes.map((genome, index) => ({
        id: genome.genome_id,
        name: genome.genome_name,
        description: genome.genome_id,
        type: index === 0 ? "Reference Genome" : "Genome",
      })),
    [selectedGenomes],
  );

  const hasMinimumGenomes = selectedGenomes.length >= 2;

  return (
    <section>
      <ServiceHeader
        title="Genome Alignment (Mauve)"
        description={
          <>
            The Genome Alignment service aligns genomes using{" "}
            <a
              href="https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0011147"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80"
            >
              progressiveMauve
            </a>
            .
          </>
        }
        infoPopupTitle={genomeAlignmentMauveInfo.title}
        infoPopupDescription={genomeAlignmentMauveInfo.description}
        quickReferenceGuide="#"
        tutorial="#"
        instructionalVideo="#"
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="service-form-section"
      >
        <Card>
          <CardHeader className="service-card-header">
            <RequiredFormCardTitle className="service-card-title">
              Select Genomes
              <DialogInfoPopup
                title={genomeAlignmentSelectGenomes.title}
                description={genomeAlignmentSelectGenomes.description}
                sections={genomeAlignmentSelectGenomes.sections}
              />
            </RequiredFormCardTitle>
            <CardDescription>
              Add at least 2 and up to 20 genomes. The first genome selected
              becomes the reference (anchor) genome in the alignment.
            </CardDescription>
          </CardHeader>

          <CardContent className="service-card-content space-y-6">
            <GenomeNameSelector
              onSelect={handleAddGenome}
              selectedGenomeIds={selectedGenomes.map((genome) => genome.genome_id)}
              maxSelections={maxGenomes}
              helperText="Use the search to add public or private genomes by name or genome ID."
            />

            <div className="space-y-2">
              <Label className="service-card-label">
                And/Or Select Genome Group
              </Label>
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <WorkspaceObjectSelector
                    preset="genomeGroup"
                    placeholder="Select a genome group from your workspace"
                    onObjectSelect={handleGenomeGroupSelect}
                    onSelectedObjectChange={setSelectedGenomeGroup}
                  />
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  disabled={!selectedGenomeGroup}
                  onClick={() => {
                    if (selectedGenomeGroup) {
                      handleGenomeGroupSelect(selectedGenomeGroup);
                      setSelectedGenomeGroup(null);
                    }
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {isFetchingGroup && (
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                  <Spinner className="h-3 w-3" />
                  Loading genomes from workspace group...
                </div>
              )}
              {lastSelectedGroup && !isFetchingGroup && (
                <p className="text-muted-foreground text-xs">
                  Last group added: {lastSelectedGroup}
                </p>
              )}
            </div>

            <form.Field name="genome_ids">
              {(field) => (
                <FieldItem>
                  <div>
                    <SelectedItemsTable
                      title="Selected Genomes"
                      description="Remove genomes as needed. The first entry is treated as the reference genome."
                      items={selectedItems}
                      onRemove={handleRemoveGenome}
                      emptyMessage="No genomes selected"
                      className="max-h-84 overflow-y-auto"
                    />
                    {!hasMinimumGenomes && (
                      <p className="text-muted-foreground mt-2 text-xs">
                        Select at least two genomes to enable submission.
                      </p>
                    )}
                  </div>
                  <FieldErrors field={field} />
                </FieldItem>
              )}
            </form.Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="service-card-header">
            <CardTitle className="service-card-title">
              Parameters
              <DialogInfoPopup
                title={genomeAlignmentAdvancedParameterOptions.title}
                description={
                  genomeAlignmentAdvancedParameterOptions.description
                }
                sections={genomeAlignmentAdvancedParameterOptions.sections}
              />
            </CardTitle>
          </CardHeader>

          <CardContent className="service-card-content space-y-6">
            <form.Field name="output_path">
              {(field) => (
                <FieldItem>
                  <OutputFolder
                    required
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
                    required
                    value={field.state.value}
                    onChange={field.handleChange}
                    outputFolderPath={outputPath}
                    onValidationChange={setIsOutputNameValid}
                  />
                  <FieldErrors field={field} />
                </FieldItem>
              )}
            </form.Field>

            <Collapsible
              open={showAdvanced}
              onOpenChange={setShowAdvanced}
              className="service-collapsible-container"
            >
              <CollapsibleTrigger className="service-collapsible-trigger">
                Advanced Options
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-180 transform" : ""}`}
                />
              </CollapsibleTrigger>

              <CollapsibleContent className="service-collapsible-content space-y-6">
                <form.Field name="manual_seed_weight">
                  {(field) => (
                    <FieldItem>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <Label className="service-card-label">
                            Manually Set Seed Weight
                          </Label>
                          <p className="text-muted-foreground text-sm">
                            Enable to specify the seed weight used by progressiveMauve.
                          </p>
                        </div>
                        <Switch
                          id="manual-seed-weight"
                          checked={field.state.value}
                          onCheckedChange={(checked) =>
                            field.handleChange(checked)
                          }
                        />
                      </div>
                      <FieldErrors field={field} />
                    </FieldItem>
                  )}
                </form.Field>

                {manualSeedWeight && (
                  <form.Field name="seed_weight">
                    {(field) => (
                      <FieldItem>
                        <div className="flex items-center justify-between">
                          <Label className="service-card-label">
                            Seed Weight
                          </Label>
                          <span className="text-muted-foreground text-sm">
                            {field.state.value ?? seedWeightValue}
                          </span>
                        </div>
                        <Slider
                          aria-label="Seed weight"
                          value={[field.state.value ?? seedWeightValue]}
                          min={3}
                          max={21}
                          step={1}
                          onValueChange={(value) =>
                            field.handleChange(
                              Array.isArray(value) ? value[0] : value,
                            )
                          }
                        />
                        <div className="text-muted-foreground flex justify-between text-xs">
                          <span>3</span>
                          <span>21</span>
                        </div>
                        <FieldErrors field={field} />
                      </FieldItem>
                    )}
                  </form.Field>
                )}

                <form.Field name="weight">
                  {(field) => (
                    <FieldItem>
                      <Label className="service-card-label">Weight</Label>
                      <NumberInput
                        value={field.state.value}
                        onValueChange={field.handleChange}
                        min={0}
                        max={1000000}
                        placeholder="Min pairwise LCB score"
                      />
                      <FieldErrors field={field} />
                    </FieldItem>
                  )}
                </form.Field>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>

        <div className="service-form-controls">
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            className="service-form-controls-button"
            disabled={isSubmitting}
          >
            Reset
          </Button>
          <Button type="submit" disabled={isSubmitting || !hasMinimumGenomes || !isOutputNameValid}>
            {isSubmitting ? <Spinner className="mr-2 h-4 w-4" /> : null}
            Submit
          </Button>
        </div>
      </form>

      <JobParamsDialog {...jobParamsDialogProps} />
    </section>
  );
}
