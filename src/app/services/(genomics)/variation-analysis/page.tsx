"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
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
import { Library } from "@/types/services";
import { JobParamsDialog } from "@/components/services/job-params-dialog";
import { useServiceFormSubmission } from "@/hooks/services/use-service-form-submission";
import { toast } from "sonner";
import {
  variationAnalysisFormSchema,
  DEFAULT_VARIATION_ANALYSIS_FORM_VALUES,
  type VariationAnalysisFormData,
  type VariationLibraryItem,
  transformVariationAnalysisParams,
} from "@/lib/forms/(genomics)";
import { submitServiceJob } from "@/lib/services/service-utils";
import {
  RequiredFormCardTitle,
  RequiredFormLabel,
} from "@/components/forms/required-form-components";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import { WorkspaceObject } from "@/lib/workspace-client";
import { SingleGenomeSelector } from "@/components/services/single-genome-selector";
import { Spinner } from "@/components/ui/spinner";

export default function VariationAnalysisPage() {
  const [selectedLibraries, setSelectedLibraries] = useState<Library[]>([]);
  const [pairedRead1, setPairedRead1] = useState<string | null>(null);
  const [pairedRead2, setPairedRead2] = useState<string | null>(null);
  const [singleRead, setSingleRead] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOutputNameValid, setIsOutputNameValid] = useState(true);

  const form = useForm<VariationAnalysisFormData>({
    resolver: zodResolver(variationAnalysisFormSchema),
    defaultValues: DEFAULT_VARIATION_ANALYSIS_FORM_VALUES,
    mode: "onChange",
  });

  // Setup service debugging and form submission
  const {
    handleSubmit,
    showParamsDialog,
    setShowParamsDialog,
    currentParams,
    serviceName,
  } = useServiceFormSubmission<VariationAnalysisFormData>({
    serviceName: "Variation Analysis",
    transformParams: transformVariationAnalysisParams,
    onSubmit: async (data) => {
      console.log("Submitting Variation Analysis job with data:", data);

      // Validate that at least one library is provided
      const hasPaired = data.paired_end_libs && data.paired_end_libs.length > 0;
      const hasSingle = data.single_end_libs && data.single_end_libs.length > 0;
      const hasSrr = data.srr_ids && data.srr_ids.length > 0;

      if (!hasPaired && !hasSingle && !hasSrr) {
        toast.error("At least one library must be selected");
        return;
      }

      try {
        setIsSubmitting(true);
        // Submit the Variation Analysis job using the utility function
        const result = await submitServiceJob(
          "Variation",
          transformVariationAnalysisParams(data),
        );

        if (result.success) {
          console.log("Variation Analysis job submitted successfully:", result.job[0]);

          // Show success message
          toast.success("Variation Analysis job submitted successfully!", {
            description: `Job ID: ${result.job[0].id}`,
          });

          // Reset form after successful submission
          handleReset();
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        console.error("Failed to submit Variation Analysis job:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Failed to submit Variation Analysis job";
        toast.error("Submission failed", {
          description: errorMessage,
        });
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  const handleReset = () => {
    form.reset(DEFAULT_VARIATION_ANALYSIS_FORM_VALUES);
    setSelectedLibraries([]);
    setPairedRead1(null);
    setPairedRead2(null);
    setSingleRead(null);
  };

  // Convert Library to VariationLibraryItem for form submission
  const convertLibraryToLibraryItem = (library: Library): VariationLibraryItem => {
    const baseLib: VariationLibraryItem = {
      _id: library.id,
      _type: library.type === "paired" ? "paired" : library.type === "single" ? "single" : "srr_accession",
    };

    // Add type-specific fields from library metadata
    if (library.type === "paired" && library.files) {
      baseLib.read1 = library.files[0];
      baseLib.read2 = library.files[1];
    } else if (library.type === "single" && library.files) {
      baseLib.read = library.files[0];
    }

    return baseLib;
  };

  // Sync selectedLibraries with form data
  const syncLibrariesToForm = (libraries: Library[]) => {
    const pairedLibs: VariationLibraryItem[] = [];
    const singleLibs: VariationLibraryItem[] = [];
    const srrIds: string[] = [];

    libraries.forEach((lib) => {
      if (lib.type === "paired") {
        pairedLibs.push(convertLibraryToLibraryItem(lib));
      } else if (lib.type === "single") {
        singleLibs.push(convertLibraryToLibraryItem(lib));
      } else if (lib.type === "sra") {
        srrIds.push(lib.id);
      }
    });

    form.setValue("paired_end_libs", pairedLibs, { shouldValidate: true });
    form.setValue("single_end_libs", singleLibs, { shouldValidate: true });
    form.setValue("srr_ids", srrIds, { shouldValidate: true });
    // Trigger full form validation to check refine rules
    setTimeout(() => {
      form.trigger();
    }, 0);
  };

  const handlePairedLibraryAdd = () => {
    if (!pairedRead1 || !pairedRead2) {
      toast.error("Both read files must be selected for paired library");
      return;
    }

    if (pairedRead1 === pairedRead2) {
      toast.error("READ FILE 1 and READ FILE 2 cannot be the same");
      return;
    }

    const newLibrary: Library = {
      id: `${pairedRead1}${pairedRead2}`,
      name: `P(${pairedRead1.split("/").pop()}, ${pairedRead2.split("/").pop()})`,
      type: "paired",
      files: [pairedRead1, pairedRead2],
    };

    const newLibraries = [...selectedLibraries, newLibrary];
    setSelectedLibraries(newLibraries);
    syncLibrariesToForm(newLibraries);

    // Clear the inputs
    setPairedRead1(null);
    setPairedRead2(null);
  };

  const handleSingleLibraryAdd = () => {
    if (!singleRead) {
      toast.error("Read file must be selected");
      return;
    }

    const newLibrary: Library = {
      id: singleRead,
      name: `S(${singleRead.split("/").pop()})`,
      type: "single",
      files: [singleRead],
    };

    const newLibraries = [...selectedLibraries, newLibrary];
    setSelectedLibraries(newLibraries);
    syncLibrariesToForm(newLibraries);

    // Clear the input
    setSingleRead(null);
  };

  const handleRemoveLibrary = (id: string) => {
    const newLibraries = selectedLibraries.filter((lib) => lib.id !== id);
    setSelectedLibraries(newLibraries);
    syncLibrariesToForm(newLibraries);
  };

  return (
    <section>
      <ServiceHeader
        title="Variation Analysis"
        description="The Variation Analysis Service can be used to identify and annotate sequence variations."
        infoPopupTitle={variationAnalysisInfo.title}
        infoPopupDescription={variationAnalysisInfo.description}
        quickReferenceGuide="#"
        tutorial="#"
        instructionalVideo="#"
      />

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
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
                  title="SRA Run Accession"
                  placeholder="SRR..."
                  selectedLibraries={selectedLibraries}
                  setSelectedLibraries={(libs) => {
                    setSelectedLibraries(libs);
                    syncLibrariesToForm(libs);
                  }}
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
                    onRemove={handleRemoveLibrary}
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
                  <FormField
                    control={form.control}
                    name="reference_genome_id"
                    render={({ field }) => (
                      <FormItem>
                        <RequiredFormLabel>Target Genome</RequiredFormLabel>
                        <FormControl>
                          <SingleGenomeSelector
                            value={field.value ?? ""}
                            onChange={(genomeId) => {
                              field.onChange(genomeId);
                              // Trigger validation after genome is selected
                              setTimeout(() => {
                                form.trigger("reference_genome_id");
                                // Also trigger full form validation for refine rules
                                form.trigger();
                              }, 0);
                            }}
                            placeholder="e.g. Mycobacterium tuberculosis H37Rv"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Aligner */}
                  <FormField
                    control={form.control}
                    name="mapper"
                    render={({ field }) => (
                      <FormItem>
                        <RequiredFormLabel>Aligner</RequiredFormLabel>
                        <FormControl>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger className="service-card-select-trigger">
                              <SelectValue placeholder="Select aligner" />
                            </SelectTrigger>
                            <SelectContent className="service-card-select-content">
                              <SelectItem value="BWA-mem">BWA-mem</SelectItem>
                              <SelectItem value="BWA-mem-strict">BWA-mem-strict</SelectItem>
                              <SelectItem value="Bowtie2">Bowtie2</SelectItem>
                              <SelectItem value="LAST">LAST</SelectItem>
                              <SelectItem value="minimap2">minimap2</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* SNP Caller */}
                  <FormField
                    control={form.control}
                    name="caller"
                    render={({ field }) => (
                      <FormItem>
                        <RequiredFormLabel>SNP Caller</RequiredFormLabel>
                        <FormControl>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger className="service-card-select-trigger">
                              <SelectValue placeholder="Select SNP caller" />
                            </SelectTrigger>
                            <SelectContent className="service-card-select-content">
                              <SelectItem value="FreeBayes">FreeBayes</SelectItem>
                              <SelectItem value="BCFtools">BCFtools</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Output Folder */}
                  <FormField
                    control={form.control}
                    name="output_path"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <OutputFolder
                            required={true}
                            value={field.value}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Output Name */}
                  <FormField
                    control={form.control}
                    name="output_file"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <OutputFolder
                            variant="name"
                            required={true}
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
                  onRemove={handleRemoveLibrary}
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
              <Button type="submit" disabled={isSubmitting || !form.formState.isValid || !isOutputNameValid}>
                {isSubmitting ? <Spinner /> : null}
                Submit
              </Button>
            </div>
          </div>
        </form>
      </Form>

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
