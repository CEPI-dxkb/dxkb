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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle, ChevronDown } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  genomeAssemblyInfo,
  genomeAssemblyParameters,
  readInputFileInfo,
} from "@/lib/services/service-info";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import SraRunAccessionWithValidation from "@/components/services/sra-run-accession-with-validation";
import SelectedItemsTable from "@/components/services/selected-items-table";
import OutputFolder from "@/components/services/output-folder";
import { Library } from "@/types/services";
import { NumberInput } from "@/components/ui/number-input";
import { JobParamsDialog } from "@/components/services/job-params-dialog";
import { useServiceFormSubmission } from "@/hooks/services/use-service-form-submission";
import { toast } from "sonner";
import {
  genomeAssemblyFormSchema,
  DEFAULT_GENOME_ASSEMBLY_FORM_VALUES,
  type GenomeAssemblyFormData,
  type LibraryItem,
  transformGenomeAssemblyParams,
  calculateGenomeSize,
} from "@/lib/forms/(genomics)";
import { submitServiceJob } from "@/lib/services/service-utils";
import {
  RequiredFormCardTitle,
  RequiredFormLabel,
} from "@/components/forms/required-form-components";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import { WorkspaceObject } from "@/lib/workspace-client";
import { ChevronRight } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

export default function GenomeAssemblyPage() {
  const [selectedLibraries, setSelectedLibraries] = useState<Library[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [genomeSizeUnit, setGenomeSizeUnit] = useState<"M" | "K">("M");
  const [expectedGenomeSize, setExpectedGenomeSize] = useState(5);
  const [pairedRead1, setPairedRead1] = useState<string | null>(null);
  const [pairedRead2, setPairedRead2] = useState<string | null>(null);
  const [singleRead, setSingleRead] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOutputNameValid, setIsOutputNameValid] = useState(true);

  const form = useForm<GenomeAssemblyFormData>({
    resolver: zodResolver(genomeAssemblyFormSchema),
    defaultValues: DEFAULT_GENOME_ASSEMBLY_FORM_VALUES,
    mode: "onChange",
  });

  // Watch recipe to show/hide genome size field
  const recipe = form.watch("recipe");
  const showGenomeSizeField = recipe === "canu";

  // Setup service debugging and form submission
  const {
    handleSubmit,
    showParamsDialog,
    setShowParamsDialog,
    currentParams,
    serviceName,
  } = useServiceFormSubmission<GenomeAssemblyFormData>({
    serviceName: "Genome Assembly",
    transformParams: transformGenomeAssemblyParams,
    onSubmit: async (data) => {
      console.log("Submitting Genome Assembly job with data:", data);

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
        // Submit the Genome Assembly job using the utility function
        const result = await submitServiceJob(
          "GenomeAssembly2",
          transformGenomeAssemblyParams(data),
        );

        if (result.success) {
          console.log("Genome Assembly job submitted successfully:", result.job[0]);

          // Show success message
          toast.success("Genome Assembly job submitted successfully!", {
            description: `Job ID: ${result.job[0].id}`,
          });

          // Reset form after successful submission
          handleReset();
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        console.error("Failed to submit Genome Assembly job:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Failed to submit Genome Assembly job";
        toast.error("Submission failed", {
          description: errorMessage,
        });
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  const handleReset = () => {
    form.reset(DEFAULT_GENOME_ASSEMBLY_FORM_VALUES);
    setSelectedLibraries([]);
    setShowAdvanced(false);
    setGenomeSizeUnit("M");
    setExpectedGenomeSize(5);
    setPairedRead1(null);
    setPairedRead2(null);
    setSingleRead(null);
  };

  // Convert Library to LibraryItem for form submission
  const convertLibraryToLibraryItem = (library: Library): LibraryItem => {
    const baseLib: LibraryItem = {
      _id: library.id,
      _type: library.type === "paired" ? "paired" : library.type === "single" ? "single" : "srr_accession",
    };

    // Add type-specific fields from library metadata
    if (library.type === "paired" && library.files) {
      baseLib.read1 = library.files[0];
      baseLib.read2 = library.files[1];
      baseLib.platform = library.platform || "infer";
      baseLib.interleaved = library.interleaved || false;
      baseLib.read_orientation_outward = library.read_orientation_outward || false;
    } else if (library.type === "single" && library.files) {
      baseLib.read = library.files[0];
      baseLib.platform = library.platform || "infer";
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

    form.setValue("paired_end_libs", pairedLibs, { shouldValidate: true });
    form.setValue("single_end_libs", singleLibs, { shouldValidate: true });
    form.setValue("srr_ids", srrIds, { shouldValidate: true });
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
      platform: "infer",
      interleaved: false,
      read_orientation_outward: false,
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
      platform: "infer",
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

  // Handle genome size calculation
  const handleGenomeSizeChange = () => {
    const calculatedSize = calculateGenomeSize(expectedGenomeSize, genomeSizeUnit);
    form.setValue("genome_size", calculatedSize, { shouldValidate: true });
  };

  return (
    <section>
      <ServiceHeader
        title="Genome Assembly"
        description="The Genome Assembly Service allows single or multiple assemblers to be invoked to compare results. The service attempts to select the best assembly."
        infoPopupTitle={genomeAssemblyInfo.title}
        infoPopupDescription={genomeAssemblyInfo.description}
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
                  Input Files
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
                          <p>
                            Read files placed here will contribute to a single
                            analysis.
                          </p>
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
                    title={genomeAssemblyParameters.title}
                    description={genomeAssemblyParameters.description}
                    sections={genomeAssemblyParameters.sections}
                  />
                </CardTitle>
              </CardHeader>

              <CardContent className="service-card-content">
                <div className="space-y-6">
                  {/* Assembly Strategy */}
                  <FormField
                    control={form.control}
                    name="recipe"
                    render={({ field }) => (
                      <FormItem>
                        <RequiredFormLabel>
                          Assembly Strategy
                        </RequiredFormLabel>
                        <FormControl>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger className="service-card-select-trigger">
                              <SelectValue placeholder="Select strategy" />
                            </SelectTrigger>
                            <SelectContent className="service-card-select-content">
                              <SelectItem value="auto">Auto</SelectItem>
                              <SelectItem value="unicycler">Unicycler</SelectItem>
                              <SelectItem value="spades">SPAdes</SelectItem>
                              <SelectItem value="canu">Canu</SelectItem>
                              <SelectItem value="meta-spades">metaSPAdes</SelectItem>
                              <SelectItem value="plasmid-spades">plasmidSPAdes</SelectItem>
                              <SelectItem value="single-cell">MDA (single-cell)</SelectItem>
                              <SelectItem value="flye">Flye</SelectItem>
                              <SelectItem value="megahit">MegaHit</SelectItem>
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

                  {/* Genome Size (for Canu only) */}
                  {showGenomeSizeField && (
                    <FormField
                      control={form.control}
                      name="genome_size"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="service-card-label">
                            Estimated Genome Size
                          </FormLabel>
                          <FormControl>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                value={expectedGenomeSize}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value);
                                  setExpectedGenomeSize(value);
                                  const calculatedSize = calculateGenomeSize(value, genomeSizeUnit);
                                  field.onChange(calculatedSize);
                                }}
                                className="service-card-input flex-1"
                                min={genomeSizeUnit === "M" ? 1 : 100}
                                max={genomeSizeUnit === "M" ? 10 : 10000}
                              />
                              <span className="text-lg">×</span>
                              <Select
                                value={genomeSizeUnit}
                                onValueChange={(value: "M" | "K") => {
                                  setGenomeSizeUnit(value);
                                  if (value === "M") {
                                    setExpectedGenomeSize(5);
                                    field.onChange(5000000);
                                  } else {
                                    setExpectedGenomeSize(500);
                                    field.onChange(500000);
                                  }
                                }}
                              >
                                <SelectTrigger className="service-card-select-trigger w-20">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="M">M</SelectItem>
                                  <SelectItem value="K">K</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Advanced Options */}
                  <Collapsible
                    open={showAdvanced}
                    onOpenChange={setShowAdvanced}
                    className="service-collapsible-container"
                  >
                    <CollapsibleTrigger className="service-collapsible-trigger">
                      Advanced Options
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-180 transform" : ""}`}
                      />
                    </CollapsibleTrigger>

                    <CollapsibleContent className="service-collapsible-content">
                      {/* Read Processing */}
                      <div className="space-y-4">
                        <Label className="service-card-label">Read Processing</Label>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                          <FormField
                            control={form.control}
                            name="normalize"
                            render={({ field }) => (
                              <FormItem className="flex flex-col items-start justify-between">
                                <FormLabel className="service-card-sublabel">
                                  Normalize Illumina Reads
                                </FormLabel>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="trim"
                            render={({ field }) => (
                              <FormItem className="flex flex-col items-start justify-between">
                                <FormLabel className="service-card-sublabel">
                                  Trim Short Reads
                                </FormLabel>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="filtlong"
                            render={({ field }) => (
                              <FormItem className="flex flex-col items-start justify-between">
                                <FormLabel className="service-card-sublabel">
                                  Filter Long Reads
                                </FormLabel>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      {/* Genome Parameters */}
                      <div className="space-y-4">
                        <Label className="service-card-label">Genome Parameters</Label>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <FormField
                            control={form.control}
                            name="target_depth"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="service-card-sublabel">
                                  Target Genome Coverage
                                </FormLabel>
                                <FormControl>
                                  <NumberInput
                                    value={field.value}
                                    onChange={field.onChange}
                                    min={100}
                                    max={500}
                                    stepper={50}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      {/* Assembly Polishing */}
                      <div className="space-y-4">
                        <Label className="service-card-label">Assembly Polishing</Label>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <FormField
                            control={form.control}
                            name="racon_iter"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="service-card-sublabel">
                                  Racon Iterations
                                </FormLabel>
                                <FormControl>
                                  <NumberInput
                                    value={field.value}
                                    onChange={field.onChange}
                                    min={0}
                                    max={4}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="pilon_iter"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="service-card-sublabel">
                                  Pilon Iterations
                                </FormLabel>
                                <FormControl>
                                  <NumberInput
                                    value={field.value}
                                    onChange={field.onChange}
                                    min={0}
                                    max={4}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      {/* Assembly Thresholds */}
                      <div className="space-y-4">
                        <Label className="service-card-label">Assembly Thresholds</Label>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <FormField
                            control={form.control}
                            name="min_contig_len"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="service-card-sublabel">
                                  Min. contig length
                                </FormLabel>
                                <FormControl>
                                  <NumberInput
                                    value={field.value}
                                    onChange={field.onChange}
                                    min={100}
                                    max={100000}
                                    stepper={10}
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
                              <FormItem>
                                <FormLabel className="service-card-sublabel">
                                  Min. contig coverage
                                </FormLabel>
                                <FormControl>
                                  <NumberInput
                                    value={field.value}
                                    onChange={field.onChange}
                                    min={0}
                                    max={100000}
                                    stepper={5}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Selected Libraries */}
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
                        <p>
                          Read files placed here will contribute to a single
                          analysis.
                        </p>
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
              <Button
                type="submit"
                disabled={isSubmitting || !form.formState.isValid || !isOutputNameValid}
              >
                {isSubmitting ? <Spinner /> : null}
                Assemble
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
