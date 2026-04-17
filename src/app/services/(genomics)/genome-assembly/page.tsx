"use client";

import { useState } from "react";
import { useForm, useStore } from "@tanstack/react-form";
import { FieldItem, FieldLabel, FieldErrors } from "@/components/ui/tanstack-form";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle, ChevronDown } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  genomeAssemblyInfo,
  genomeAssemblyParameters,
  readInputFileInfo,
} from "@/lib/services/info/genome-assembly";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import SraRunAccessionWithValidation from "@/components/services/sra-run-accession-with-validation";
import SelectedItemsTable from "@/components/services/selected-items-table";
import OutputFolder from "@/components/services/output-folder";
import { Library } from "@/types/services";
import { NumberInput } from "@/components/ui/number-input";
import { JobParamsDialog } from "@/components/services/job-params-dialog";
import { useServiceRuntime } from "@/hooks/services/use-service-runtime";
import { toast } from "sonner";
import {
  genomeAssemblyFormSchema,
  defaultGenomeAssemblyFormValues,
  type GenomeAssemblyFormData,
  type LibraryItem,
} from "@/lib/forms/(genomics)/genome-assembly/genome-assembly-form-schema";
import {
  calculateGenomeSize,
  genomeAssemblyRecipes,
  genomeSizeUnitOptions,
} from "@/lib/forms/(genomics)/genome-assembly/genome-assembly-form-utils";
import { genomeAssemblyService } from "@/lib/forms/(genomics)/genome-assembly/genome-assembly-service";
import {
  RequiredFormCardTitle,
  RequiredFormLabel,
} from "@/components/forms/required-form-components";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import { WorkspaceObject } from "@/lib/workspace-client";
import { ChevronRight } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import {
  buildBaseLibraryItem,
  getPairedLibraryName,
  getSingleLibraryName,
  useTanstackLibrarySelection,
} from "@/lib/forms/tanstack-library-selection";

function mapAssemblyLibraryToItem(library: Library): LibraryItem {
  if (library.type === "paired") {
    return {
      ...buildBaseLibraryItem(library),
      platform: library.platform || "infer",
      interleaved: library.interleaved || false,
      read_orientation_outward: library.read_orientation_outward || false,
    };
  }
  if (library.type === "single") {
    return {
      ...buildBaseLibraryItem(library),
      platform: library.platform || "infer",
    };
  }
  return buildBaseLibraryItem(library);
}

export default function GenomeAssemblyPage() {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [genomeSizeUnit, setGenomeSizeUnit] = useState<"M" | "K">("M");
  const [expectedGenomeSize, setExpectedGenomeSize] = useState(5);
  const [pairedRead1, setPairedRead1] = useState<string | null>(null);
  const [pairedRead2, setPairedRead2] = useState<string | null>(null);
  const [singleRead, setSingleRead] = useState<string | null>(null);
  const [isOutputNameValid, setIsOutputNameValid] = useState(true);
  const [sraResetKey, setSraResetKey] = useState(0);

  const form = useForm({
    defaultValues: defaultGenomeAssemblyFormValues as GenomeAssemblyFormData,
    validators: { onChange: genomeAssemblyFormSchema },
    onSubmit: async ({ value }) => {
      const data = value as GenomeAssemblyFormData;

      const hasPaired = data.paired_end_libs && data.paired_end_libs.length > 0;
      const hasSingle = data.single_end_libs && data.single_end_libs.length > 0;
      const hasSrr = data.srr_ids && data.srr_ids.length > 0;

      if (!hasPaired && !hasSingle && !hasSrr) {
        toast.error("At least one library must be selected");
        return;
      }

      await runtime.submitFormData(data);
    },
  });

  const {
    selectedLibraries,
    addPairedLibrary,
    addSingleLibrary,
    removeLibrary,
    setLibrariesAndSync,
  } = useTanstackLibrarySelection<LibraryItem>({
    form,
    mapLibraryToItem: mapAssemblyLibraryToItem,
    fields: {
      paired: "paired_end_libs",
      single: "single_end_libs",
      srr: "srr_ids",
    },
  });

  const runtime = useServiceRuntime({
    definition: genomeAssemblyService,
    form,
    onSuccess: handleReset,
    rerun: {
      libraries: ["paired", "single", "sra"],
      getLibraryExtra: (lib, kind) => {
        if (kind === "paired") {
          return {
            platform: lib.platform || "infer",
            interleaved: !!lib.interleaved,
            read_orientation_outward: !!lib.read_orientation_outward,
          };
        }
        if (kind === "single") {
          return { platform: lib.platform || "infer" };
        }
        return {};
      },
      syncLibraries: setLibrariesAndSync,
    },
  });

  function handleReset() {
    form.reset(defaultGenomeAssemblyFormValues);
    setLibrariesAndSync([]);
    setShowAdvanced(false);
    setGenomeSizeUnit("M");
    setExpectedGenomeSize(5);
    setPairedRead1(null);
    setPairedRead2(null);
    setSingleRead(null);
    setSraResetKey((k) => k + 1);
  }

  const recipe = useStore(form.store, (s) => s.values.recipe);
  const showGenomeSizeField = recipe === "canu";

  const outputPath = useStore(form.store, (s) => s.values.output_path);
  const canSubmit = useStore(form.store, (s) => s.canSubmit);

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
          platform: "infer",
          interleaved: false,
          read_orientation_outward: false,
        },
      }),
      onError: toast.error,
      onAfterAdd: () => {
        setPairedRead1(null);
        setPairedRead2(null);
      },
    });
  };

  const handleSingleLibraryAdd = () => {
    addSingleLibrary({
      read: singleRead,
      buildLibrary: (read) => ({
        library: {
          id: read,
          name: getSingleLibraryName(read),
          type: "single",
          files: [read],
          platform: "infer",
        },
      }),
      onError: toast.error,
      onAfterAdd: () => {
        setSingleRead(null);
      },
    });
  };

  return (
    <section>
      <ServiceHeader
        title="Genome Assembly"
        description="The Genome Assembly Service allows single or multiple assemblers to be invoked to compare results. The service attempts to select the best assembly."
        infoPopupTitle={genomeAssemblyInfo.title}
        infoPopupDescription={genomeAssemblyInfo.description}
        quickReferenceGuide="#"
        tutorial="#"
        instructionalVideo="#"
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="grid grid-cols-1 gap-6 md:grid-cols-12"
      >
        {/* Left Column */}
        <div className="space-y-6 md:col-span-7">
          {/* Input Files Card */}
          <Card>
            <CardHeader className="service-card-header">
              <RequiredFormCardTitle className="service-card-title">
                Input Files
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
                  <Label className="service-card-label">Paired Read Library</Label>
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
                  <div>
                    <WorkspaceObjectSelector
                      types={["reads"]}
                      placeholder="Select READ FILE 1..."
                      onObjectSelect={(object: WorkspaceObject) => {
                        setPairedRead1(object.path);
                      }}
                    />
                  </div>
                  <WorkspaceObjectSelector
                    types={["reads"]}
                    placeholder="Select READ FILE 2..."
                    onObjectSelect={(object: WorkspaceObject) => {
                      setPairedRead2(object.path);
                    }}
                  />
                </div>
              </div>

              {/* Single Read Library */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="service-card-label">Single Read Library</Label>
                  <div className="bg-border mx-4 h-px flex-1" />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleSingleLibraryAdd}
                    disabled={!singleRead}
                  >
                    <ChevronRight size={16} />
                  </Button>
                </div>
                <WorkspaceObjectSelector
                  types={["reads"]}
                  placeholder="Select READ FILE..."
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
            </CardContent>
          </Card>
          {/* Selected Libraries (mobile) */}
          <div className="md:hidden">
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
                        <p>
                          Read files placed here will contribute to a single
                          analysis.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardTitle>
                <CardDescription>
                  Place read files here using the arrow buttons.
                </CardDescription>
              </CardHeader>

              <CardContent className="service-card-content">
                <SelectedItemsTable
                  items={selectedLibraries.map((library) => ({
                    id: library.id,
                    name: library.name,
                    type: library.type,
                  }))}
                  onRemove={removeLibrary}
                  className="max-h-84 overflow-y-auto"
                />
              </CardContent>
            </Card>
          </div>

          {/* Parameters Card */}
          <Card>
            <CardHeader className="service-card-header">
              <CardTitle className="service-card-title">
                Parameters
                <DialogInfoPopup
                  title={genomeAssemblyParameters.title}
                  description={genomeAssemblyParameters.description}
                  sections={genomeAssemblyParameters.sections}
                />
              </CardTitle>
            </CardHeader>

            <CardContent className="service-card-content">
              <div className="space-y-6">
                {/* Assembly Strategy */}
                <form.Field name="recipe">
                  {(field) => (
                    <FieldItem>
                      <RequiredFormLabel>
                        Assembly Strategy
                      </RequiredFormLabel>
                      <Select
                        items={genomeAssemblyRecipes}
                        value={field.state.value}
                        onValueChange={(value) => field.handleChange(value as string)}
                      >
                        <SelectTrigger className="service-card-select-trigger">
                          <SelectValue placeholder="Select strategy" />
                        </SelectTrigger>
                        <SelectContent className="service-card-select-content">
                          <SelectGroup>
                            {genomeAssemblyRecipes.map((recipe) => (
                              <SelectItem key={recipe.value} value={recipe.value}>
                                {recipe.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <FieldErrors field={field} />
                    </FieldItem>
                  )}
                </form.Field>

                {/* Output Folder */}
                <form.Field name="output_path">
                  {(field) => (
                    <FieldItem>
                      <OutputFolder
                        required={true}
                        value={field.state.value}
                        onChange={(value) => field.handleChange(value)}
                      />
                      <FieldErrors field={field} />
                    </FieldItem>
                  )}
                </form.Field>

                {/* Output Name */}
                <form.Field name="output_file">
                  {(field) => (
                    <FieldItem>
                      <OutputFolder
                        variant="name"
                        required={true}
                        value={field.state.value}
                        onChange={(value) => field.handleChange(value)}
                        outputFolderPath={outputPath}
                        onValidationChange={setIsOutputNameValid}
                      />
                      <FieldErrors field={field} />
                    </FieldItem>
                  )}
                </form.Field>

                {/* Genome Size (for Canu only) */}
                {showGenomeSizeField && (
                  <form.Field name="genome_size">
                    {(field) => (
                      <FieldItem>
                        <FieldLabel field={field} className="service-card-label">
                          Estimated Genome Size
                        </FieldLabel>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={expectedGenomeSize}
                            onChange={(e) => {
                              const value = parseInt(e.target.value);
                              setExpectedGenomeSize(value);
                              const calculatedSize = calculateGenomeSize(value, genomeSizeUnit);
                              field.handleChange(calculatedSize);
                            }}
                            className="service-card-input flex-1"
                            min={genomeSizeUnit === "M" ? 1 : 100}
                            max={genomeSizeUnit === "M" ? 10 : 10000}
                          />
                          <span className="text-lg">&times;</span>
                          <Select
                            items={genomeSizeUnitOptions}
                            value={genomeSizeUnit}
                            onValueChange={(value) => {
                              if (value == null) return;
                              setGenomeSizeUnit(value as "M" | "K");
                              if (value === "M") {
                                setExpectedGenomeSize(5);
                                field.handleChange(5000000);
                              } else {
                                setExpectedGenomeSize(500);
                                field.handleChange(500000);
                              }
                            }}
                          >
                            <SelectTrigger className="service-card-select-trigger w-20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {genomeSizeUnitOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </div>
                        <FieldErrors field={field} />
                      </FieldItem>
                    )}
                  </form.Field>
                )}

                {/* Advanced Options */}
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

                  <CollapsibleContent className="service-collapsible-content">
                    {/* Read Processing */}
                    <div className="space-y-4">
                      <Label className="service-card-label">Read Processing</Label>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <form.Field name="normalize">
                          {(field) => (
                            <FieldItem className="flex flex-col items-start justify-between">
                              <FieldLabel field={field} className="service-card-sublabel">
                                Normalize Illumina Reads
                              </FieldLabel>
                              <Switch
                                checked={field.state.value}
                                onCheckedChange={(checked) => field.handleChange(checked)}
                              />
                            </FieldItem>
                          )}
                        </form.Field>

                        <form.Field name="trim">
                          {(field) => (
                            <FieldItem className="flex flex-col items-start justify-between">
                              <FieldLabel field={field} className="service-card-sublabel">
                                Trim Short Reads
                              </FieldLabel>
                              <Switch
                                checked={field.state.value}
                                onCheckedChange={(checked) => field.handleChange(checked)}
                              />
                            </FieldItem>
                          )}
                        </form.Field>

                        <form.Field name="filtlong">
                          {(field) => (
                            <FieldItem className="flex flex-col items-start justify-between">
                              <FieldLabel field={field} className="service-card-sublabel">
                                Filter Long Reads
                              </FieldLabel>
                              <Switch
                                checked={field.state.value}
                                onCheckedChange={(checked) => field.handleChange(checked)}
                              />
                            </FieldItem>
                          )}
                        </form.Field>
                      </div>
                    </div>

                    {/* Genome Parameters */}
                    <div className="space-y-4">
                      <Label className="service-card-label">Genome Parameters</Label>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <form.Field name="target_depth">
                          {(field) => (
                            <FieldItem>
                              <FieldLabel field={field} className="service-card-sublabel">
                                Target Genome Coverage
                              </FieldLabel>
                              <NumberInput
                                value={field.state.value}
                                onValueChange={field.handleChange}
                                min={100}
                                max={500}
                                stepper={50}
                              />
                              <FieldErrors field={field} />
                            </FieldItem>
                          )}
                        </form.Field>
                      </div>
                    </div>

                    {/* Assembly Polishing */}
                    <div className="space-y-4">
                      <Label className="service-card-label">Assembly Polishing</Label>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <form.Field name="racon_iter">
                          {(field) => (
                            <FieldItem>
                              <FieldLabel field={field} className="service-card-sublabel">
                                Racon Iterations
                              </FieldLabel>
                              <NumberInput
                                value={field.state.value}
                                onValueChange={field.handleChange}
                                min={0}
                                max={4}
                              />
                              <FieldErrors field={field} />
                            </FieldItem>
                          )}
                        </form.Field>

                        <form.Field name="pilon_iter">
                          {(field) => (
                            <FieldItem>
                              <FieldLabel field={field} className="service-card-sublabel">
                                Pilon Iterations
                              </FieldLabel>
                              <NumberInput
                                value={field.state.value}
                                onValueChange={field.handleChange}
                                min={0}
                                max={4}
                              />
                              <FieldErrors field={field} />
                            </FieldItem>
                          )}
                        </form.Field>
                      </div>
                    </div>

                    {/* Assembly Thresholds */}
                    <div className="space-y-4">
                      <Label className="service-card-label">Assembly Thresholds</Label>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <form.Field name="min_contig_len">
                          {(field) => (
                            <FieldItem>
                              <FieldLabel field={field} className="service-card-sublabel">
                                Min. contig length
                              </FieldLabel>
                              <NumberInput
                                value={field.state.value}
                                onValueChange={field.handleChange}
                                min={100}
                                max={100000}
                                stepper={10}
                              />
                              <FieldErrors field={field} />
                            </FieldItem>
                          )}
                        </form.Field>

                        <form.Field name="min_contig_cov">
                          {(field) => (
                            <FieldItem>
                              <FieldLabel field={field} className="service-card-sublabel">
                                Min. contig coverage
                              </FieldLabel>
                              <NumberInput
                                value={field.state.value}
                                onValueChange={field.handleChange}
                                min={0}
                                max={100000}
                                stepper={5}
                              />
                              <FieldErrors field={field} />
                            </FieldItem>
                          )}
                        </form.Field>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Selected Libraries */}
        <div className="hidden md:block md:col-span-5">
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
                      <p>
                        Read files placed here will contribute to a single
                        analysis.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
              <CardDescription>
                Place read files here using the arrow buttons.
              </CardDescription>
            </CardHeader>

            <CardContent className="service-card-content">
              <SelectedItemsTable
                items={selectedLibraries.map((library) => ({
                  id: library.id,
                  name: library.name,
                  type: library.type,
                }))}
                onRemove={removeLibrary}
                className="max-h-84 overflow-y-auto"
              />
            </CardContent>
          </Card>
        </div>

        {/* Form Controls */}
        <div className="service-form-controls md:col-span-12">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              className="service-form-controls-button"
            >
              Reset
            </Button>
            <Button
              type="submit"
              disabled={runtime.isSubmitting || !canSubmit || !isOutputNameValid}
            >
              {runtime.isSubmitting ? <Spinner /> : null}
              Assemble
            </Button>
          </div>
        </div>
      </form>

      <JobParamsDialog {...runtime.jobParamsDialogProps} />
    </section>
  );
}
