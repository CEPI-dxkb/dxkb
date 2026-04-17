"use client";

import { useState, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ChevronRight, HelpCircle } from "lucide-react";
import { toast } from "sonner";

import { ServiceHeader } from "@/components/services/service-header";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import SraRunAccessionWithValidation from "@/components/services/sra-run-accession-with-validation";
import SelectedItemsTable from "@/components/services/selected-items-table";
import OutputFolder from "@/components/services/output-folder";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import { TaxonNameSelector } from "@/components/taxonomy/taxon-name-selector";
import { TaxIDSelector } from "@/components/taxonomy/tax-id-selector";
import { JobParamsDialog } from "@/components/services/job-params-dialog";
import { Spinner } from "@/components/ui/spinner";

import { useServiceRuntime } from "@/hooks/services/use-service-runtime";
import {
  sarsCov2GenomeAnalysisInfo,
  sarsCov2GenomeAnalysisParameters,
  sarsCov2GenomeAnalysisStartWith,
  readInputFileInfo,
} from "@/lib/services/info/sars-cov2-genome-analysis";

import {
  sarsCov2GenomeAnalysisFormSchema,
  defaultSarsCov2GenomeAnalysisFormValues,
  recipeOptions,
  primerOptions,
  primerVersionOptions,
  defaultPrimerVersion,
  type SarsCov2GenomeAnalysisFormData,
  type SarsCov2LibraryItem,
  type SarsCov2Platform,
  type Primers,
} from "@/lib/forms/(viral-tools)/sars-cov2-genome-analysis/sars-cov2-genome-analysis-form-schema";
import {
  computeOutputName,
  handleLibraryError as handleLibraryErrorUtil,
  getPairedLibraryBuildFn,
  getSingleLibraryBuildFn,
  singleLibraryDuplicateMatcher,
} from "@/lib/forms/(viral-tools)/sars-cov2-genome-analysis/sars-cov2-genome-analysis-form-utils";
import { sarsCov2GenomeAnalysisService } from "@/lib/forms/(viral-tools)/sars-cov2-genome-analysis/sars-cov2-genome-analysis-service";
import {
  buildBaseLibraryItem,
  useTanstackLibrarySelection,
} from "@/lib/forms/tanstack-library-selection";
import { getLibraryTypeLabel } from "@/lib/forms/shared-schemas";

import type { WorkspaceObject } from "@/lib/services/workspace/types";
import {
  sarsCov2PairedPlatformOptions,
  sarsCov2SinglePlatformOptions,
} from "@/lib/forms/(viral-tools)/sars-cov2-genome-analysis/sars-cov2-genome-analysis-form-schema";

const quickReference =
  "https://www.bv-brc.org/docs/quick_references/services/sars_cov_2_assembly_annotation_service.html";
const tutorial =
  "https://www.bv-brc.org/docs/tutorial/sars_cov_2_assembly_annotation/sars_cov_2_assembly_annotation.html";

export default function SarsCov2GenomeAnalysisPage() {
  const form = useForm({
    defaultValues:
      defaultSarsCov2GenomeAnalysisFormValues as SarsCov2GenomeAnalysisFormData,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validators: { onChange: sarsCov2GenomeAnalysisFormSchema as any },
    onSubmit: async ({ value }) => {
      await runtime.submitFormData(value as SarsCov2GenomeAnalysisFormData);
    },
  });

  const outputPath = useStore(form.store, (s) => s.values.output_path);
  const canSubmit = useStore(form.store, (s) => s.canSubmit);

  const [pairedRead1, setPairedRead1] = useState<string | null>(null);
  const [pairedRead2, setPairedRead2] = useState<string | null>(null);
  const [pairedPlatform, setPairedPlatform] =
    useState<SarsCov2Platform>("illumina");
  const [singleRead, setSingleRead] = useState<string | null>(null);
  const [singlePlatform, setSinglePlatform] =
    useState<SarsCov2Platform>("illumina");
  const [sraResetKey, setSraResetKey] = useState(0);
  const [isOutputNameValid, setIsOutputNameValid] = useState(true);

  const inputType = useStore(form.store, (s) => s.values.input_type);
  const recipe = useStore(form.store, (s) => s.values.recipe);
  const primers = useStore(form.store, (s) => s.values.primers);
  const scientificName = useStore(form.store, (s) => s.values.scientific_name);
  const myLabel = useStore(form.store, (s) => s.values.my_label);

  const showPrimersSection = recipe === "onecodex";
  const primerVersionOpts =
    primerVersionOptions[primers] ?? primerVersionOptions.ARTIC;

  const {
    selectedLibraries,
    addPairedLibrary,
    addSingleLibrary,
    removeLibrary,
    setLibrariesAndSync,
    syncLibrariesToForm,
  } = useTanstackLibrarySelection<SarsCov2LibraryItem>({
    form,
    mapLibraryToItem: (library) => ({
      ...buildBaseLibraryItem(library),
      ...(library.platform && {
        platform: library.platform as SarsCov2Platform,
      }),
    }),
    fields: {
      paired: "paired_end_libs",
      single: "single_end_libs",
      srr: "srr_ids",
    },
  });

  // Sync output_file when scientific_name or my_label changes
  useEffect(() => {
    const outputName = computeOutputName(scientificName ?? "", myLabel ?? "");
    if (outputName) {
      form.setFieldValue("output_file", outputName);
    }
  }, [scientificName, myLabel, form]);

  // When primers change, set default primer_version
  useEffect(() => {
    if (showPrimersSection && primers) {
      const defaultVersion = defaultPrimerVersion[primers];
      if (
        defaultVersion &&
        form.state.values.primer_version !== defaultVersion
      ) {
        form.setFieldValue("primer_version", defaultVersion);
      }
    }
  }, [primers, showPrimersSection, form]);

  const handleLibraryError = (message: string) => {
    handleLibraryErrorUtil(message, toast);
  };

  const handlePairedLibraryAdd = () => {
    addPairedLibrary({
      read1: pairedRead1,
      read2: pairedRead2,
      buildLibrary: getPairedLibraryBuildFn(pairedPlatform),
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
      buildLibrary: getSingleLibraryBuildFn(singlePlatform),
      duplicateMatcher: singleLibraryDuplicateMatcher,
      onError: handleLibraryError,
      onAfterAdd: () => {
        setSingleRead(null);
      },
    });
  };

  const handleReset = () => {
    form.reset(defaultSarsCov2GenomeAnalysisFormValues);
    setLibrariesAndSync([]);
    setPairedRead1(null);
    setPairedRead2(null);
    setSingleRead(null);
    setPairedPlatform("illumina");
    setSinglePlatform("illumina");
    setSraResetKey((k) => k + 1);
  };

  const runtime = useServiceRuntime({
    definition: sarsCov2GenomeAnalysisService,
    form,
    onSuccess: handleReset,
    rerun: {
      libraries: ["paired", "single", "sra"],
      getLibraryExtra: (lib, kind) => {
        if (kind === "paired" || kind === "single") {
          return { platform: lib.platform || "illumina" };
        }
        return {};
      },
      syncLibraries: (libs) => {
        syncLibrariesToForm(libs);
        setLibrariesAndSync(libs);
      },
    },
  });
  const { isSubmitting, jobParamsDialogProps } = runtime;

  return (
    <section>
      <ServiceHeader
        title="SARS-CoV-2 Genome Analysis"
        description="The SARS-CoV-2 Genome Analysis Service provides a streamlined meta-service that accepts raw reads and performs genome assembly, annotation, and variation analysis."
        infoPopupTitle={sarsCov2GenomeAnalysisInfo.title}
        infoPopupDescription={sarsCov2GenomeAnalysisInfo.description}
        quickReferenceGuide={quickReference}
        tutorial={tutorial}
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="grid grid-cols-1 gap-6 md:grid-cols-12"
      >
        {/* Start With */}
        <div className="md:col-span-12">
          <Card>
            <CardHeader className="service-card-header">
              <RequiredFormCardTitle className="service-card-title">
                Start With
                <DialogInfoPopup
                  title={sarsCov2GenomeAnalysisStartWith.title}
                  description={sarsCov2GenomeAnalysisStartWith.description}
                  sections={sarsCov2GenomeAnalysisStartWith.sections}
                />
              </RequiredFormCardTitle>
            </CardHeader>
            <CardContent className="service-card-content">
              <form.Field name="input_type">
                {(field) => (
                  <FieldItem>
                    <RadioGroup
                      value={field.state.value}
                      onValueChange={(value) =>
                        value != null && field.handleChange(value)
                      }
                      className="service-radio-group-horizontal"
                    >
                      <div className="service-radio-group-item flex items-center gap-2">
                        <RadioGroupItem value="reads" id="start-reads" />
                        <Label htmlFor="start-reads">Read File</Label>
                      </div>
                      <div className="service-radio-group-item flex items-center gap-2">
                        <RadioGroupItem
                          value="contigs"
                          id="start-contigs"
                        />
                        <Label htmlFor="start-contigs">
                          Assembled Contigs
                        </Label>
                      </div>
                    </RadioGroup>
                    <FieldErrors field={field} />
                  </FieldItem>
                )}
              </form.Field>
            </CardContent>
          </Card>
        </div>

        {/* Parameters */}
        {inputType === "reads" && (
          <div className="md:col-span-6">
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
                      onObjectSelect={(object: WorkspaceObject) =>
                        setPairedRead1(object.path)
                      }
                    />
                    <WorkspaceObjectSelector
                      types={["reads"]}
                      placeholder="Select READ FILE 2..."
                      value={pairedRead2 ?? ""}
                      onObjectSelect={(object: WorkspaceObject) =>
                        setPairedRead2(object.path)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="service-card-sublabel">Platform</Label>
                    <Select
                      items={sarsCov2PairedPlatformOptions}
                      value={pairedPlatform}
                      onValueChange={(v) => {
                        if (v == null) return;
                        setPairedPlatform(v as SarsCov2Platform);
                      }}
                    >
                      <SelectTrigger className="service-card-select-trigger">
                        <SelectValue placeholder="Select a platform..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {sarsCov2PairedPlatformOptions.map((platform) => (
                            <SelectItem
                              key={platform.value}
                              value={platform.value}
                            >
                              {platform.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>

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
                      onObjectSelect={(object: WorkspaceObject) =>
                        setSingleRead(object.path)
                      }
                    />
                    <div className="space-y-2">
                      <Label className="service-card-sublabel">
                        Platform
                      </Label>
                      <Select
                        items={sarsCov2SinglePlatformOptions}
                        value={singlePlatform}
                        onValueChange={(v) => {
                          if (v == null) return;
                          setSinglePlatform(v as SarsCov2Platform);
                        }}
                      >
                        <SelectTrigger className="service-card-select-trigger">
                          <SelectValue placeholder="Select a platform..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {sarsCov2SinglePlatformOptions.map((platform) => (
                              <SelectItem
                                key={platform.value}
                                value={platform.value}
                              >
                                {platform.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

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
        )}

        {/* Selected Libraries (when reads) */}
        {inputType === "reads" && (
          <div className="md:col-span-6">
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
                  items={selectedLibraries.map((lib) => ({
                    id: lib.id,
                    name: lib.name,
                    type: getLibraryTypeLabel(lib.type),
                  }))}
                  onRemove={removeLibrary}
                  className="max-h-80 overflow-y-auto"
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Contigs (when contigs) */}
        {inputType === "contigs" && (
          <div className="md:col-span-12">
            <Card>
              <CardHeader className="service-card-header">
                <RequiredFormCardTitle className="service-card-title">
                  Input File
                </RequiredFormCardTitle>
              </CardHeader>
              <CardContent className="service-card-content">
                <form.Field name="contigs">
                  {(field) => (
                    <FieldItem>
                      <Label className="service-card-label">Contigs</Label>
                      <WorkspaceObjectSelector
                        types={["contigs"]}
                        placeholder="Select or Upload Contigs to your workspace for Annotation"
                        value={field.state.value ?? ""}
                        onObjectSelect={(object: WorkspaceObject) =>
                          field.handleChange(object.path)
                        }
                      />
                      <FieldErrors field={field} />
                    </FieldItem>
                  )}
                </form.Field>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Input Library (when reads) */}
        <div className="col-span-full">
          <Card className="h-full">
            <CardHeader className="service-card-header">
              <RequiredFormCardTitle className="service-card-title">
                Parameters
                <DialogInfoPopup
                  title={sarsCov2GenomeAnalysisParameters.title}
                  sections={sarsCov2GenomeAnalysisParameters.sections}
                />
              </RequiredFormCardTitle>
            </CardHeader>
            <CardContent className="service-card-content space-y-4">
              {inputType === "reads" && (
                <>
                  <div className="space-y-2">
                    <Label className="service-card-label">Strategy</Label>
                    <form.Field name="recipe">
                      {(field) => (
                        <FieldItem>
                          <Select
                            items={recipeOptions}
                            value={field.state.value}
                            onValueChange={(value) =>
                              value != null && field.handleChange(value)
                            }
                          >
                            <SelectTrigger className="service-card-select-trigger">
                              <SelectValue placeholder="Select strategy" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {recipeOptions.map((opt) => (
                                  <SelectItem
                                    key={opt.value}
                                    value={opt.value}
                                  >
                                    {opt.label}
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

                  {showPrimersSection && (
                    <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
                      <div className="flex-1 space-y-2">
                        <Label className="service-card-label">Primers</Label>
                        <form.Field name="primers">
                          {(field) => (
                            <FieldItem>
                              <Select
                                items={primerOptions}
                                value={field.state.value}
                                onValueChange={(v) =>
                                  v != null &&
                                  field.handleChange(v as Primers)
                                }
                              >
                                <SelectTrigger className="service-card-select-trigger">
                                  <SelectValue placeholder="Select primers" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectGroup>
                                    {primerOptions.map((primer) => (
                                      <SelectItem
                                        key={primer.value}
                                        value={primer.value}
                                      >
                                        {primer.label}
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
                      <div className="w-full space-y-2 sm:w-32">
                        <Label className="service-card-label">Version</Label>
                        <form.Field name="primer_version">
                          {(field) => (
                            <FieldItem>
                              <Select
                                items={primerVersionOpts}
                                value={field.state.value}
                                onValueChange={(value) =>
                                  value != null && field.handleChange(value)
                                }
                              >
                                <SelectTrigger className="service-card-select-trigger">
                                  <SelectValue placeholder="Version" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectGroup>
                                    {primerVersionOpts.map((opt) => (
                                      <SelectItem
                                        key={opt.value}
                                        value={opt.value}
                                      >
                                        {opt.label}
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
                    </div>
                  )}
                </>
              )}

              <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
                <div className="flex-1 space-y-2">
                  <Label className="service-card-label">
                    Taxonomy Name
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <HelpCircle className="service-card-tooltip-icon ml-1 inline-block" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Select the taxonomy name for SARS-CoV-2</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <form.Field name="scientific_name">
                    {(field) => (
                      <FieldItem>
                        <TaxonNameSelector
                          value={
                            field.state.value ||
                            form.state.values.taxonomy_id
                              ? {
                                  taxon_id:
                                    parseInt(
                                      form.state.values.taxonomy_id || "0",
                                      10,
                                    ) || 0,
                                  taxon_name: field.state.value || "",
                                }
                              : null
                          }
                          onChange={(item) => {
                            if (item) {
                              field.handleChange(item.taxon_name);
                              form.setFieldValue(
                                "taxonomy_id",
                                String(item.taxon_id),
                              );
                              const out = computeOutputName(
                                item.taxon_name,
                                form.state.values.my_label,
                              );
                              if (out)
                                form.setFieldValue("output_file", out);
                            } else {
                              field.handleChange("");
                              form.setFieldValue("taxonomy_id", "");
                            }
                          }}
                          placeholder="e.g. Severe acute respiratory syndrome coronavirus 2"
                          includeViruses={false}
                          includeBacteria={false}
                          includeEukaryotes={false}
                        />
                        <FieldErrors field={field} />
                      </FieldItem>
                    )}
                  </form.Field>
                </div>
                <div className="w-full space-y-2 sm:w-40">
                  <Label className="service-card-label">Taxonomy ID</Label>
                  <form.Field name="taxonomy_id">
                    {(field) => (
                      <FieldItem>
                        <TaxIDSelector
                          value={
                            field.state.value
                              ? {
                                  taxon_id:
                                    parseInt(field.state.value, 10) || 0,
                                  taxon_name:
                                    form.state.values.scientific_name || "",
                                }
                              : null
                          }
                          onChange={(item) => {
                            if (item) {
                              field.handleChange(String(item.taxon_id));
                              form.setFieldValue(
                                "scientific_name",
                                item.taxon_name,
                              );
                              const out = computeOutputName(
                                item.taxon_name,
                                form.state.values.my_label,
                              );
                              if (out)
                                form.setFieldValue("output_file", out);
                            } else {
                              field.handleChange("");
                              form.setFieldValue("scientific_name", "");
                            }
                          }}
                          placeholder="NCBI Taxonomy ID"
                        />
                        <FieldErrors field={field} />
                      </FieldItem>
                    )}
                  </form.Field>
                </div>
              </div>

              <form.Field name="my_label">
                {(field) => (
                  <FieldItem>
                    <Label className="service-card-label">My Label</Label>
                    <Input
                      placeholder="My identifier123"
                      className="service-card-input"
                      value={field.state.value}
                      onChange={(e) => {
                        field.handleChange(e.target.value);
                        const out = computeOutputName(
                          form.state.values.scientific_name,
                          e.target.value,
                        );
                        if (out)
                          form.setFieldValue("output_file", out);
                      }}
                    />
                    <FieldErrors field={field} />
                  </FieldItem>
                )}
              </form.Field>

              <form.Field name="output_path">
                {(field) => (
                  <FieldItem>
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
                  <FieldItem>
                    <OutputFolder
                      variant="name"
                      value={field.state.value}
                      onChange={(value) => field.handleChange(value)}
                      outputFolderPath={outputPath}
                      onValidationChange={setIsOutputNameValid}
                      disabled={true}
                    />
                    <FieldErrors field={field} />
                  </FieldItem>
                )}
              </form.Field>
            </CardContent>
          </Card>
        </div>

        {/* Form controls */}
        <div className="md:col-span-12">
          <div className="service-form-controls">
            <Button type="button" variant="outline" onClick={handleReset}>
              Reset
            </Button>
            <Button
              type="submit"
              disabled={
                isSubmitting || !canSubmit || !isOutputNameValid
              }
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
