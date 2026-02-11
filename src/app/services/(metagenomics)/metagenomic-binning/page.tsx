"use client";

import { useState, useEffect } from "react";
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

import { useServiceFormSubmission } from "@/hooks/services/use-service-form-submission";
import {
  metagenomicBinningInfo,
  metagenomicBinningInputFile,
  metagenomicBinningParameters,
  metagenomicBinningStartWith,
} from "@/lib/services/service-info";

import {
  metagenomicBinningFormSchema,
  DEFAULT_METAGENOMIC_BINNING_FORM_VALUES,
  MIN_CONTIG_LENGTH_MIN,
  MIN_CONTIG_LENGTH_MAX,
  MIN_CONTIG_COVERAGE_MIN,
  MIN_CONTIG_COVERAGE_MAX,
  type MetagenomicBinningFormData,
  type LibraryItem,
} from "@/lib/forms/(metagenomics)/metagenomic-binning/metagenomic-binning-form-schema";
import { transformMetagenomicBinningParams } from "@/lib/forms/(metagenomics)/metagenomic-binning/metagenomic-binning-form-utils";
import {
  buildBaseLibraryItem,
  getPairedLibraryName,
  getSingleLibraryName,
  useLibrarySelection,
} from "@/lib/forms/shared-library-selection";
import { getLibraryTypeLabel } from "@/lib/forms/shared-schemas";

import type { WorkspaceObject } from "@/lib/workspace-client";

export default function MetagenomicBinningPage() {
  const form = useForm<MetagenomicBinningFormData>({
    resolver: zodResolver(metagenomicBinningFormSchema),
    defaultValues: DEFAULT_METAGENOMIC_BINNING_FORM_VALUES,
    mode: "onChange",
  });

  // UI state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isOutputNameValid, setIsOutputNameValid] = useState(true);

  // Read input state
  const [pairedRead1, setPairedRead1] = useState<string | null>(null);
  const [pairedRead2, setPairedRead2] = useState<string | null>(null);
  const [singleRead, setSingleRead] = useState<string | null>(null);
  const [sraResetKey, setSraResetKey] = useState(0);

  // Watch form values
  const startWith = form.watch("start_with");
  const assembler = form.watch("assembler");

  const {
    selectedLibraries,
    addPairedLibrary,
    addSingleLibrary,
    removeLibrary,
    setLibrariesAndSync,
  } = useLibrarySelection<MetagenomicBinningFormData, LibraryItem>({
    form,
    mapLibraryToItem: buildBaseLibraryItem,
    fields: {
      paired: "paired_end_libs",
      single: "single_end_libs",
      srr: "srr_ids",
    },
  });

  // Determine if MetaSPAdes should be disabled based on selectedLibraries (source of truth)
  // MetaSPAdes only supports a single paired-end library
  const pairedCount = selectedLibraries.filter((lib) => lib.type === "paired").length;
  const metaspadesDisabled = !(selectedLibraries.length === 1 && pairedCount === 1);

  // Reset assembler to auto if metaspades becomes disabled while selected
  useEffect(() => {
    if (metaspadesDisabled && assembler === "metaspades") {
      form.setValue("assembler", "auto");
    }
  }, [metaspadesDisabled, assembler, form]);

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
    form.reset(DEFAULT_METAGENOMIC_BINNING_FORM_VALUES);
    setLibrariesAndSync([]);
    setShowAdvanced(false);
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
  } = useServiceFormSubmission<MetagenomicBinningFormData>({
    serviceName: "MetagenomeBinning",
    displayName: "Metagenomic Binning",
    transformParams: transformMetagenomicBinningParams,
    onSuccess: handleReset,
  });

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

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
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
                <FormField
                  control={form.control}
                  name="start_with"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <RadioGroup
                          value={field.value}
                          onValueChange={field.onChange}
                          className="service-radio-group"
                        >
                          <div className="service-radio-group-item">
                            <RadioGroupItem value="reads" id="reads" />
                            <Label htmlFor="reads">Read Files</Label>
                          </div>
                          <div className="service-radio-group-item">
                            <RadioGroupItem value="contigs" id="contigs" />
                            <Label htmlFor="contigs">Assembled Contigs</Label>
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
                  <FormField
                    control={form.control}
                    name="contigs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="service-card-label">
                          Contigs
                        </FormLabel>
                        <FormControl>
                          <WorkspaceObjectSelector
                            types={["contigs"]}
                            placeholder="Select or Upload Contigs..."
                            onSelectedObjectChange={(
                              object: WorkspaceObject | null,
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
                        <FormField
                          control={form.control}
                          name="assembler"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="service-card-label">
                                Assembly Strategy
                              </FormLabel>
                              <FormControl>
                                <RadioGroup
                                  value={field.value}
                                  onValueChange={field.onChange}
                                  className="service-radio-group"
                                >
                                  <div className="service-radio-group-item">
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
                                  <div className="service-radio-group-item">
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
                                  <div className="service-radio-group-item">
                                    <RadioGroupItem value="auto" id="auto" />
                                    <Label htmlFor="auto" className="text-sm">
                                      Auto
                                    </Label>
                                  </div>
                                </RadioGroup>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}

                    {/* Organisms of Interest */}
                    <div className="w-full">
                      <FormField
                        control={form.control}
                        name="organism"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="service-card-label">
                              Organisms of Interest
                            </FormLabel>
                            <FormControl>
                              <RadioGroup
                                value={field.value}
                                onValueChange={field.onChange}
                                className="service-radio-group"
                              >
                                <div className="service-radio-group-item">
                                  <RadioGroupItem
                                    value="bacteria"
                                    id="bacteria"
                                  />
                                  <Label htmlFor="bacteria" className="text-sm">
                                    Bacteria/Archaea
                                  </Label>
                                </div>
                                <div className="service-radio-group-item">
                                  <RadioGroupItem value="viral" id="viral" />
                                  <Label htmlFor="viral" className="text-sm">
                                    Viruses
                                  </Label>
                                </div>
                                <div className="service-radio-group-item">
                                  <RadioGroupItem value="both" id="both" />
                                  <Label htmlFor="both" className="text-sm">
                                    Both
                                  </Label>
                                </div>
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Output Configuration */}
                  <div className="mt-4 space-y-6">
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

                    {/* Genome Group Name */}
                    <FormField
                      control={form.control}
                      name="genome_group"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="service-card-label">
                            Genome Group Name
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="My Genome Group"
                              className="service-card-input"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
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
                          <FormField
                            control={form.control}
                            name="min_contig_len"
                            render={({ field }) => (
                              <FormItem className="w-full">
                                <FormLabel className="service-card-sublabel">
                                  Minimum Contig Length
                                </FormLabel>
                                <FormControl>
                                  <NumberInput
                                    ref={field.ref}
                                    name={field.name}
                                    value={field.value}
                                    min={MIN_CONTIG_LENGTH_MIN}
                                    max={MIN_CONTIG_LENGTH_MAX}
                                    stepper={10}
                                    onBlur={field.onBlur}
                                    onValueChange={(value) => {
                                      if (value !== undefined)
                                        field.onChange(value);
                                    }}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="min_contig_cov"
                            render={({ field }) => (
                              <FormItem className="w-full">
                                <FormLabel className="service-card-sublabel">
                                  Minimum Contig Coverage
                                </FormLabel>
                                <FormControl>
                                  <NumberInput
                                    ref={field.ref}
                                    name={field.name}
                                    value={field.value}
                                    min={MIN_CONTIG_COVERAGE_MIN}
                                    max={MIN_CONTIG_COVERAGE_MAX}
                                    stepper={1}
                                    onBlur={field.onBlur}
                                    onValueChange={(value) => {
                                      if (value !== undefined)
                                        field.onChange(value);
                                    }}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name="disable_dangling"
                          render={({ field }) => (
                            <FormItem className="flex items-center gap-2">
                              <FormControl>
                                <Checkbox
                                  id="disable_dangling"
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  className="mb-2 bg-white"
                                />
                              </FormControl>
                              <FormLabel
                                htmlFor="disable_dangling"
                                className="service-card-sublabel"
                              >
                                Disable Search For Dangling Contigs (Decreases
                                Memory Use)
                              </FormLabel>
                            </FormItem>
                          )}
                        />
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
