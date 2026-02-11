"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
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
import { WorkspaceObject } from "@/lib/workspace-client";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { GenomeNameSelector } from "@/components/services/genome-name-selector";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import {
  genomeAlignmentAdvancedParamaterOptions,
  genomeAlignmentMauveInfo,
  genomeAlignmentSelectGenomes,
} from "@/lib/services/service-info";
import {
  DEFAULT_GENOME_ALIGNMENT_FORM_VALUES,
  genomeAlignmentFormSchema,
  type GenomeAlignmentFormData,
  transformGenomeAlignmentParams,
} from "@/lib/forms/(genomics)";
import { useServiceFormSubmission } from "@/hooks/services/use-service-form-submission";
import { submitServiceJob } from "@/lib/services/service-utils";
import { JobParamsDialog } from "@/components/services/job-params-dialog";
import {
  fetchGenomeGroupMembers,
  type GenomeSummary,
} from "@/lib/services/genome";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";

const MAX_GENOMES = 20;

export default function GenomeAlignmentServicePage() {
  const form = useForm<GenomeAlignmentFormData>({
    resolver: zodResolver(genomeAlignmentFormSchema),
    defaultValues: DEFAULT_GENOME_ALIGNMENT_FORM_VALUES,
    mode: "onChange",
  });

  const [selectedGenomes, setSelectedGenomes] = useState<GenomeSummary[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOutputNameValid, setIsOutputNameValid] = useState(true);
  const [isFetchingGroup, setIsFetchingGroup] = useState(false);
  const [lastSelectedGroup, setLastSelectedGroup] = useState<string | null>(null);
  const [selectedGenomeGroup, setSelectedGenomeGroup] = useState<WorkspaceObject | null>(null);

  const manualSeedWeight = form.watch("manual_seed_weight");
  const seedWeightValue = form.watch("seed_weight") ?? 15;

  useEffect(() => {
    const genomeIds = selectedGenomes.map((genome) => genome.genome_id);
    form.setValue("genome_ids", genomeIds, { shouldValidate: true });
  }, [selectedGenomes, form]);

  const handleAddGenome = (genome: GenomeSummary) => {
    setSelectedGenomes((previous) => {
      if (previous.length >= MAX_GENOMES) {
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
        const availableSlots = MAX_GENOMES - previous.length;
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

      form.setValue("genome_group_path", object.path);
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

  const handleReset = () => {
    form.reset(DEFAULT_GENOME_ALIGNMENT_FORM_VALUES);
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

  const {
    handleSubmit: submitForm,
    showParamsDialog,
    setShowParamsDialog,
    currentParams,
    serviceName,
  } = useServiceFormSubmission<GenomeAlignmentFormData>({
    serviceName: "Genome Alignment",
    transformParams: transformGenomeAlignmentParams,
    onSubmit: async (data) => {
      const params = transformGenomeAlignmentParams(data);

      try {
        setIsSubmitting(true);
        const result = await submitServiceJob("GenomeAlignment", params);

        if (result.success) {
          const jobId = result.job?.[0]?.id;
          toast.success("Genome Alignment job submitted", {
            description: jobId ? `Job ID: ${jobId}` : undefined,
          });
        } else {
          throw new Error(result.error || "Failed to submit Genome Alignment job");
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to submit Genome Alignment job";
        toast.error("Submission failed", { description: message });
      } finally {
        setIsSubmitting(false);
      }
    },
  });

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

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(submitForm)}
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
                maxSelections={MAX_GENOMES}
                helperText="Use the search to add public or private genomes by name or genome ID."
              />

              <div className="space-y-2">
                <Label className="service-card-label">
                  And/Or Select Genome Group
                </Label>
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <WorkspaceObjectSelector
                      types={["genome_group"]}
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

              <FormField
                control={form.control}
                name="genome_ids"
                render={() => (
                  <FormItem>
                    <FormControl>
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
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="service-card-header">
              <CardTitle className="service-card-title">
                Parameters
                <DialogInfoPopup
                  title={genomeAlignmentAdvancedParamaterOptions.title}
                  description={
                    genomeAlignmentAdvancedParamaterOptions.description
                  }
                  sections={genomeAlignmentAdvancedParamaterOptions.sections}
                />
              </CardTitle>
            </CardHeader>

            <CardContent className="service-card-content space-y-6">
              <FormField
                control={form.control}
                name="output_path"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <OutputFolder
                        required
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
                        required
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
                  <FormField
                    control={form.control}
                    name="manual_seed_weight"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <Label className="service-card-label">
                              Manually Set Seed Weight
                            </Label>
                            <p className="text-muted-foreground text-sm">
                              Enable to specify the seed weight used by progressiveMauve.
                            </p>
                          </div>
                          <FormControl>
                            <Switch
                              id="manual-seed-weight"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {manualSeedWeight && (
                    <FormField
                      control={form.control}
                      name="seed_weight"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between">
                            <Label className="service-card-label">
                              Seed Weight
                            </Label>
                            <span className="text-muted-foreground text-sm">
                              {field.value ?? seedWeightValue}
                            </span>
                          </div>
                          <FormControl>
                            <Slider
                              value={[field.value ?? seedWeightValue]}
                              onValueChange={(value) => field.onChange(value[0])}
                              min={3}
                              max={21}
                              step={1}
                            />
                          </FormControl>
                          <div className="text-muted-foreground flex justify-between text-xs">
                            <span>3</span>
                            <span>21</span>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="weight"
                    render={({ field }) => (
                      <FormItem>
                        <Label className="service-card-label">Weight</Label>
                        <FormControl>
                          <NumberInput
                            value={field.value}
                            onValueChange={field.onChange}
                            min={0}
                            max={1000000}
                            placeholder="Min pairwise LCB score"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
      </Form>

      <JobParamsDialog
        open={showParamsDialog}
        onOpenChange={setShowParamsDialog}
        params={currentParams}
        serviceName={serviceName}
      />
    </section>
  );
}
