"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { submitServiceJob } from "@/lib/services/service-utils";
import {
  metagenomicReadMappingInfo,
  metagenomicReadMappingParameters,
  readInputFileInfo,
} from "@/lib/services/service-info";

import {
  metagenomicReadMappingFormSchema,
  DEFAULT_METAGENOMIC_READ_MAPPING_FORM_VALUES,
  PREDEFINED_GENE_SET_OPTIONS,
  type MetagenomicReadMappingFormData,
  type LibraryItem,
} from "@/lib/forms/(metagenomics)/metagenomic-read-mapping/metagenomic-read-mapping-form-schema";
import {
  transformMetagenomicReadMappingParams,
} from "@/lib/forms/(metagenomics)/metagenomic-read-mapping/metagenomic-read-mapping-form-utils";

import type { WorkspaceObject } from "@/lib/workspace-client";
import { Library } from "@/types/services";

export default function MetagenomicReadMappingPage() {
  const form = useForm<MetagenomicReadMappingFormData>({
    resolver: zodResolver(metagenomicReadMappingFormSchema),
    defaultValues: DEFAULT_METAGENOMIC_READ_MAPPING_FORM_VALUES,
    mode: "onChange",
  });

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Read input state
  const [selectedLibraries, setSelectedLibraries] = useState<Library[]>([]);
  const [pairedRead1, setPairedRead1] = useState<string | null>(null);
  const [pairedRead2, setPairedRead2] = useState<string | null>(null);
  const [singleRead, setSingleRead] = useState<string | null>(null);
  const [sraResetKey, setSraResetKey] = useState(0);

  // Watch form values
  const geneSetType = form.watch("gene_set_type");

  // Convert Library to LibraryItem for form submission
  const convertLibraryToLibraryItem = (library: Library): LibraryItem => {
    const baseLib: LibraryItem = {
      _id: library.id,
      _type:
        library.type === "paired"
          ? "paired"
          : library.type === "single"
            ? "single"
            : "srr_accession",
    };

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
    const pairedLibs: LibraryItem[] = [];
    const singleLibs: LibraryItem[] = [];
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

    // Update all library fields without individual validation
    form.setValue("paired_end_libs", pairedLibs, { shouldValidate: false });
    form.setValue("single_end_libs", singleLibs, { shouldValidate: false });
    form.setValue("srr_ids", srrIds, { shouldValidate: false });

    // Trigger validation on all library fields together
    form.trigger(["paired_end_libs", "single_end_libs", "srr_ids"]);
  };

  // Handle adding paired library
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

  // Handle adding single library
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

  // Handle removing a library
  const handleRemoveLibrary = (id: string) => {
    const newLibraries = selectedLibraries.filter((lib) => lib.id !== id);
    setSelectedLibraries(newLibraries);
    syncLibrariesToForm(newLibraries);
  };

  // Handle form reset
  const handleReset = () => {
    form.reset(
      { ...DEFAULT_METAGENOMIC_READ_MAPPING_FORM_VALUES },
      { keepDefaultValues: false }
    );
    setSelectedLibraries([]);
    setPairedRead1(null);
    setPairedRead2(null);
    setSingleRead(null);
    setSraResetKey((k) => k + 1);
  };

  // Setup service form submission
  const {
    handleSubmit,
    showParamsDialog,
    setShowParamsDialog,
    currentParams,
    serviceName,
  } = useServiceFormSubmission<MetagenomicReadMappingFormData>({
    serviceName: "MetagenomicReadMapping",
    transformParams: transformMetagenomicReadMappingParams,
    onSubmit: async (data) => {
      try {
        setIsSubmitting(true);
        const params = transformMetagenomicReadMappingParams(data);
        const result = await submitServiceJob("MetagenomicReadMapping", params);

        if (result.success) {
          toast.success("Metagenomic Read Mapping job submitted successfully!", {
            description: result.job?.[0]?.id
              ? `Job ID: ${result.job[0].id}`
              : "Job submitted successfully",
            closeButton: true,
          });
          handleReset();
        } else {
          throw new Error(result.error || "Failed to submit job");
        }
      } catch (error) {
        console.error("Failed to submit Metagenomic Read Mapping job:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Failed to submit job";
        toast.error("Submission failed", {
          description: errorMessage,
          closeButton: true,
        });
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  return (
    <section>
      <ServiceHeader
        title="Metagenomic Read Mapping"
        description="The Metagenomic Read Mapping Service uses KMA to align reads against
          antibiotic resistance genes from CARD and virulence factors from VFDB."
        infoPopupTitle={metagenomicReadMappingInfo.title}
        infoPopupDescription={metagenomicReadMappingInfo.description}
        quickReferenceGuide="https://www.bv-brc.org/docs/quick_references/services/metagenomic_read_mapping_service.html"
        tutorial="https://www.bv-brc.org/docs/tutorial/metagenomic_read_mapping/metagenomic_read_mapping.html"
        instructionalVideo="https://youtube.com/playlist?list=PLWfOyhOW_Oaurdhs675JawVb4LIcAncKc&si=TK4xGmL_92kiiHDG"
      />

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="grid grid-cols-1 gap-6 md:grid-cols-12"
        >
          {/* Input File Section */}
          <div className="md:col-span-7">
            <Card className="h-full">
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
                  setSelectedLibraries={(libs) => {
                    setSelectedLibraries(libs);
                    syncLibrariesToForm(libs);
                  }}
                  onAdd={() => {
                    // Libraries are already added and synced via setSelectedLibraries prop
                  }}
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
                    type: library.type,
                  }))}
                  onRemove={handleRemoveLibrary}
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
                    title={metagenomicReadMappingParameters.title}
                    description={metagenomicReadMappingParameters.description}
                    sections={metagenomicReadMappingParameters.sections}
                  />
                </RequiredFormCardTitle>
              </CardHeader>

              <CardContent>
                <div className="space-y-6">
                  {/* Gene Set Type */}
                  <div className="w-full">
                    <FormField
                      control={form.control}
                      name="gene_set_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="service-card-label">
                            Gene Set Type
                          </FormLabel>
                          <FormControl>
                            <RadioGroup
                              value={field.value}
                              onValueChange={field.onChange}
                              className="service-radio-group"
                            >
                              <div className="service-radio-group-item">
                                <RadioGroupItem
                                  value="predefined_list"
                                  id="predefined_list"
                                />
                                <Label htmlFor="predefined_list" className="text-sm">
                                  Predefined List
                                </Label>
                              </div>
                              <div className="service-radio-group-item">
                                <RadioGroupItem
                                  value="fasta_file"
                                  id="fasta_file"
                                />
                                <Label htmlFor="fasta_file" className="text-sm">
                                  FASTA File
                                </Label>
                              </div>
                              <div className="service-radio-group-item">
                                <RadioGroupItem
                                  value="feature_group"
                                  id="feature_group"
                                />
                                <Label htmlFor="feature_group" className="text-sm">
                                  Feature Group
                                </Label>
                              </div>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Predefined Gene Set Name */}
                  {geneSetType === "predefined_list" && (
                    <div className="w-full">
                      <FormField
                        control={form.control}
                        name="gene_set_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="service-card-label">
                              Predefined Gene Set Name
                            </FormLabel>
                            <FormControl>
                              <Select
                                value={field.value}
                                onValueChange={field.onChange}
                              >
                                <SelectTrigger className="service-card-select-trigger">
                                  <SelectValue placeholder="Select Gene Set" />
                                </SelectTrigger>
                                <SelectContent>
                                  {PREDEFINED_GENE_SET_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {/* Gene Set FASTA */}
                  {geneSetType === "fasta_file" && (
                    <div className="w-full">
                      <FormField
                        control={form.control}
                        name="gene_set_fasta"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="service-card-label">
                              Gene Set FASTA
                            </FormLabel>
                            <FormControl>
                              <WorkspaceObjectSelector
                                types={[
                                  "aligned_dna_fasta",
                                  "aligned_protein_fasta",
                                  "feature_dna_fasta",
                                  "feature_protein_fasta",
                                ]}
                                placeholder="Select Gene Set FASTA File..."
                                onSelectedObjectChange={(
                                  object: WorkspaceObject | null
                                ) => {
                                  field.onChange(object?.path || "");
                                }}
                                value={field.value}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {/* Gene Set Feature Group */}
                  {geneSetType === "feature_group" && (
                    <div className="w-full">
                      <FormField
                        control={form.control}
                        name="gene_set_feature_group"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="service-card-label">
                              Gene Set Feature Group
                            </FormLabel>
                            <FormControl>
                              <WorkspaceObjectSelector
                                types={["feature_group"]}
                                placeholder="Select Gene Set Feature Group..."
                                onSelectedObjectChange={(
                                  object: WorkspaceObject | null
                                ) => {
                                  field.onChange(object?.path || "");
                                }}
                                value={field.value}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {/* Output Configuration */}
                  <div className="flex flex-col space-y-4">
                    <FormField
                      control={form.control}
                      name="output_path"
                      render={({ field }) => (
                        <FormItem className="w-full">
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
                    <FormField
                      control={form.control}
                      name="output_file"
                      render={({ field }) => (
                        <FormItem className="w-full">
                          <FormControl>
                            <OutputFolder
                              variant="name"
                              required={true}
                              value={field.value}
                              onChange={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
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
                disabled={isSubmitting || !form.formState.isValid}
              >
                {isSubmitting ? <Spinner className="mr-2 h-4 w-4" /> : null}
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
