"use client";

import { useState, useEffect, useRef } from "react";
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

import { useServiceRuntime } from "@/hooks/services/use-service-runtime";
import {
  assignSampleIdToNewSraLibraries,
  extractSampleIdFromPath,
  mapLibraryToSampleIdItem,
  mapSraLibraryToSampleIdItem,
} from "@/lib/forms/service-library-rules";
import {
  taxonomyClassificationInfo,
  taxonomyClassificationInput,
  taxonomyClassificationParameters,
  taxonomyClassificationAnalysisType,
  taxonomyClassificationDatabase,
  taxonomyClassificationFilterHostReads,
  taxonomyClassificatioConfidenceInterval,
} from "@/lib/services/info/taxonomic-classification";

import {
  taxonomicClassificationFormSchema,
  defaultTaxonomicClassificationFormValues,
  wgsAnalysisTypeOptions,
  sixteenSAnalysisTypeOptions,
  wgsDatabaseOptions,
  sixteenSDatabaseOptions,
  hostGenomeOptions,
  confidenceIntervalOptions,
  type TaxonomicClassificationFormData,
  type LibraryItem,
} from "@/lib/forms/(metagenomics)/taxonomic-classification/taxonomic-classification-form-schema";
import {
  getDefaultAnalysisType,
  getDefaultDatabase,
  isHostFilteringAvailable,
  isAnalysisTypeSelectable,
} from "@/lib/forms/(metagenomics)/taxonomic-classification/taxonomic-classification-form-utils";
import { taxonomicClassificationService } from "@/lib/forms/(metagenomics)/taxonomic-classification/taxonomic-classification-service";
import {
  findNewSraLibraries,
  getPairedLibraryName,
  getSingleLibraryName,
  useTanstackLibrarySelection,
} from "@/lib/forms/tanstack-library-selection";
import { getLibraryTypeLabel } from "@/lib/forms/shared-schemas";

import type { WorkspaceObject } from "@/lib/services/workspace/types";
import type { Library } from "@/types/services";

export default function TaxonomicClassificationPage() {
  // Read input state
  const [pairedRead1, setPairedRead1] = useState<string | null>(null);
  const [pairedRead2, setPairedRead2] = useState<string | null>(null);
  const [singleRead, setSingleRead] = useState<string | null>(null);
  const [sraResetKey, setSraResetKey] = useState(0);

  // Sample identifiers (default from selection, editable)
  const [pairedSampleId, setPairedSampleId] = useState("");
  const [singleSampleId, setSingleSampleId] = useState("");
  const [srrSampleId, setSrrSampleId] = useState("");

  const [isOutputNameValid, setIsOutputNameValid] = useState(true);

  // Track if this is the initial mount to avoid triggering validation on load
  const isInitialMount = useRef(true);

  const form = useForm({
    defaultValues: defaultTaxonomicClassificationFormValues as TaxonomicClassificationFormData,
    validators: { onChange: taxonomicClassificationFormSchema },
    onSubmit: async ({ value }) => {
      await runtime.submitFormData(value as TaxonomicClassificationFormData);
    },
  });

  const outputPath = useStore(form.store, (s) => s.values.output_path);
  const sequenceType = useStore(form.store, (s) => s.values.sequence_type);
  const canSubmit = useStore(form.store, (s) => s.canSubmit);

  // Update analysis type and database when sequence type changes
  useEffect(() => {
    const newAnalysisType = getDefaultAnalysisType(sequenceType);
    const newDatabase = getDefaultDatabase(sequenceType);

    form.setFieldValue(
      "analysis_type",
      newAnalysisType as "microbiome" | "pathogen" | "default",
    );
    form.setFieldValue(
      "database",
      newDatabase as "bvbrc" | "standard" | "SILVA" | "Greengenes",
    );

    // Reset host genome when switching to 16S
    if (sequenceType === "16s") {
      form.setFieldValue("host_genome", "no_host");
    }

    // Only skip on initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
    }
  }, [sequenceType, form]);

  const {
    selectedLibraries,
    addPairedLibrary,
    addSingleLibrary,
    removeLibrary,
    setLibrariesAndSync,
    syncLibrariesToForm,
  } = useTanstackLibrarySelection<
    LibraryItem,
    { srr_accession: string; sample_id: string; title?: string }
  >({
    form,
    mapLibraryToItem: mapLibraryToSampleIdItem,
    mapSraLibraryToItem: mapSraLibraryToSampleIdItem,
    fields: {
      paired: "paired_end_libs",
      single: "single_end_libs",
      srr: "srr_libs",
    },
    normalizeLibraries: (nextLibraries, previousLibraries) =>
      assignSampleIdToNewSraLibraries(
        nextLibraries,
        previousLibraries,
        srrSampleId,
      ),
  });

  const handleReset = () => {
    form.reset(defaultTaxonomicClassificationFormValues);
    setLibrariesAndSync([]);
    setPairedRead1(null);
    setPairedRead2(null);
    setSingleRead(null);
    setPairedSampleId("");
    setSingleSampleId("");
    setSrrSampleId("");
    setSraResetKey((k) => k + 1);
  };

  const runtime = useServiceRuntime({
    definition: taxonomicClassificationService,
    form,
    onSuccess: handleReset,
    rerun: {
      libraries: ["paired", "single", "sra"],
      getLibraryExtra: (lib, kind) => {
        if (kind === "paired") {
          return {
            sampleId:
              lib.sample_id || extractSampleIdFromPath(lib.read1, "sample"),
          };
        }
        if (kind === "single") {
          return {
            sampleId:
              lib.sample_id || extractSampleIdFromPath(lib.read, "sample"),
          };
        }
        return { sampleId: lib.sample_id || "" };
      },
      syncLibraries: (libs) => {
        syncLibrariesToForm(libs);
        setLibrariesAndSync(libs);
      },
    },
  });
  const { isSubmitting, jobParamsDialogProps } = runtime;

  const handlePairedLibraryAdd = () => {
    addPairedLibrary({
      read1: pairedRead1,
      read2: pairedRead2,
      buildLibrary: (read1, read2, id) => {
        const defaultSampleId = extractSampleIdFromPath(read1, "sample");
        const librarySampleId = pairedSampleId.trim() || defaultSampleId;
        return {
          library: {
            id,
            name: getPairedLibraryName(read1, read2),
            type: "paired",
            files: [read1, read2],
            sampleId: librarySampleId,
          },
        };
      },
      onError: toast.error,
      onAfterAdd: (library) => {
        const fallbackSampleId = library.files?.[0]
          ? extractSampleIdFromPath(library.files[0], "sample")
          : "sample";
        form.setFieldValue(
          "paired_sample_id",
          pairedSampleId.trim() || fallbackSampleId,
        );
        setPairedRead1(null);
        setPairedRead2(null);
        setPairedSampleId("");
      },
    });
  };

  const handleSingleLibraryAdd = () => {
    addSingleLibrary({
      read: singleRead,
      buildLibrary: (read) => {
        const defaultSampleId = extractSampleIdFromPath(read, "sample");
        const librarySampleId = singleSampleId.trim() || defaultSampleId;
        return {
          library: {
            id: read,
            name: getSingleLibraryName(read),
            type: "single",
            files: [read],
            sampleId: librarySampleId,
          },
        };
      },
      onError: toast.error,
      onAfterAdd: (library) => {
        const fallbackSampleId = library.files?.[0]
          ? extractSampleIdFromPath(library.files[0], "sample")
          : "sample";
        form.setFieldValue(
          "single_sample_id",
          singleSampleId.trim() || fallbackSampleId,
        );
        setSingleRead(null);
        setSingleSampleId("");
      },
    });
  };

  // Unified handler for sample ID changes - updates both local state and form field
  const handleSampleIdChange = (
    type: "paired" | "single" | "srr",
    value: string,
  ) => {
    const config = {
      paired: { setter: setPairedSampleId, field: "paired_sample_id" as const },
      single: { setter: setSingleSampleId, field: "single_sample_id" as const },
      srr: { setter: setSrrSampleId, field: "srr_sample_id" as const },
    };
    config[type].setter(value);
    form.setFieldValue(config[type].field, value);
  };

  // When SRA/libs are updated, assign sample_id to newly added SRA entries
  const handleSetSelectedLibraries = (libs: Library[]) => {
    const newSraLibs = findNewSraLibraries(libs, selectedLibraries);
    setLibrariesAndSync(libs);

    // Set top-level sample ID form field and clear the textbox after adding SRA libs
    if (newSraLibs.length > 0) {
      const lastNewSra = newSraLibs[newSraLibs.length - 1];
      const defaultSampleId = srrSampleId.trim() || lastNewSra.id;
      // Update form field for submission
      form.setFieldValue("srr_sample_id", defaultSampleId);
      // Clear the sample ID textbox after adding
      setSrrSampleId("");
    }
  };

  // Get current options based on sequence type
  const analysisTypeOptions =
    sequenceType === "wgs"
      ? wgsAnalysisTypeOptions
      : sixteenSAnalysisTypeOptions;

  const databaseOptions =
    sequenceType === "wgs" ? wgsDatabaseOptions : sixteenSDatabaseOptions;

  return (
    <section>
      <ServiceHeader
        title="Taxonomic Classification"
        description="The Taxonomic Classification Service computes taxonomic classification for read data."
        infoPopupTitle={taxonomyClassificationInfo.title}
        infoPopupDescription={taxonomyClassificationInfo.description}
        quickReferenceGuide="https://www.bv-brc.org/docs/quick_references/services/taxonomic_classification_service.html"
        tutorial="https://www.bv-brc.org/docs/tutorial/taxonomic_classification/taxonomic_classification.html"
        instructionalVideo="https://youtu.be/PsqHeZ8pvt4"
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="grid grid-cols-1 gap-6 md:grid-cols-12"
      >
        {/* Input File Section */}
        <div className="md:col-span-7">
          <Card className="h-full">
            <CardHeader className="service-card-header">
              <RequiredFormCardTitle className="service-card-title">
                Input File
                <DialogInfoPopup
                  title={taxonomyClassificationInput.title}
                  description={taxonomyClassificationInput.description}
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
                      setPairedSampleId(extractSampleIdFromPath(object.path));
                    }}
                  />
                  <WorkspaceObjectSelector
                    types={["reads"]}
                    placeholder="Select READ FILE 2..."
                    value={pairedRead2 ?? ""}
                    onObjectSelect={(object: WorkspaceObject) => {
                      setPairedRead2(object.path);
                      if (!pairedRead1) {
                        setPairedSampleId(
                          extractSampleIdFromPath(object.path),
                        );
                      }
                    }}
                  />
                </div>
                <div>
                  <Label className="service-card-sublabel">
                    Sample Identifier
                  </Label>
                  <Input
                    value={pairedSampleId}
                    onChange={(e) =>
                      handleSampleIdChange("paired", e.target.value)
                    }
                    placeholder="Sample ID"
                    className="service-card-input mt-1.5 font-mono text-sm"
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
                    setSingleSampleId(extractSampleIdFromPath(object.path));
                  }}
                />
                <div>
                  <Label className="service-card-sublabel">
                    Sample Identifier
                  </Label>
                  <Input
                    value={singleSampleId}
                    onChange={(e) =>
                      handleSampleIdChange("single", e.target.value)
                    }
                    placeholder="Sample ID"
                    className="service-card-input mt-1.5 font-mono text-sm"
                  />
                </div>
              </div>

              {/* SRA Run Accession */}
              <SraRunAccessionWithValidation
                key={sraResetKey}
                title="SRA Run Accession"
                placeholder="SRR..."
                selectedLibraries={selectedLibraries}
                setSelectedLibraries={handleSetSelectedLibraries}
                onChange={(value) => {
                  // Auto-populate sample identifier as user types SRA accession
                  setSrrSampleId(value);
                }}
                allowDuplicates={false}
              />
              <div>
                <Label className="service-card-sublabel">
                  Sample Identifier
                </Label>
                <Input
                  value={srrSampleId}
                  onChange={(e) =>
                    handleSampleIdChange("srr", e.target.value)
                  }
                  placeholder="Sample ID"
                  className="service-card-input mt-1.5 font-mono text-sm"
                />
              </div>

              <form.Field name="paired_end_libs">
                {(field) => (
                  <FieldErrors field={field} />
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
              />
            </CardContent>
          </Card>
        </div>

        {/* Parameters Section */}
        <div className="md:col-span-12">
          <Card>
            <CardHeader className="service-card-header">
              <RequiredFormCardTitle className="service-card-title">
                Parameters
                <DialogInfoPopup
                  title={taxonomyClassificationParameters.title}
                  description={taxonomyClassificationParameters.description}
                  sections={taxonomyClassificationParameters.sections}
                />
              </RequiredFormCardTitle>
            </CardHeader>

            <CardContent>
              <div className="space-y-6">
                {/* Sequencing Type */}
                <div className="w-full">
                  <form.Field name="sequence_type">
                    {(field) => (
                      <FieldItem>
                        <FieldLabel field={field} className="service-card-label">
                          Sequencing Type
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <HelpCircle className="service-card-tooltip-icon ml-2" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>
                                  Select the sequencing type according to your
                                  input reads
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </FieldLabel>

                        <RadioGroup
                          value={field.state.value}
                          onValueChange={(value) => value != null && field.handleChange(value as TaxonomicClassificationFormData["sequence_type"])}
                          className="service-radio-group-horizontal"
                        >
                          <div className="flex items-center gap-3">
                            <RadioGroupItem value="wgs" id="wgs" />
                            <Label htmlFor="wgs" className="text-sm">
                              Whole Genome Sequencing (WGS)
                            </Label>
                          </div>
                          <div className="flex items-center gap-3">
                            <RadioGroupItem value="16s" id="16s" />
                            <Label htmlFor="16s" className="text-sm">
                              16S Ribosomal RNA
                            </Label>
                          </div>
                        </RadioGroup>
                        <FieldErrors field={field} />
                      </FieldItem>
                    )}
                  </form.Field>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  {/* Analysis Type */}
                  <div className="service-card-content-grid-item">
                    <form.Field name="analysis_type">
                      {(field) => (
                        <FieldItem>
                          <FieldLabel field={field} className="service-card-label">
                            Analysis Type
                            <DialogInfoPopup
                              title={taxonomyClassificationAnalysisType.title}
                              description={
                                taxonomyClassificationAnalysisType.description
                              }
                              sections={
                                taxonomyClassificationAnalysisType.sections
                              }
                              className="ml-2"
                            />
                          </FieldLabel>
                          <Select
                            items={analysisTypeOptions}
                            value={field.state.value}
                            onValueChange={(value) => value != null && field.handleChange(value as TaxonomicClassificationFormData["analysis_type"])}
                            disabled={
                              !isAnalysisTypeSelectable(sequenceType)
                            }
                          >
                            <SelectTrigger className="service-card-select-trigger">
                              <SelectValue placeholder="Select analysis type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {analysisTypeOptions.map((option) => (
                                  <SelectItem
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
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

                  {/* Database */}
                  <div className="service-card-content-grid-item">
                    <form.Field name="database">
                      {(field) => (
                        <FieldItem>
                          <FieldLabel field={field} className="service-card-label">
                            Database
                            <DialogInfoPopup
                              title={taxonomyClassificationDatabase.title}
                              description={
                                taxonomyClassificationDatabase.description
                              }
                              sections={
                                taxonomyClassificationDatabase.sections
                              }
                              className="ml-2"
                            />
                          </FieldLabel>
                          <Select
                            items={databaseOptions}
                            value={field.state.value}
                            onValueChange={(value) => value != null && field.handleChange(value as TaxonomicClassificationFormData["database"])}
                          >
                            <SelectTrigger className="service-card-select-trigger">
                              <SelectValue placeholder="Select database" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {databaseOptions.map((option) => (
                                  <SelectItem
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
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

                  {/* Filter Host Reads */}
                  <div className="service-card-content-grid-item">
                    <form.Field name="host_genome">
                      {(field) => (
                        <FieldItem>
                          <FieldLabel field={field} className="service-card-label">
                            Filter Host Reads
                            <DialogInfoPopup
                              title={
                                taxonomyClassificationFilterHostReads.title
                              }
                              description={
                                taxonomyClassificationFilterHostReads.description
                              }
                              className="ml-2"
                            />
                          </FieldLabel>
                          <Select
                            items={hostGenomeOptions}
                            value={field.state.value}
                            onValueChange={(value) => value != null && field.handleChange(value as TaxonomicClassificationFormData["host_genome"])}
                            disabled={
                              !isHostFilteringAvailable(sequenceType)
                            }
                          >
                            <SelectTrigger className="service-card-select-trigger">
                              <SelectValue placeholder="Select filter option" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {hostGenomeOptions.map((option) => (
                                  <SelectItem
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
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

                  {/* Confidence Interval */}
                  <div className="service-card-content-grid-item">
                    <form.Field name="confidence_interval">
                      {(field) => (
                        <FieldItem>
                          <FieldLabel field={field} className="service-card-label">
                            Confidence Interval
                            <DialogInfoPopup
                              title={
                                taxonomyClassificatioConfidenceInterval.title
                              }
                              description={
                                taxonomyClassificatioConfidenceInterval.description
                              }
                              className="ml-2"
                            />
                          </FieldLabel>
                          <Select
                            items={confidenceIntervalOptions}
                            value={field.state.value}
                            onValueChange={(value) => value != null && field.handleChange(value)}
                          >
                            <SelectTrigger className="service-card-select-trigger">
                              <SelectValue placeholder="Select confidence interval" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {confidenceIntervalOptions.map(
                                  (option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ),
                                )}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                          <FieldErrors field={field} />
                        </FieldItem>
                      )}
                    </form.Field>
                  </div>

                  {/* Save Classified Sequences */}
                  <div className="service-card-content-grid-item">
                    <form.Field name="save_classified_sequences">
                      {(field) => (
                        <FieldItem>
                          <FieldLabel field={field} className="service-card-label">
                            Save Classified Sequences
                          </FieldLabel>
                          <RadioGroup
                            value={field.state.value ? "yes" : "no"}
                            onValueChange={(value) =>
                              value != null && field.handleChange(value === "yes")
                            }
                            className="service-radio-group-horizontal"
                          >
                            <div className="flex items-center gap-3">
                              <RadioGroupItem
                                value="no"
                                id="classified-no"
                              />
                              <Label
                                htmlFor="classified-no"
                                className="text-sm"
                              >
                                No
                              </Label>
                            </div>
                            <div className="flex items-center gap-3">
                              <RadioGroupItem
                                value="yes"
                                id="classified-yes"
                              />
                              <Label
                                htmlFor="classified-yes"
                                className="text-sm"
                              >
                                Yes
                              </Label>
                            </div>
                          </RadioGroup>
                          <FieldErrors field={field} />
                        </FieldItem>
                      )}
                    </form.Field>
                  </div>

                  {/* Save Unclassified Sequences */}
                  <div className="service-card-content-grid-item">
                    <form.Field name="save_unclassified_sequences">
                      {(field) => (
                        <FieldItem>
                          <FieldLabel field={field} className="service-card-label">
                            Save Unclassified Sequences
                          </FieldLabel>
                          <RadioGroup
                            value={field.state.value ? "yes" : "no"}
                            onValueChange={(value) =>
                              value != null && field.handleChange(value === "yes")
                            }
                            className="service-radio-group-horizontal"
                          >
                            <div className="flex items-center gap-3">
                              <RadioGroupItem
                                value="no"
                                id="unclassified-no"
                              />
                              <Label
                                htmlFor="unclassified-no"
                                className="text-sm"
                              >
                                No
                              </Label>
                            </div>
                            <div className="flex items-center gap-3">
                              <RadioGroupItem
                                value="yes"
                                id="unclassified-yes"
                              />
                              <Label
                                htmlFor="unclassified-yes"
                                className="text-sm"
                              >
                                Yes
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
