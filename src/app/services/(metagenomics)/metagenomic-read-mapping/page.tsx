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
import {
  buildBaseLibraryItem,
  getPairedLibraryName,
  getSingleLibraryName,
  useLibrarySelection,
} from "@/lib/forms/shared-library-selection";
import { getLibraryTypeLabel } from "@/lib/forms/shared-schemas";

import type { WorkspaceObject } from "@/lib/workspace-client";

export default function MetagenomicReadMappingPage() {
  const form = useForm<MetagenomicReadMappingFormData>({
    resolver: zodResolver(metagenomicReadMappingFormSchema),
    defaultValues: DEFAULT_METAGENOMIC_READ_MAPPING_FORM_VALUES,
    mode: "onChange",
  });

  // Read input state
  const [pairedRead1, setPairedRead1] = useState<string | null>(null);
  const [pairedRead2, setPairedRead2] = useState<string | null>(null);
  const [singleRead, setSingleRead] = useState<string | null>(null);
  const [sraResetKey, setSraResetKey] = useState(0);

  const [isOutputNameValid, setIsOutputNameValid] = useState(true);

  // Watch form values
  const geneSetType = form.watch("gene_set_type");

  const {
    selectedLibraries,
    addPairedLibrary,
    addSingleLibrary,
    removeLibrary,
    setLibrariesAndSync,
  } = useLibrarySelection<MetagenomicReadMappingFormData, LibraryItem>({
    form,
    mapLibraryToItem: buildBaseLibraryItem,
    fields: {
      paired: "paired_end_libs",
      single: "single_end_libs",
      srr: "srr_ids",
    },
  });

  // Handle adding paired library
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

  // Handle adding single library
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

  // Handle form reset
  const handleReset = () => {
    form.reset(
      { ...DEFAULT_METAGENOMIC_READ_MAPPING_FORM_VALUES },
      { keepDefaultValues: false }
    );
    setLibrariesAndSync([]);
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
    isSubmitting,
  } = useServiceFormSubmission<MetagenomicReadMappingFormData>({
    serviceName: "MetagenomicReadMapping",
    displayName: "Metagenomic Read Mapping",
    transformParams: transformMetagenomicReadMappingParams,
    onSuccess: handleReset,
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
                              outputFolderPath={form.watch("output_path")}
                              onValidationChange={setIsOutputNameValid}
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
                disabled={isSubmitting || !form.formState.isValid || !isOutputNameValid}
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
