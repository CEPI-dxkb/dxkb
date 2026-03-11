"use client";

import { useState, useEffect } from "react";
import { useForm, useStore } from "@tanstack/react-form";
import { FieldItem, FieldErrors } from "@/components/ui/tanstack-form";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle, ChevronRight } from "lucide-react";
import {
  variationAnalysisInfo,
  variationAnalysisParameters,
  readInputFileInfo,
} from "@/lib/services/service-info";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import SraRunAccessionWithValidation from "@/components/services/sra-run-accession-with-validation";
import SelectedItemsTable from "@/components/services/selected-items-table";
import OutputFolder from "@/components/services/output-folder";
import { JobParamsDialog } from "@/components/services/job-params-dialog";
import { useServiceFormSubmission } from "@/hooks/services/use-service-form-submission";
import { useRerunForm } from "@/hooks/services/use-rerun-form";
import { buildPairedLibraries, buildSingleLibraries, buildSraLibraries } from "@/lib/rerun-utility";
import type { Library } from "@/types/services";
import { toast } from "sonner";
import {
  variationAnalysisFormSchema,
  DEFAULT_VARIATION_ANALYSIS_FORM_VALUES,
  type VariationAnalysisFormData,
  type VariationLibraryItem,
} from "@/lib/forms/(genomics)/variation-analysis/variation-analysis-form-schema";
import {
  transformVariationAnalysisParams,
  variationAnalysisMappers,
  variationAnalysisCallers,
} from "@/lib/forms/(genomics)/variation-analysis/variation-analysis-form-utils";
import {
  RequiredFormCardTitle,
  RequiredFormLabel,
} from "@/components/forms/required-form-components";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import { WorkspaceObject } from "@/lib/workspace-client";
import { SingleGenomeSelector } from "@/components/services/single-genome-selector";
import { Spinner } from "@/components/ui/spinner";
import {
  buildBaseLibraryItem,
  getPairedLibraryName,
  getSingleLibraryName,
  useTanstackLibrarySelection,
} from "@/lib/forms/tanstack-library-selection";

export default function VariationAnalysisPage() {
  const [pairedRead1, setPairedRead1] = useState<string | null>(null);
  const [pairedRead2, setPairedRead2] = useState<string | null>(null);
  const [singleRead, setSingleRead] = useState<string | null>(null);
  const [isOutputNameValid, setIsOutputNameValid] = useState(true);
  const [sraResetKey, setSraResetKey] = useState(0);

  const form = useForm({
    defaultValues: DEFAULT_VARIATION_ANALYSIS_FORM_VALUES,
    validators: { onChange: variationAnalysisFormSchema },
    onSubmit: async ({ value }) => {
      const data = value as VariationAnalysisFormData;

      // Validate that at least one library is provided
      const hasPaired = data.paired_end_libs && data.paired_end_libs.length > 0;
      const hasSingle = data.single_end_libs && data.single_end_libs.length > 0;
      const hasSrr = data.srr_ids && data.srr_ids.length > 0;

      if (!hasPaired && !hasSingle && !hasSrr) {
        toast.error("At least one library must be selected");
        return;
      }

      await handleSubmit(data);
    },
  });

  const {
    selectedLibraries,
    addPairedLibrary,
    addSingleLibrary,
    removeLibrary,
    setLibrariesAndSync,
    syncLibrariesToForm,
  } = useTanstackLibrarySelection<VariationLibraryItem>({
    form,
    mapLibraryToItem: buildBaseLibraryItem,
    fields: {
      paired: "paired_end_libs",
      single: "single_end_libs",
      srr: "srr_ids",
    },
  });

  // Rerun: pre-fill form from job parameters
  const { rerunData, markApplied } = useRerunForm<Record<string, unknown>>();

  useEffect(() => {
    if (!rerunData || !markApplied()) return;

    if (rerunData.output_path) form.setFieldValue("output_path", rerunData.output_path as never);
    if (rerunData.output_file) form.setFieldValue("output_file", rerunData.output_file as never);
    if (rerunData.reference_genome_id) form.setFieldValue("reference_genome_id", rerunData.reference_genome_id as never);
    if (rerunData.mapper) form.setFieldValue("mapper", rerunData.mapper as never);
    if (rerunData.caller) form.setFieldValue("caller", rerunData.caller as never);

    const libs: Library[] = [
      ...buildPairedLibraries(rerunData),
      ...buildSingleLibraries(rerunData),
      ...buildSraLibraries(rerunData),
    ];
    if (libs.length > 0) {
      syncLibrariesToForm(libs);
      setLibrariesAndSync(libs);
    }
  }, [rerunData, markApplied, form, syncLibrariesToForm, setLibrariesAndSync]);

  // Setup service debugging and form submission
  const {
    handleSubmit,
    showParamsDialog,
    setShowParamsDialog,
    currentParams,
    serviceName,
    isSubmitting,
  } = useServiceFormSubmission<VariationAnalysisFormData>({
    serviceName: "Variation",
    displayName: "Variation Analysis",
    transformParams: transformVariationAnalysisParams,
    onSuccess: handleReset,
  });

  function handleReset() {
    form.reset(DEFAULT_VARIATION_ANALYSIS_FORM_VALUES);
    setLibrariesAndSync([]);
    setPairedRead1(null);
    setPairedRead2(null);
    setSingleRead(null);
    setSraResetKey((k) => k + 1);
  }

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
      onError: (message) => toast.error(message),
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
      onError: (message) => toast.error(message),
      onAfterAdd: () => {
        setSingleRead(null);
      },
    });
  };

  const outputPath = useStore(form.store, (s) => s.values.output_path);
  const canSubmit = useStore(form.store, (s) => s.canSubmit);

  return (
    <section>
      <ServiceHeader
        title="Variation Analysis"
        description="The Variation Analysis Service can be used to identify and annotate sequence variations."
        infoPopupTitle={variationAnalysisInfo.title}
        infoPopupDescription={variationAnalysisInfo.description}
        quickReferenceGuide="https://www.bv-brc.org/docs/quick_references/services/variation_analysis_service.html"
        tutorial="https://www.bv-brc.org/docs/tutorial/variation_analysis/variation_analysis.html"
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
                Input File
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
                  <div className="bg-border mx-4 h-[1px] flex-1" />
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
                  <div className="bg-border mx-4 h-[1px] flex-1" />
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
                        <p>Files selected for analysis</p>
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
                  title={variationAnalysisParameters.title}
                  description={variationAnalysisParameters.description}
                  sections={variationAnalysisParameters.sections}
                />
              </CardTitle>
            </CardHeader>

            <CardContent className="service-card-content">
              <div className="space-y-6">
                {/* Target Genome */}
                <form.Field name="reference_genome_id">
                  {(field) => (
                    <FieldItem>
                      <RequiredFormLabel>Target Genome</RequiredFormLabel>
                      <SingleGenomeSelector
                        value={field.state.value ?? ""}
                        onChange={(genomeId) => {
                          field.handleChange(genomeId);
                        }}
                        placeholder="e.g. Mycobacterium tuberculosis H37Rv"
                      />
                      <FieldErrors field={field} />
                    </FieldItem>
                  )}
                </form.Field>

                {/* Aligner */}
                <form.Field name="mapper">
                  {(field) => (
                    <FieldItem>
                      <RequiredFormLabel>Aligner</RequiredFormLabel>
                      <Select
                        items={variationAnalysisMappers}
                        value={field.state.value}
                        onValueChange={(value) => value != null && field.handleChange(value)}
                      >
                        <SelectTrigger className="service-card-select-trigger">
                          <SelectValue placeholder="Select aligner" />
                        </SelectTrigger>
                        <SelectContent className="service-card-select-content">
                          <SelectGroup>
                            {variationAnalysisMappers.map((mapper) => (
                              <SelectItem key={mapper.value} value={mapper.value}>
                                {mapper.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <FieldErrors field={field} />
                    </FieldItem>
                  )}
                </form.Field>

                {/* SNP Caller */}
                <form.Field name="caller">
                  {(field) => (
                    <FieldItem>
                      <RequiredFormLabel>SNP Caller</RequiredFormLabel>
                      <Select
                        items={variationAnalysisCallers}
                        value={field.state.value}
                        onValueChange={(value) => value != null && field.handleChange(value)}
                      >
                        <SelectTrigger className="service-card-select-trigger">
                          <SelectValue placeholder="Select SNP caller" />
                        </SelectTrigger>
                        <SelectContent className="service-card-select-content">
                          <SelectGroup>
                            {variationAnalysisCallers.map((caller) => (
                              <SelectItem key={caller.value} value={caller.value}>
                                {caller.label}
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
                        onChange={field.handleChange}
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
                        onChange={field.handleChange}
                        outputFolderPath={outputPath}
                        onValidationChange={setIsOutputNameValid}
                      />
                      <FieldErrors field={field} />
                    </FieldItem>
                  )}
                </form.Field>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Selected Libraries (desktop) */}
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
                      <p>Files selected for analysis</p>
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
            <Button type="submit" disabled={isSubmitting || !canSubmit || !isOutputNameValid}>
              {isSubmitting ? <Spinner /> : null}
              Submit
            </Button>
          </div>
        </div>
      </form>

      {/* Job Params Dialog */}
      <JobParamsDialog
        open={showParamsDialog}
        onOpenChange={setShowParamsDialog}
        params={currentParams}
        serviceName={serviceName}
      />
    </section>
  );
}
