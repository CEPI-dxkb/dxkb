"use client";

import { useState, useEffect } from "react";
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

import { useServiceFormSubmission } from "@/hooks/services/use-service-form-submission";
import {
  sarsCov2GenomeAnalysisInfo,
  sarsCov2GenomeAnalysisParameters,
  sarsCov2GenomeAnalysisStartWith,
  readInputFileInfo,
} from "@/lib/services/service-info";

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
  transformSarsCov2GenomeAnalysisParams,
  computeOutputName,
  handleLibraryError as handleLibraryErrorUtil,
  getPairedLibraryBuildFn,
  getSingleLibraryBuildFn,
  singleLibraryDuplicateMatcher,
} from "@/lib/forms/(viral-tools)/sars-cov2-genome-analysis/sars-cov2-genome-analysis-form-utils";
import {
  buildBaseLibraryItem,
  useLibrarySelection,
} from "@/lib/forms/shared-library-selection";
import { getLibraryTypeLabel } from "@/lib/forms/shared-schemas";

import type { WorkspaceObject } from "@/lib/workspace-client";
import {
  sarsCov2PairedPlatformOptions,
  sarsCov2SinglePlatformOptions,
} from "@/lib/forms/(viral-tools)/sars-cov2-genome-analysis/sars-cov2-genome-analysis-form-schema";

const quickReference =
  "https://www.bv-brc.org/docs/quick_references/services/sars_cov_2_assembly_annotation_service.html";
const tutorial =
  "https://www.bv-brc.org/docs/tutorial/sars_cov_2_assembly_annotation/sars_cov_2_assembly_annotation.html";

export default function SarsCov2GenomeAnalysisPage() {
  const form = useForm<SarsCov2GenomeAnalysisFormData>({
    resolver: zodResolver(sarsCov2GenomeAnalysisFormSchema),
    defaultValues: defaultSarsCov2GenomeAnalysisFormValues,
    mode: "onChange",
  });

  const [pairedRead1, setPairedRead1] = useState<string | null>(null);
  const [pairedRead2, setPairedRead2] = useState<string | null>(null);
  const [pairedPlatform, setPairedPlatform] =
    useState<SarsCov2Platform>("illumina");
  const [singleRead, setSingleRead] = useState<string | null>(null);
  const [singlePlatform, setSinglePlatform] =
    useState<SarsCov2Platform>("illumina");
  const [sraResetKey, setSraResetKey] = useState(0);
  const [isOutputNameValid, setIsOutputNameValid] = useState(true);

  const inputType = form.watch("input_type");
  const recipe = form.watch("recipe");
  const primers = form.watch("primers");
  const scientificName = form.watch("scientific_name");
  const myLabel = form.watch("my_label");

  const showPrimersSection = recipe === "onecodex";
  const primerVersionOpts =
    primerVersionOptions[primers] ?? primerVersionOptions.ARTIC;

  const {
    selectedLibraries,
    addPairedLibrary,
    addSingleLibrary,
    removeLibrary,
    setLibrariesAndSync,
  } = useLibrarySelection<SarsCov2GenomeAnalysisFormData, SarsCov2LibraryItem>({
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
      form.setValue("output_file", outputName, { shouldValidate: true });
    }
  }, [scientificName, myLabel, form]);

  // When primers change, set default primer_version
  useEffect(() => {
    if (showPrimersSection && primers) {
      const defaultVersion = defaultPrimerVersion[primers];
      if (
        defaultVersion &&
        form.getValues("primer_version") !== defaultVersion
      ) {
        form.setValue("primer_version", defaultVersion, {
          shouldValidate: true,
        });
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
    form.reset(
      { ...defaultSarsCov2GenomeAnalysisFormValues },
      { keepDefaultValues: false },
    );
    setLibrariesAndSync([]);
    setPairedRead1(null);
    setPairedRead2(null);
    setSingleRead(null);
    setPairedPlatform("illumina");
    setSinglePlatform("illumina");
    setSraResetKey((k) => k + 1);
  };

  const {
    handleSubmit,
    showParamsDialog,
    setShowParamsDialog,
    currentParams,
    serviceName,
    isSubmitting,
  } = useServiceFormSubmission<SarsCov2GenomeAnalysisFormData>({
    serviceName: "ComprehensiveSARS2Analysis",
    displayName: "SARS-CoV-2 Genome Analysis",
    transformParams: transformSarsCov2GenomeAnalysisParams,
    onSuccess: handleReset,
  });

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

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
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
                <FormField
                  control={form.control}
                  name="input_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <RadioGroup
                          value={field.value}
                          onValueChange={field.onChange}
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
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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

                  <FormField
                    control={form.control}
                    name="paired_end_libs"
                    render={() => (
                      <FormItem>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                  <FormField
                    control={form.control}
                    name="contigs"
                    render={({ field }) => (
                      <FormItem>
                        <Label className="service-card-label">Contigs</Label>
                        <FormControl>
                          <WorkspaceObjectSelector
                            types={["contigs"]}
                            placeholder="Select or Upload Contigs to your workspace for Annotation"
                            value={field.value ?? ""}
                            onObjectSelect={(object: WorkspaceObject) =>
                              field.onChange(object.path)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                      <FormField
                        control={form.control}
                        name="recipe"
                        render={({ field }) => (
                          <FormItem>
                            <Select
                              items={recipeOptions}
                              value={field.value}
                              onValueChange={field.onChange}
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
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {showPrimersSection && (
                      <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
                        <div className="flex-1 space-y-2">
                          <Label className="service-card-label">Primers</Label>
                          <FormField
                            control={form.control}
                            name="primers"
                            render={({ field }) => (
                              <FormItem>
                                <Select
                                  items={primerOptions}
                                  value={field.value}
                                  onValueChange={(v) =>
                                    field.onChange(v as Primers)
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
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="w-full space-y-2 sm:w-32">
                          <Label className="service-card-label">Version</Label>
                          <FormField
                            control={form.control}
                            name="primer_version"
                            render={({ field }) => (
                              <FormItem>
                                <Select
                                  items={primerVersionOpts}
                                  value={field.value}
                                  onValueChange={field.onChange}
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
                                <FormMessage />
                              </FormItem>
                            )}
                          />
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
                    <FormField
                      control={form.control}
                      name="scientific_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <TaxonNameSelector
                              value={
                                field.value || form.getValues("taxonomy_id")
                                  ? {
                                      taxon_id:
                                        parseInt(
                                          form.getValues("taxonomy_id") || "0",
                                          10,
                                        ) || 0,
                                      taxon_name: field.value || "",
                                    }
                                  : null
                              }
                              onChange={(item) => {
                                if (item) {
                                  field.onChange(item.taxon_name);
                                  form.setValue(
                                    "taxonomy_id",
                                    String(item.taxon_id),
                                    {
                                      shouldValidate: true,
                                    },
                                  );
                                  const out = computeOutputName(
                                    item.taxon_name,
                                    form.getValues("my_label"),
                                  );
                                  if (out)
                                    form.setValue("output_file", out, {
                                      shouldValidate: true,
                                    });
                                } else {
                                  field.onChange("");
                                  form.setValue("taxonomy_id", "", {
                                    shouldValidate: true,
                                  });
                                }
                              }}
                              placeholder="e.g. Severe acute respiratory syndrome coronavirus 2"
                              includeViruses={false}
                              includeBacteria={false}
                              includeEukaryotes={false}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="w-full space-y-2 sm:w-40">
                    <Label className="service-card-label">Taxonomy ID</Label>
                    <FormField
                      control={form.control}
                      name="taxonomy_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <TaxIDSelector
                              value={
                                field.value
                                  ? {
                                      taxon_id: parseInt(field.value, 10) || 0,
                                      taxon_name:
                                        form.getValues("scientific_name") || "",
                                    }
                                  : null
                              }
                              onChange={(item) => {
                                if (item) {
                                  field.onChange(String(item.taxon_id));
                                  form.setValue(
                                    "scientific_name",
                                    item.taxon_name,
                                    {
                                      shouldValidate: true,
                                    },
                                  );
                                  const out = computeOutputName(
                                    item.taxon_name,
                                    form.getValues("my_label"),
                                  );
                                  if (out)
                                    form.setValue("output_file", out, {
                                      shouldValidate: true,
                                    });
                                } else {
                                  field.onChange("");
                                  form.setValue("scientific_name", "", {
                                    shouldValidate: true,
                                  });
                                }
                              }}
                              placeholder="NCBI Taxonomy ID"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="my_label"
                  render={({ field }) => (
                    <FormItem>
                      <Label className="service-card-label">My Label</Label>
                      <FormControl>
                        <Input
                          placeholder="My identifier123"
                          className="service-card-input"
                          {...field}
                          onChange={(e) => {
                            field.onChange(e.target.value);
                            const out = computeOutputName(
                              form.getValues("scientific_name"),
                              e.target.value,
                            );
                            if (out)
                              form.setValue("output_file", out, {
                                shouldValidate: true,
                              });
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="output_path"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <OutputFolder
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
                          value={field.value}
                          onChange={field.onChange}
                          outputFolderPath={form.watch("output_path")}
                          onValidationChange={setIsOutputNameValid}
                          disabled={true}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                  isSubmitting || !form.formState.isValid || !isOutputNameValid
                }
              >
                {isSubmitting ? <Spinner className="mr-2 h-4 w-4" /> : null}
                Submit
              </Button>
            </div>
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
