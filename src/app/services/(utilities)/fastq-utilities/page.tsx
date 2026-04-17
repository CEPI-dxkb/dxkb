"use client";

import { useState } from "react";
import { useForm, useStore } from "@tanstack/react-form";
import { FieldItem, FieldErrors } from "@/components/ui/tanstack-form";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChevronRight, HelpCircle, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { ServiceHeader } from "@/components/services/service-header";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import SraRunAccessionWithValidation from "@/components/services/sra-run-accession-with-validation";
import SelectedItemsTable from "@/components/services/selected-items-table";
import OutputFolder from "@/components/services/output-folder";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import { SingleGenomeSelector } from "@/components/services/single-genome-selector";
import { JobParamsDialog } from "@/components/services/job-params-dialog";
import { Spinner } from "@/components/ui/spinner";

import { useServiceRuntime } from "@/hooks/services/use-service-runtime";
import {
  fastqUtilitiesInfo,
  fastqUtilitiesParameters,
  fastqUtilitiesPipeline,
  readInputFileInfo,
} from "@/lib/services/info/fastq-utilities";

import {
  fastqUtilitiesFormSchema,
  defaultFastqUtilitiesFormValues,
  pipelineActionOptions,
  platformOptions,
  maxPipelineActions,
  type FastqUtilitiesFormData,
  type LibraryItem,
  type PipelineActionItem,
  type PipelineAction,
  type Platform,
} from "@/lib/forms/(utilities)/fastq-utilities/fastq-utilities-form-schema";
import {
  isAlignSelected,
  createPipelineActionItem,
  removePipelineActionItem,
  actionItemsToRecipe,
} from "@/lib/forms/(utilities)/fastq-utilities/fastq-utilities-form-utils";
import { fastqUtilitiesService } from "@/lib/forms/(utilities)/fastq-utilities/fastq-utilities-service";
import {
  buildBaseLibraryItem,
  getPairedLibraryName,
  getSingleLibraryName,
  useTanstackLibrarySelection,
} from "@/lib/forms/tanstack-library-selection";
import { getLibraryTypeLabel } from "@/lib/forms/shared-schemas";

import type { WorkspaceObject } from "@/lib/services/workspace/types";

export default function FastqUtilitiesPage() {
  // Read input state
  const [pairedRead1, setPairedRead1] = useState<string | null>(null);
  const [pairedRead2, setPairedRead2] = useState<string | null>(null);
  const [singleRead, setSingleRead] = useState<string | null>(null);
  const [singlePlatform, setSinglePlatform] = useState<Platform>("illumina");
  const [sraResetKey, setSraResetKey] = useState(0);

  // Pipeline state
  const [selectedAction, setSelectedAction] = useState<PipelineAction | "">("");
  const [pipelineActions, setPipelineActions] = useState<PipelineActionItem[]>([]);

  // Output name uniqueness (variant="name"); valid until check says otherwise
  const [isOutputNameValid, setIsOutputNameValid] = useState(true);

  const handleReset = () => {
    form.reset(defaultFastqUtilitiesFormValues as FastqUtilitiesFormData);
    setLibrariesAndSync([]);
    setPairedRead1(null);
    setPairedRead2(null);
    setSingleRead(null);
    setSinglePlatform("illumina");
    setPipelineActions([]);
    setSelectedAction("");
    setSraResetKey((k) => k + 1);
  };

  const form = useForm({
    defaultValues: defaultFastqUtilitiesFormValues as FastqUtilitiesFormData,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validators: { onChange: fastqUtilitiesFormSchema as any },
    onSubmit: async ({ value }) => {
      await runtime.submitFormData(value as FastqUtilitiesFormData);
    },
  });

  const outputPath = useStore(form.store, (s) => s.values.output_path);
  const recipe = useStore(form.store, (s) => s.values.recipe);
  const canSubmit = useStore(form.store, (s) => s.canSubmit);

  // Check if align is selected (to show/require target genome)
  const alignSelected = isAlignSelected(recipe);

  const {
    selectedLibraries,
    addPairedLibrary,
    addSingleLibrary,
    removeLibrary,
    setLibrariesAndSync,
    syncLibrariesToForm,
  } = useTanstackLibrarySelection<LibraryItem>({
    form,
    mapLibraryToItem: (library) => ({
      ...buildBaseLibraryItem(library),
      ...(library.type === "single" && { platform: (library.platform as Platform) ?? "illumina" }),
    }),
    fields: {
      paired: "paired_end_libs",
      single: "single_end_libs",
      srr: "srr_ids",
    },
  });

  const runtime = useServiceRuntime({
    definition: fastqUtilitiesService,
    form,
    onSuccess: handleReset,
    rerun: {
      libraries: ["paired", "single", "sra"],
      getLibraryExtra: (lib, kind) => {
        if (kind === "single") {
          return { platform: lib.platform };
        }
        return {};
      },
      syncLibraries: (libs) => {
        syncLibrariesToForm(libs);
        setLibrariesAndSync(libs);
      },
      onApply: (rerunData, form) => {
        // Backend rerun params may serialize a single action as a string and use Title Case.
        const rawRecipe = rerunData.recipe;
        const recipeArray: PipelineAction[] = (
          Array.isArray(rawRecipe)
            ? (rawRecipe as string[])
            : typeof rawRecipe === "string"
              ? [rawRecipe]
              : []
        ).map((a) => a.toLowerCase() as PipelineAction);

        if (recipeArray.length > 0) {
          const actions = recipeArray.map((action, i) =>
            createPipelineActionItem(action, i),
          );
          setPipelineActions(actions);
          form.setFieldValue("recipe", actionItemsToRecipe(actions) as never);
        }
      },
    },
  });
  const { isSubmitting, jobParamsDialogProps } = runtime;

  const handleLibraryError = (message: string) => {
    if (
      message === "This paired library has already been added" ||
      message === "This single library has already been added"
    ) {
      toast.error("Duplicate library", { description: message });
      return;
    }
    toast.error(message);
  };

  const handlePairedLibraryAdd = () => {
    addPairedLibrary({
      read1: pairedRead1,
      read2: pairedRead2,
      buildLibrary: (read1, read2, id) => ({
        library: {
          id,
          name: getPairedLibraryName(read1, read2),
          type: "paired",
          files: [read1, read2],
        },
      }),
      onError: handleLibraryError,
      onAfterAdd: () => {
        setPairedRead1(null);
        setPairedRead2(null);
      },
    });
  };

  const handleSingleLibraryAdd = () => {
    addSingleLibrary({
      read: singleRead,
      buildLibrary: (read) => {
        if (!singlePlatform) {
          return { error: "Platform must be selected for single read library" };
        }
        return {
          library: {
            id: read,
            name: getSingleLibraryName(read),
            type: "single",
            files: [read],
            platform: singlePlatform,
          },
        };
      },
      duplicateMatcher: (library, read) => library.id === read && library.type === "single",
      onError: handleLibraryError,
      onAfterAdd: () => {
        setSingleRead(null);
      },
    });
  };

  // Handle adding pipeline action
  const handleAddPipelineAction = () => {
    if (!selectedAction) {
      toast.error("Please select an action first");
      return;
    }

    if (pipelineActions.length >= maxPipelineActions) {
      toast.error("Maximum actions reached", {
        description: `You can add up to ${maxPipelineActions} pipeline actions`,
      });
      return;
    }

    const newActionItem = createPipelineActionItem(selectedAction, pipelineActions.length);
    const newActions = [...pipelineActions, newActionItem];
    setPipelineActions(newActions);
    form.setFieldValue("recipe", actionItemsToRecipe(newActions));
    setSelectedAction("");
  };

  // Handle removing pipeline action
  const handleRemovePipelineAction = (id: string) => {
    const removedAction = pipelineActions.find((a) => a.id === id);
    const newActions = removePipelineActionItem(pipelineActions, id);
    setPipelineActions(newActions);
    form.setFieldValue("recipe", actionItemsToRecipe(newActions));

    // Clear target genome if align is removed
    if (removedAction?.action === "align" && !newActions.some((a) => a.action === "align")) {
      form.setFieldValue("reference_genome_id", "");
    }
  };

  return (
    <section>
      <ServiceHeader
        title="FastQ Utilities"
        description="The FastQ Utilities Service provides capability for aligning, measuring base call quality, and trimming FastQ read files."
        infoPopupTitle={fastqUtilitiesInfo.title}
        infoPopupDescription={fastqUtilitiesInfo.description}
        quickReferenceGuide="https://www.bv-brc.org/docs/quick_references/services/fastq_utilities_service.html"
        tutorial="https://www.bv-brc.org/docs/tutorial/fastq_utilities/fastq_utilities.html"
        instructionalVideo="https://youtube.com/playlist?list=PLWfOyhOW_Oas1LLS2wRlWzilruoSxVeJw"
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="grid grid-cols-1 gap-6 md:grid-cols-12"
      >
        {/* Parameters Section */}
        <div className="md:col-span-7">
          <Card className="h-full">
            <CardHeader className="service-card-header">
              <RequiredFormCardTitle className="service-card-title">
                Parameters
                <DialogInfoPopup
                  title={fastqUtilitiesParameters.title}
                  sections={fastqUtilitiesParameters.sections}
                />
              </RequiredFormCardTitle>
            </CardHeader>

            <CardContent className="service-card-content">
              <form.Field name="output_path">
                {(field) => (
                  <FieldItem className="w-full">
                    <OutputFolder
                      value={field.state.value}
                      onChange={(value) => field.handleChange(value)}
                    />
                    <FieldErrors field={field} />
                  </FieldItem>
                )}
              </form.Field>
              <form.Field name="output_file">
                {(field) => (
                  <FieldItem className="w-full">
                    <OutputFolder
                      variant="name"
                      value={field.state.value}
                      onChange={(value) => field.handleChange(value)}
                      outputFolderPath={outputPath}
                      onValidationChange={setIsOutputNameValid}
                    />
                    <FieldErrors field={field} />
                  </FieldItem>
                )}
              </form.Field>
            </CardContent>
          </Card>
        </div>

        {/* Pipeline Section */}
        <div className="md:col-span-5">
          <Card className="h-full">
            <CardHeader className="service-card-header">
              <RequiredFormCardTitle className="service-card-title">
                Pipeline
                <DialogInfoPopup
                  title={fastqUtilitiesPipeline.title}
                  sections={fastqUtilitiesPipeline.sections}
                />
              </RequiredFormCardTitle>
            </CardHeader>

            <CardContent className="service-card-content">
              <div>
                <Label className="service-card-label">Select Action</Label>
                <div className="flex items-center gap-2">
                  <Select
                    items={pipelineActionOptions}
                    value={selectedAction}
                    onValueChange={(value) => value != null && setSelectedAction(value as PipelineAction)}
                  >
                    <SelectTrigger className="service-card-select-trigger">
                      <SelectValue placeholder="Select Action" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                      {pipelineActionOptions.map((action) => (
                        <SelectItem key={action.value} value={action.value}>
                          {action.label}
                        </SelectItem>
                      ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleAddPipelineAction}
                    disabled={!selectedAction || pipelineActions.length >= maxPipelineActions}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Pipeline Actions List */}
              <div className="mt-4 space-y-2">
                {pipelineActions.length === 0 ? (
                  <p className="text-muted-foreground text-center text-sm py-4">
                    No actions added yet
                  </p>
                ) : (
                  pipelineActions.map((action) => (
                    <div
                      key={action.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-3 w-3 rounded-full ${action.color}`}
                        />
                        <span className="text-sm">{action.label}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleRemovePipelineAction(action.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))
                )}
              </div>

              <form.Field name="recipe">
                {(field) => (
                  <FieldItem>
                    <FieldErrors field={field} />
                  </FieldItem>
                )}
              </form.Field>

              {/* Target Genome (enabled only when Align is selected) */}
              <div className="pt-4">
                <form.Field name="reference_genome_id">
                  {(field) => (
                    <FieldItem>
                      <SingleGenomeSelector
                        title="Target Genome"
                        placeholder="e.g. Mycobacterium tuberculosis H37Rv"
                        value={field.state.value || ""}
                        onChange={field.handleChange}
                        disabled={!alignSelected}
                        helperText={
                          alignSelected
                            ? undefined
                            : "Add the Align action to enable genome selection."
                        }
                      />
                      <FieldErrors field={field} />
                    </FieldItem>
                  )}
                </form.Field>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Input Library Section */}
        <div className="md:col-span-7">
          <Card>
            <CardHeader className="service-card-header">
              <RequiredFormCardTitle className="service-card-title">
                Input Library
                <DialogInfoPopup
                  title={readInputFileInfo.title}
                  description={readInputFileInfo.description}
                  sections={readInputFileInfo.sections}
                />
              </RequiredFormCardTitle>
            </CardHeader>

            <CardContent className="service-card-content space-y-6">
              {/* Paired Read Library */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="service-card-label">
                    Paired Read Library
                  </Label>
                  <div className="bg-border mx-4 h-px flex-1" />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handlePairedLibraryAdd}
                    disabled={!pairedRead1 || !pairedRead2}
                  >
                    <ChevronRight size={16} />
                  </Button>
                </div>
                <div className="space-y-3">
                  <WorkspaceObjectSelector
                    preset="reads"
                    placeholder="Select READ FILE 1..."
                    value={pairedRead1 ?? ""}
                    onObjectSelect={(object: WorkspaceObject) => {
                      setPairedRead1(object.path);
                    }}
                  />
                  <WorkspaceObjectSelector
                    preset="reads"
                    placeholder="Select READ FILE 2..."
                    value={pairedRead2 ?? ""}
                    onObjectSelect={(object: WorkspaceObject) => {
                      setPairedRead2(object.path);
                    }}
                  />
                </div>
              </div>

              {/* Single Read Library */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="service-card-label">
                    Single Read Library
                  </Label>
                  <div className="bg-border mx-4 h-px flex-1" />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleSingleLibraryAdd}
                    disabled={!singleRead || !singlePlatform}
                  >
                    <ChevronRight size={16} />
                  </Button>
                </div>
                <div>
                  <Label className="service-card-sublabel">Platform</Label>
                  <Select
                    items={platformOptions}
                    value={singlePlatform}
                    onValueChange={(value) => value != null && setSinglePlatform(value as Platform)}
                  >
                    <SelectTrigger className="service-card-select-trigger">
                      <SelectValue placeholder="Select a Platform..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {platformOptions.map((platform) => (
                          <SelectItem key={platform.value} value={platform.value}>
                            {platform.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <WorkspaceObjectSelector
                  preset="reads"
                  placeholder="Select READ FILE..."
                  value={singleRead ?? ""}
                  onObjectSelect={(object: WorkspaceObject) => {
                    setSingleRead(object.path);
                  }}
                />
              </div>

              {/* SRA Run Accession */}
              <SraRunAccessionWithValidation
                key={sraResetKey}
                title="SRA Run Accession"
                placeholder="SRR..."
                selectedLibraries={selectedLibraries}
                setSelectedLibraries={setLibrariesAndSync}
                allowDuplicates={false}
              />

              <form.Field name="paired_end_libs">
                {(field) => (
                  <FieldItem>
                    <FieldErrors field={field} />
                  </FieldItem>
                )}
              </form.Field>
            </CardContent>
          </Card>
        </div>

        {/* Selected Libraries Section */}
        <div className="md:col-span-5">
          <Card className="h-full">
            <CardHeader className="service-card-header">
              <CardTitle className="service-card-title">
                Selected Libraries
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="service-card-tooltip-icon" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Place read files here using the arrow buttons</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
              <CardDescription className="text-xs">
                Place read files here using the arrow buttons.
              </CardDescription>
            </CardHeader>

            <CardContent className="service-card-content">
              <SelectedItemsTable
                items={selectedLibraries.map((library) => ({
                  id: library.id,
                  name: library.name,
                  type: getLibraryTypeLabel(library.type),
                }))}
                onRemove={removeLibrary}
                className="max-h-80 overflow-y-auto"
              />
            </CardContent>
          </Card>
        </div>

        {/* Form Controls */}
        <div className="md:col-span-12">
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
        </div>
      </form>

      <JobParamsDialog {...jobParamsDialogProps} />
    </section>
  );
}
