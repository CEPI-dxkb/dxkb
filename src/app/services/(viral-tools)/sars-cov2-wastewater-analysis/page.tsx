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
import { ChevronRight, HelpCircle } from "lucide-react";
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

import { useServiceFormSubmission } from "@/hooks/services/use-service-form-submission";
import {
  sarsCov2WastewaterAnalysisInfo,
  sarsCov2WastewaterAnalysisInputLib,
  sarsCov2WastewaterAnalysisParameters,
} from "@/lib/services/service-info";

import {
  sarsCov2WastewaterAnalysisFormSchema,
  defaultSarsCov2WastewaterAnalysisFormValues,
  primerOptions,
  primerVersionOptions,
  defaultPrimerVersion,
  recipeOptions,
  type SarsCov2WastewaterAnalysisFormData,
  type SarsCov2WastewaterLibraryItem,
  type Primers,
  type SrrLibItem,
} from "@/lib/forms/(viral-tools)/sars-cov2-wastewater-analysis/sars-cov2-wastewater-analysis-form-schema";
import {
  transformSarsCov2WastewaterParams,
  handleLibraryError as handleLibraryErrorUtil,
  getPairedLibraryBuildFn,
  getSingleLibraryBuildFn,
  singleLibraryDuplicateMatcher,
  findNewSraLibraries,
  resolveSampleIdAndDate,
  getDefaultSampleIdFromPath,
  getDefaultSampleIdFromSrr,
} from "@/lib/forms/(viral-tools)/sars-cov2-wastewater-analysis/sars-cov2-wastewater-analysis-form-utils";
import {
  buildBaseLibraryItem,
  useLibrarySelection,
} from "@/lib/forms/shared-library-selection";
import { getLibraryTypeLabel } from "@/lib/forms/shared-schemas";

import type { WorkspaceObject } from "@/lib/workspace-client";
import type { Library } from "@/types/services";

const quickReference =
  "https://www.bv-brc.org/docs/quick_references/services/sars_cov_2_wastewater_analysis_service.html";
const tutorial =
  "https://www.bv-brc.org/docs/tutorial/sars_cov_2_wastewater/sars_cov_2_wastewater.html";

export default function SarsCov2WastewaterAnalysisPage() {
  const form = useForm<SarsCov2WastewaterAnalysisFormData>({
    resolver: zodResolver(sarsCov2WastewaterAnalysisFormSchema),
    defaultValues: defaultSarsCov2WastewaterAnalysisFormValues,
    mode: "onChange",
  });

  const [pairedRead1, setPairedRead1] = useState<string | null>(null);
  const [pairedRead2, setPairedRead2] = useState<string | null>(null);
  const [singleRead, setSingleRead] = useState<string | null>(null);
  const [currentSampleId, setCurrentSampleId] = useState("");
  const [currentSampleDate, setCurrentSampleDate] = useState("");
  const [sraResetKey, setSraResetKey] = useState(0);
  const [isOutputNameValid, setIsOutputNameValid] = useState(true);

  const primers = form.watch("primers");
  const primerVersionOpts =
    primerVersionOptions[primers] ?? primerVersionOptions.ARTIC;

  const {
    selectedLibraries,
    addPairedLibrary,
    addSingleLibrary,
    removeLibrary,
    setLibrariesAndSync,
  } = useLibrarySelection<
    SarsCov2WastewaterAnalysisFormData,
    SarsCov2WastewaterLibraryItem,
    SrrLibItem
  >({
    form,
    mapLibraryToItem: (library) => ({
      ...buildBaseLibraryItem(library),
      sample_id: library.sampleId?.trim() ?? library.id,
      ...(library.sampleLevelDate?.trim() && {
        sample_level_date: library.sampleLevelDate.trim(),
      }),
    }),
    mapSraLibraryToItem: (library) => ({
      srr_accession: library.id,
      sample_id: library.sampleId?.trim() ?? library.id,
      ...(library.sampleLevelDate?.trim() && {
        sample_level_date: library.sampleLevelDate.trim(),
      }),
      ...(library.title && { title: library.title }),
    }),
    fields: {
      paired: "paired_end_libs",
      single: "single_end_libs",
      srr: "srr_libs",
    },
    normalizeLibraries: (nextLibraries, previousLibraries) => {
      const newSraLibs = findNewSraLibraries(nextLibraries, previousLibraries);
      return nextLibraries.map((lib) => {
        if (lib.type === "sra" && newSraLibs.some((n) => n.id === lib.id)) {
          return {
            ...lib,
            sampleId: currentSampleId.trim() || lib.id,
            ...(currentSampleDate.trim() && {
              sampleLevelDate: currentSampleDate.trim(),
            }),
          };
        }
        return lib;
      });
    },
  });

  // When primers change, set default primer_version
  useEffect(() => {
    if (primers) {
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
  }, [primers, form]);

  // Suggest default sample ID when user selects a read (legacy setPairedId/setSingleId behavior)
  useEffect(() => {
    if (pairedRead1) {
      setCurrentSampleId(getDefaultSampleIdFromPath(pairedRead1));
    }
  }, [pairedRead1]);
  useEffect(() => {
    if (singleRead) {
      setCurrentSampleId(getDefaultSampleIdFromPath(singleRead));
    }
  }, [singleRead]);

  const handlePairedLibraryAdd = () => {
    const { sampleId, sampleLevelDate } = resolveSampleIdAndDate(
      currentSampleId,
      currentSampleDate,
      pairedRead1 ?? undefined
    );
    addPairedLibrary({
      read1: pairedRead1,
      read2: pairedRead2,
      buildLibrary: getPairedLibraryBuildFn(sampleId, sampleLevelDate),
      onError: (msg) => handleLibraryErrorUtil(msg, toast),
      onAfterAdd: () => {
        setPairedRead1(null);
        setPairedRead2(null);
        setCurrentSampleId("");
      },
    });
  };

  const handleSingleLibraryAdd = () => {
    const { sampleId, sampleLevelDate } = resolveSampleIdAndDate(
      currentSampleId,
      currentSampleDate,
      singleRead ?? undefined
    );
    addSingleLibrary({
      read: singleRead,
      buildLibrary: getSingleLibraryBuildFn(sampleId, sampleLevelDate),
      duplicateMatcher: singleLibraryDuplicateMatcher,
      onError: (msg) => handleLibraryErrorUtil(msg, toast),
      onAfterAdd: () => {
        setSingleRead(null);
        setCurrentSampleId("");
      },
    });
  };

  const handleSetSelectedLibraries = (libs: Library[]) => {
    const newSraLibs = findNewSraLibraries(libs, selectedLibraries);
    setLibrariesAndSync(libs);
    if (newSraLibs.length > 0) {
      setCurrentSampleId("");
      setCurrentSampleDate("");
    }
  };

  const handleSraAccessionChange = (value: string) => {
    if (value.trim()) {
      setCurrentSampleId(getDefaultSampleIdFromSrr(value.trim()));
    }
  };

  const handleReset = () => {
    form.reset(
      { ...defaultSarsCov2WastewaterAnalysisFormValues },
      { keepDefaultValues: false }
    );
    setLibrariesAndSync([]);
    setPairedRead1(null);
    setPairedRead2(null);
    setSingleRead(null);
    setCurrentSampleId("");
    setCurrentSampleDate("");
    setSraResetKey((k) => k + 1);
  };

  const {
    handleSubmit,
    showParamsDialog,
    setShowParamsDialog,
    currentParams,
    serviceName,
    isSubmitting,
  } = useServiceFormSubmission<SarsCov2WastewaterAnalysisFormData>({
    serviceName: "SARS2Wastewater",
    displayName: "SARS-CoV-2 Wastewater Analysis",
    transformParams: transformSarsCov2WastewaterParams,
    onSuccess: handleReset,
  });

  return (
    <section>
      <ServiceHeader
        title="SARS-CoV-2 Wastewater Analysis"
        description="The SARS-CoV-2 Wastewater Analysis assembles raw reads with the Sars One Codex pipeline and performs variant analysis with Freyja."
        infoPopupTitle={sarsCov2WastewaterAnalysisInfo.title}
        infoPopupDescription={sarsCov2WastewaterAnalysisInfo.description}
        quickReferenceGuide={quickReference}
        tutorial={tutorial}
      />

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="grid grid-cols-1 gap-6 md:grid-cols-12"
        >
          {/* Input Library */}
          <div className="md:col-span-6">
            <Card>
              <CardHeader className="service-card-header">
                <RequiredFormCardTitle className="service-card-title">
                  Input Library Selection
                  <DialogInfoPopup
                    title={sarsCov2WastewaterAnalysisInputLib.title}
                    description={sarsCov2WastewaterAnalysisInputLib.description}
                    sections={sarsCov2WastewaterAnalysisInputLib.sections}
                  />
                </RequiredFormCardTitle>
                <CardDescription className="text-xs">
                  Send to selected libraries using the arrow buttons.
                </CardDescription>
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
                </div>

                <SraRunAccessionWithValidation
                  key={sraResetKey}
                  title="SRA Run Accession"
                  placeholder="SRR..."
                  selectedLibraries={selectedLibraries}
                  setSelectedLibraries={handleSetSelectedLibraries}
                  allowDuplicates={false}
                  onChange={handleSraAccessionChange}
                />

                <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
                  <div className="flex-1 space-y-2">
                    <Label className="service-card-label">Primers</Label>
                    <FormField
                      control={form.control}
                      name="primers"
                      render={({ field }) => (
                        <FormItem>
                          <Select
                            value={field.value}
                            onValueChange={(v) =>
                              field.onChange(v as Primers)
                            }
                          >
                            <SelectTrigger className="service-card-select-trigger">
                              <SelectValue placeholder="Select primers" />
                            </SelectTrigger>
                            <SelectContent>
                              {primerOptions.map((opt) => (
                                <SelectItem
                                  key={opt.value}
                                  value={opt.value}
                                >
                                  {opt.label}
                                </SelectItem>
                              ))}
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
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger className="service-card-select-trigger">
                              <SelectValue placeholder="Version" />
                            </SelectTrigger>
                            <SelectContent>
                              {primerVersionOpts.map((opt) => (
                                <SelectItem
                                  key={opt.value}
                                  value={opt.value}
                                >
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="service-card-label">
                    Sample Identifier
                  </Label>
                  <Input
                    className="service-card-input"
                    placeholder="SAMPLE ID"
                    value={currentSampleId}
                    onChange={(e) => setCurrentSampleId(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="service-card-label">
                    Sample Date (optional)
                  </Label>
                  <Input
                    className="service-card-input"
                    placeholder="MM/DD/YYYY"
                    value={currentSampleDate}
                    onChange={(e) => setCurrentSampleDate(e.target.value)}
                  />
                </div>

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

          {/* Selected Libraries */}
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

          {/* Parameters */}
          <div className="md:col-span-12">
            <Card>
              <CardHeader className="service-card-header">
                <RequiredFormCardTitle className="service-card-title">
                  Parameters
                  <DialogInfoPopup
                    title={sarsCov2WastewaterAnalysisParameters.title}
                    sections={sarsCov2WastewaterAnalysisParameters.sections}
                  />
                </RequiredFormCardTitle>
              </CardHeader>
              <CardContent className="service-card-content space-y-4">
                <div className="space-y-2">
                  <Label className="service-card-label">Strategy</Label>
                  <FormField
                    control={form.control}
                    name="recipe"
                    render={({ field }) => (
                      <FormItem>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger className="service-card-select-trigger">
                            <SelectValue placeholder="Select strategy" />
                          </SelectTrigger>
                          <SelectContent>
                            {recipeOptions.map((opt) => (
                              <SelectItem
                                key={opt.value}
                                value={opt.value}
                              >
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
                  <FormField
                    control={form.control}
                    name="output_path"
                    render={({ field }) => (
                      <FormItem className="flex-1">
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
                      <FormItem className="flex-1">
                        <FormControl>
                          <OutputFolder
                            variant="name"
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
                  isSubmitting ||
                  !form.formState.isValid ||
                  !isOutputNameValid
                }
              >
                {isSubmitting ? (
                  <Spinner className="mr-2 h-4 w-4" />
                ) : null}
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
