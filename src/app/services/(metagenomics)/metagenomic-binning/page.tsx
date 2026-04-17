"use client";

import { useState, useEffect } from "react";
import { useForm, useStore } from "@tanstack/react-form";
import { FieldItem, FieldLabel, FieldErrors } from "@/components/ui/tanstack-form";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { NumberInput } from "@/components/ui/number-input";
import { ChevronDown, ChevronRight, HelpCircle } from "lucide-react";
import { toast } from "sonner";

import { ServiceHeader } from "@/components/services/service-header";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import SraRunAccessionWithValidation from "@/components/services/sra-run-accession-with-validation";
import SelectedItemsTable from "@/components/services/selected-items-table";
import OutputFolder from "@/components/services/output-folder";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import { JobParamsDialog } from "@/components/services/job-params-dialog";
import { Spinner } from "@/components/ui/spinner";

import { useServiceRuntime } from "@/hooks/services/use-service-runtime";
import {
  metagenomicBinningInfo,
  metagenomicBinningInputFile,
  metagenomicBinningParameters,
  metagenomicBinningStartWith,
} from "@/lib/services/info/metagenomic-binning";

import {
  metagenomicBinningFormSchema,
  defaultMetagenomicBinningFormValues,
  minContigLengthMin,
  minContigLengthMax,
  minContigCoverageMin,
  minContigCoverageMax,
  type MetagenomicBinningFormData,
  type LibraryItem,
} from "@/lib/forms/(metagenomics)/metagenomic-binning/metagenomic-binning-form-schema";
import { metagenomicBinningService } from "@/lib/forms/(metagenomics)/metagenomic-binning/metagenomic-binning-service";
import {
  buildBaseLibraryItem,
  getPairedLibraryName,
  getSingleLibraryName,
  useTanstackLibrarySelection,
} from "@/lib/forms/tanstack-library-selection";
import { getLibraryTypeLabel } from "@/lib/forms/shared-schemas";

import type { WorkspaceObject } from "@/lib/services/workspace/types";

export default function MetagenomicBinningPage() {
  // UI state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isOutputNameValid, setIsOutputNameValid] = useState(true);

  // Read input state
  const [pairedRead1, setPairedRead1] = useState<string | null>(null);
  const [pairedRead2, setPairedRead2] = useState<string | null>(null);
  const [singleRead, setSingleRead] = useState<string | null>(null);
  const [sraResetKey, setSraResetKey] = useState(0);

  const handleReset = () => {
    form.reset(defaultMetagenomicBinningFormValues);
    setLibrariesAndSync([]);
    setShowAdvanced(false);
    setPairedRead1(null);
    setPairedRead2(null);
    setSingleRead(null);
    setSraResetKey((k) => k + 1);
  };

  const form = useForm({
    defaultValues: defaultMetagenomicBinningFormValues as MetagenomicBinningFormData,
    validators: { onChange: metagenomicBinningFormSchema },
    onSubmit: async ({ value }) => {
      await runtime.submitFormData(value as MetagenomicBinningFormData);
    },
  });

  const outputPath = useStore(form.store, (s) => s.values.output_path);
  const startWith = useStore(form.store, (s) => s.values.start_with);
  const assembler = useStore(form.store, (s) => s.values.assembler);
  const canSubmit = useStore(form.store, (s) => s.canSubmit);

  const {
    selectedLibraries,
    addPairedLibrary,
    addSingleLibrary,
    removeLibrary,
    setLibrariesAndSync,
    syncLibrariesToForm,
  } = useTanstackLibrarySelection<LibraryItem>({
    form,
    mapLibraryToItem: buildBaseLibraryItem,
    fields: {
      paired: "paired_end_libs",
      single: "single_end_libs",
      srr: "srr_ids",
    },
  });

  const runtime = useServiceRuntime({
    definition: metagenomicBinningService,
    form,
    onSuccess: handleReset,
    rerun: {
      libraries: ["paired", "single", "sra"],
      syncLibraries: (libs) => {
        syncLibrariesToForm(libs);
        setLibrariesAndSync(libs);
      },
    },
  });
  const { isSubmitting, jobParamsDialogProps } = runtime;

  // Determine if MetaSPAdes should be disabled based on selectedLibraries (source of truth)
  // MetaSPAdes only supports a single paired-end library
  const pairedCount = selectedLibraries.filter((lib) => lib.type === "paired").length;
  const metaspadesDisabled = !(selectedLibraries.length === 1 && pairedCount === 1);

  // Reset assembler to auto if metaspades becomes disabled while selected
  useEffect(() => {
    if (metaspadesDisabled && assembler === "metaspades") {
      form.setFieldValue("assembler", "auto");
    }
  }, [metaspadesDisabled, assembler, form]);

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
        title="Metagenomic Binning"
        description="The Metagenomic Binning Service accepts either reads or contigs, and
          attempts to 'bin' the data into a set of genomes. This service can be
          used to reconstruct bacterial and archaeal genomes from environmental
          samples."
        infoPopupTitle={metagenomicBinningInfo.title}
        infoPopupDescription={metagenomicBinningInfo.description}
        quickReferenceGuide="https://www.bv-brc.org/docs/quick_references/services/metagenomic_binning_service.html"
        tutorial="https://www.bv-brc.org/docs/tutorial/metagenomic_binning/metagenomic_binning.html"
        instructionalVideo="https://youtube.com/playlist?list=PLWfOyhOW_OasTc7mmLSXZvQYrO_R5se47&si=X66tQsvWsW0GuA6Z"
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="grid grid-cols-1 gap-6 md:grid-cols-12"
      >
        {/* Start With Section */}
        <div className="md:col-span-12">
          <Card>
            <CardHeader className="service-card-header">
              <CardTitle className="service-card-title">
                Start With
                <DialogInfoPopup
                  title={metagenomicBinningStartWith.title}
                  description={metagenomicBinningStartWith.description}
                  sections={metagenomicBinningStartWith.sections}
                />
              </CardTitle>
            </CardHeader>

            <CardContent className="service-card-content">
              <form.Field name="start_with">
                {(field) => (
                  <FieldItem>
                    <RadioGroup
                      value={field.state.value}
                      onValueChange={(value) => value != null && field.handleChange(value as MetagenomicBinningFormData["start_with"])}
                      className="service-radio-group-horizontal"
                    >
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value="reads" id="reads" />
                        <Label htmlFor="reads">Read Files</Label>
                      </div>
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value="contigs" id="contigs" />
                        <Label htmlFor="contigs">Assembled Contigs</Label>
                      </div>
                    </RadioGroup>
                    <FieldErrors field={field} />
                  </FieldItem>
                )}
              </form.Field>
            </CardContent>
          </Card>
        </div>

        {/* Input File Section - Read Files */}
        {startWith === "reads" && (
          <>
            <div className="md:col-span-7">
              <Card className="h-full">
                <CardHeader className="service-card-header">
                  <RequiredFormCardTitle className="service-card-title">
                    Input File
                    <DialogInfoPopup
                      title={metagenomicBinningInputFile.title}
                      description={metagenomicBinningInputFile.description}
                      sections={metagenomicBinningInputFile.sections}
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
                        types={["reads"]}
                        placeholder="Select READ FILE 1..."
                        value={pairedRead1 ?? ""}
                        onObjectSelect={(object: WorkspaceObject) => {
                          setPairedRead1(object.path);
                        }}
                      />
                      <WorkspaceObjectSelector
                        types={["reads"]}
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
                        disabled={!singleRead}
                      >
                        <ChevronRight size={16} />
                      </Button>
                    </div>
                    <WorkspaceObjectSelector
                      types={["reads"]}
                      placeholder="Select READ FILE..."
                      value={singleRead ?? ""}
                      onObjectSelect={(object: WorkspaceObject) => {
                        setSingleRead(object.path);
                      }}
                    />
                  </div>

                  {/* SRA Run Accession - key forces remount on reset to clear internal textbox state */}
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
                      <FieldErrors field={field} />
                    )}
                  </form.Field>
                </CardContent>
              </Card>
            </div>

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
                  />
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Input File Section - Assembled Contigs */}
        {startWith === "contigs" && (
          <div className="md:col-span-12">
            <Card>
              <CardHeader className="service-card-header">
                <RequiredFormCardTitle className="service-card-title">
                  Input File
                  <DialogInfoPopup
                    title={metagenomicBinningInputFile.title}
                    description={metagenomicBinningInputFile.description}
                    sections={metagenomicBinningInputFile.sections}
                  />
                </RequiredFormCardTitle>
              </CardHeader>

              <CardContent className="service-card-content space-y-6">
                <form.Field name="contigs">
                  {(field) => (
                    <FieldItem>
                      <FieldLabel field={field} className="service-card-label">
                        Contigs
                      </FieldLabel>
                      <WorkspaceObjectSelector
                        types={["contigs"]}
                        placeholder="Select or Upload Contigs..."
                        onSelectedObjectChange={(
                          object: WorkspaceObject | null,
                        ) => {
                          field.handleChange(object?.path || "");
                        }}
                        value={field.state.value}
                      />
                      <FieldErrors field={field} />
                    </FieldItem>
                  )}
                </form.Field>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Parameters Section */}
        <div className="md:col-span-12">
          <Card>
            <CardHeader className="service-card-header">
              <RequiredFormCardTitle className="service-card-title">
                Parameters
                <DialogInfoPopup
                  title={metagenomicBinningParameters.title}
                  description={metagenomicBinningParameters.description}
                  sections={metagenomicBinningParameters.sections}
                />
              </RequiredFormCardTitle>
            </CardHeader>

            <CardContent>
              <div className="space-y-6">
                <div className="flex w-full flex-col gap-4 md:flex-row">
                  {/* Assembly Strategy - Only shown for reads */}
                  {startWith === "reads" && (
                    <div className="w-full">
                      <form.Field name="assembler">
                        {(field) => (
                          <FieldItem>
                            <FieldLabel field={field} className="service-card-label">
                              Assembly Strategy
                            </FieldLabel>
                            <RadioGroup
                              value={field.state.value}
                              onValueChange={(value) => value != null && field.handleChange(value as MetagenomicBinningFormData["assembler"])}
                              className="service-radio-group-horizontal"
                            >
                              <div className="flex items-center gap-3">
                                <RadioGroupItem
                                  value="metaspades"
                                  id="metaspades"
                                  disabled={metaspadesDisabled}
                                />
                                <Label
                                  htmlFor="metaspades"
                                  className={`text-sm ${metaspadesDisabled ? "text-muted-foreground" : ""}`}
                                >
                                  MetaSPAdes
                                </Label>
                              </div>
                              <div className="flex items-center gap-3">
                                <RadioGroupItem
                                  value="megahit"
                                  id="megahit"
                                />
                                <Label
                                  htmlFor="megahit"
                                  className="text-sm"
                                >
                                  MEGAHIT
                                </Label>
                              </div>
                              <div className="flex items-center gap-3">
                                <RadioGroupItem value="auto" id="auto" />
                                <Label htmlFor="auto" className="text-sm">
                                  Auto
                                </Label>
                              </div>
                            </RadioGroup>
                            <FieldErrors field={field} />
                          </FieldItem>
                        )}
                      </form.Field>
                    </div>
                  )}

                  {/* Organisms of Interest */}
                  <div className="w-full">
                    <form.Field name="organism">
                      {(field) => (
                        <FieldItem>
                          <FieldLabel field={field} className="service-card-label">
                            Organisms of Interest
                          </FieldLabel>
                          <RadioGroup
                            value={field.state.value}
                            onValueChange={(value) => value != null && field.handleChange(value as MetagenomicBinningFormData["organism"])}
                            className="service-radio-group-horizontal"
                          >
                            <div className="flex items-center gap-3">
                              <RadioGroupItem
                                value="bacteria"
                                id="bacteria"
                              />
                              <Label htmlFor="bacteria" className="text-sm">
                                Bacteria/Archaea
                              </Label>
                            </div>
                            <div className="flex items-center gap-3">
                              <RadioGroupItem value="viral" id="viral" />
                              <Label htmlFor="viral" className="text-sm">
                                Viruses
                              </Label>
                            </div>
                            <div className="flex items-center gap-3">
                              <RadioGroupItem value="both" id="both" />
                              <Label htmlFor="both" className="text-sm">
                                Both
                              </Label>
                            </div>
                          </RadioGroup>
                          <FieldErrors field={field} />
                        </FieldItem>
                      )}
                    </form.Field>
                  </div>
                </div>

                {/* Output Configuration */}
                <div className="mt-4 space-y-6">
                  <div className="flex flex-col space-y-4">
                    <form.Field name="output_path">
                      {(field) => (
                        <FieldItem className="w-full">
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
                        <FieldItem className="w-full">
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

                  {/* Genome Group Name */}
                  <form.Field name="genome_group">
                    {(field) => (
                      <FieldItem>
                        <FieldLabel field={field} className="service-card-label">
                          Genome Group Name
                        </FieldLabel>
                        <Input
                          name={field.name}
                          value={field.state.value ?? ""}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                          placeholder="My Genome Group"
                          className="service-card-input"
                        />
                        <FieldErrors field={field} />
                      </FieldItem>
                    )}
                  </form.Field>
                </div>

                {/* Advanced Parameters */}
                <Collapsible
                  open={showAdvanced}
                  onOpenChange={setShowAdvanced}
                  className="service-collapsible-container"
                >
                  <CollapsibleTrigger className="service-collapsible-trigger text-sm font-medium">
                    Advanced Parameters
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-180 transform" : ""}`}
                    />
                  </CollapsibleTrigger>

                  <CollapsibleContent className="service-collapsible-content">
                    <div className="mt-6 space-y-4">
                      <div className="service-card-row">
                        <form.Field name="min_contig_len">
                          {(field) => (
                            <FieldItem className="w-full">
                              <FieldLabel field={field} className="service-card-sublabel">
                                Minimum Contig Length
                              </FieldLabel>
                              <NumberInput
                                name={field.name}
                                value={field.state.value}
                                min={minContigLengthMin}
                                max={minContigLengthMax}
                                stepper={10}
                                onBlur={field.handleBlur}
                                onValueChange={(value) => {
                                  if (value !== undefined)
                                    field.handleChange(value);
                                }}
                              />
                              <FieldErrors field={field} />
                            </FieldItem>
                          )}
                        </form.Field>

                        <form.Field name="min_contig_cov">
                          {(field) => (
                            <FieldItem className="w-full">
                              <FieldLabel field={field} className="service-card-sublabel">
                                Minimum Contig Coverage
                              </FieldLabel>
                              <NumberInput
                                name={field.name}
                                value={field.state.value}
                                min={minContigCoverageMin}
                                max={minContigCoverageMax}
                                stepper={1}
                                onBlur={field.handleBlur}
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

                      <form.Field name="disable_dangling">
                        {(field) => (
                          <FieldItem className="flex items-center gap-2">
                            <Checkbox
                              id="disable_dangling"
                              name="disable_dangling"
                              checked={field.state.value}
                              onCheckedChange={(checked) => field.handleChange(!!checked)}
                              className="mb-2 bg-white"
                            />
                            <FieldLabel
                              field={field}
                              htmlFor="disable_dangling"
                              className="service-card-sublabel"
                            >
                              Disable Search For Dangling Contigs (Decreases
                              Memory Use)
                            </FieldLabel>
                          </FieldItem>
                        )}
                      </form.Field>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
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
