"use client";

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
import { useState, useMemo, useEffect } from "react";
import { ServiceHeader } from "@/components/services/service-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown } from "lucide-react";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import OutputFolder from "@/components/services/output-folder";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import { WorkspaceObject } from "@/lib/workspace-client";
import { submitServiceJob } from "@/lib/services/service-utils";
import {
  fetchGenomeGroupMembers,
  validateViralGenomes,
  getGenomeIdsFromGroup,
  type GenomeSummary,
  fetchAllGenomeIds,
} from "@/lib/services/genome";
import { fetchFeaturesFromGroup, type FeatureSummary } from "@/lib/services/feature";
import { JobParamsDialog } from "@/components/services/job-params-dialog";
import { useServiceFormSubmission } from "@/hooks/services/use-service-form-submission";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  msaSNPAnalysisInfo,
  msaSNPAnalysisParameters,
  msaSNPAnalysisSelectSequences,
  msaSNPAnalysisStartWith,
} from "@/lib/services/service-info";
import * as MsaSnpAnalysis from "@/lib/forms/(protein-tools)/msa-snp-analysis/msa-snp-analysis-form-schema";
import * as MsaSnpAnalysisUtils from "@/lib/forms/(protein-tools)/msa-snp-analysis/msa-snp-analysis-form-utils";
import { validateFasta } from "@/lib/fasta-validation";

export default function MSAandSNPAnalysisPage() {
  const form = useForm<MsaSnpAnalysis.MsaSnpAnalysisFormData>({
    resolver: zodResolver(MsaSnpAnalysis.msaSnpAnalysisFormSchema),
    defaultValues: MsaSnpAnalysis.DEFAULT_MSA_SNP_ANALYSIS_FORM_VALUES,
    mode: "onChange",
  });

  const [selectedFeatureGroupObject, setSelectedFeatureGroupObject] =
    useState<WorkspaceObject | null>(null);
  const [selectedGenomeGroupObject, setSelectedGenomeGroupObject] =
    useState<WorkspaceObject | null>(null);
  const [selectedFastaObject, setSelectedFastaObject] =
    useState<WorkspaceObject | null>(null);
  const [selectedAlignedFastaObject, setSelectedAlignedFastaObject] =
    useState<WorkspaceObject | null>(null);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string>("");
  const [selectedGenomeId, setSelectedGenomeId] = useState<string>("");
  const [fastaInputText, setFastaInputText] = useState<string>("");
  const [referenceFastaText, setReferenceFastaText] = useState<string>("");
  const [featureOptions, setFeatureOptions] = useState<FeatureSummary[]>([]);
  const [isLoadingFeatures, setIsLoadingFeatures] = useState(false);
  const [genomeOptions, setGenomeOptions] = useState<GenomeSummary[]>([]);
  const [isLoadingGenomes, setIsLoadingGenomes] = useState(false);
  const [genomeIdDropdownOpen, setGenomeIdDropdownOpen] = useState(false);
  const [fastaValidationResult, setFastaValidationResult] = useState<{
    valid: boolean;
    message: string;
    numseq: number;
  } | null>(null);
  const [referenceFastaValidationResult, setReferenceFastaValidationResult] =
    useState<{
      valid: boolean;
      message: string;
      numseq: number;
    } | null>(null);
  const [showStrategy, setShowStrategy] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidatingGenomeGroup, setIsValidatingGenomeGroup] = useState(false);

  const inputStatus = form.watch("input_status");
  const inputType = form.watch("input_type");
  const refType = form.watch("ref_type");
  const aligner = form.watch("aligner");
  const fastaFiles = form.watch("fasta_files") || [];
  const featureGroup = form.watch("feature_groups");
  const selectGenomegroup = form.watch("select_genomegroup") || [];

  // Update strategy visibility based on aligner
  useEffect(() => {
    if (aligner === "Muscle" || inputStatus === "aligned") {
      setShowStrategy(false);
    }
  }, [aligner, inputStatus]);

  // Validate FASTA input when text changes
  useEffect(() => {
    if (!fastaInputText.trim()) {
      setFastaValidationResult(null);
      form.setValue("fasta_keyboard_input", "", {
        shouldValidate: false,
        shouldDirty: false,
      });
      return;
    }

    const hasReference =
      refType === "string" && referenceFastaText.trim() !== "";
    const validation = MsaSnpAnalysisUtils.validateSequenceFasta(
      fastaInputText,
      hasReference,
    );

    setFastaValidationResult({
      valid: validation.valid && validation.meetsMinSequenceRequirement,
      message: validation.meetsMinSequenceRequirement
        ? validation.message
        : `At least ${hasReference ? "one" : "two"} sequence(s) are required.`,
      numseq: validation.numseq,
    });

    if (validation.valid && validation.meetsMinSequenceRequirement) {
      form.setValue("fasta_keyboard_input", validation.trimFasta, {
        shouldValidate: false,
        shouldDirty: false,
      });
    }
  }, [fastaInputText, refType, referenceFastaText]);

  // Validate reference FASTA input when text changes
  useEffect(() => {
    if (!referenceFastaText.trim()) {
      setReferenceFastaValidationResult(null);
      form.setValue("ref_string", "", {
        shouldValidate: false,
        shouldDirty: false,
      });
      return;
    }

    const validation =
      MsaSnpAnalysisUtils.validateReferenceFasta(referenceFastaText);

    setReferenceFastaValidationResult({
      valid: validation.valid && validation.isSingleSequence,
      message: validation.isSingleSequence
        ? validation.message
        : "Only one sequence is allowed.",
      numseq: validation.numseq,
    });

    if (validation.valid && validation.isSingleSequence) {
      form.setValue("ref_string", validation.trimFasta, {
        shouldValidate: false,
        shouldDirty: false,
      });
    }
  }, [referenceFastaText]);

  // Fetch features from feature group when Feature ID reference is selected
  useEffect(() => {
    const shouldFetch = refType === "feature_id" && featureGroup && featureGroup.trim() !== "";

    if (!shouldFetch) {
      setFeatureOptions([]);
      setSelectedFeatureId("");
      return;
    }

    let abortController: AbortController | null = null;

    async function loadFeatures() {
      // TypeScript guard: ensure featureGroup is defined
      if (!featureGroup || featureGroup.trim() === "") {
        return;
      }

      setIsLoadingFeatures(true);
      abortController = new AbortController();

      try {
        const features = await fetchFeaturesFromGroup(featureGroup, {
          signal: abortController.signal,
        });

        setFeatureOptions(features);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          // Request was cancelled, ignore
          return;
        }

        console.error("Failed to fetch features from feature group:", error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to fetch features from feature group";
        toast.error("Failed to load features", {
          description: errorMessage,
          closeButton: true,
        });
        setFeatureOptions([]);
      } finally {
        setIsLoadingFeatures(false);
      }
    }

    loadFeatures();

    return () => {
      if (abortController) {
        abortController.abort();
      }
    };
  }, [refType, featureGroup]);

  // Fetch genomes from genome group when Genome ID reference is selected
  useEffect(() => {
    const shouldFetch = refType === "genome_id" && selectGenomegroup && selectGenomegroup.length > 0;

    if (!shouldFetch) {
      setGenomeOptions([]);
      setSelectedGenomeId("");
      return;
    }

    let abortController: AbortController | null = null;

    async function loadGenomes() {
      // TypeScript guard: ensure genome group is defined
      if (!selectGenomegroup || selectGenomegroup.length === 0) {
        return;
      }

      // Get the first (and only) genome group path
      const genomeGroupPath = selectGenomegroup[0];

      setIsLoadingGenomes(true);
      abortController = new AbortController();

      try {
        // First, get the genome IDs from the genome group
        const genomeIds = await getGenomeIdsFromGroup(genomeGroupPath, {
          signal: abortController.signal,
        });

        if (genomeIds.length === 0) {
          setGenomeOptions([]);
          return;
        }

        // Now fetch genomes using the website API
        const allGenomeIds = await fetchAllGenomeIds({ signal: abortController.signal });

        setGenomeOptions(allGenomeIds.map((genome) => ({ genome_id: genome.genome_id, genome_name: genome.genome_name })));
      } catch (error) {
        console.error("Failed to fetch genome IDs:", error);
        toast.error("Failed to fetch genome IDs", {
          description: error instanceof Error ? error.message : "Failed to fetch genome IDs",
          closeButton: true,
        });
        setGenomeOptions([]);
      }
      setIsLoadingGenomes(false);
    }

    loadGenomes();

    return () => {
      if (abortController) {
        abortController.abort();
      }
    };
  }, [refType, selectGenomegroup]);

  // Handle selecting genome group (only one group allowed at a time)
  async function handleSelectGenomeGroup() {
    if (!selectedGenomeGroupObject || !selectedGenomeGroupObject.path) {
      toast.error("No object selected", {
        description: "Please select a genome group before adding.",
        closeButton: true,
      });
      return;
    }

    const inputValue = selectedGenomeGroupObject.path;

    setIsValidatingGenomeGroup(true);

    try {
      // Fetch genome group members to get genome IDs
      const genomes = await fetchGenomeGroupMembers(inputValue);

      if (genomes.length === 0) {
        toast.error("Empty genome group", {
          description: "The selected genome group is empty.",
          closeButton: true,
        });
        setIsValidatingGenomeGroup(false);
        return;
      }

      if (genomes.length > MsaSnpAnalysis.MAX_GENOMES) {
        toast.error("Genome group too large", {
          description: `The genome group has ${genomes.length} genomes, but the maximum is ${MsaSnpAnalysis.MAX_GENOMES}.`,
          closeButton: true,
        });
        setIsValidatingGenomeGroup(false);
        return;
      }

      const genomeIds = genomes.map((g) => g.genome_id);

      // Validate viral genomes
      const validation = await validateViralGenomes(genomeIds, {
        maxGenomeLength: MsaSnpAnalysis.MAX_GENOME_LENGTH,
      });

      if (!validation.allValid) {
        const errorMessages = Object.values(validation.errors).filter(Boolean);
        const errorMsg =
          errorMessages.length > 0
            ? errorMessages.join("\n")
            : "Invalid genome group. Please check that all genomes are viruses with single contigs.";

        toast.error("Genome group validation failed", {
          description: errorMsg,
          duration: 10000,
          closeButton: true,
        });
        setIsValidatingGenomeGroup(false);
        return;
      }

      // Replace the existing group (only one group allowed)
      form.setValue("select_genomegroup", [inputValue]);
      setSelectedGenomeGroupObject(null);

    } catch (error) {
      console.error("Failed to validate genome group:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to validate genome group";
      toast.error("Validation error", {
        description: errorMessage,
        closeButton: true,
      });
    } finally {
      setIsValidatingGenomeGroup(false);
    }
  }

  function handleReset() {
    form.reset(MsaSnpAnalysis.DEFAULT_MSA_SNP_ANALYSIS_FORM_VALUES);
    setSelectedFeatureGroupObject(null);
    setSelectedGenomeGroupObject(null);
    setSelectedFastaObject(null);
    setSelectedAlignedFastaObject(null);
    setSelectedFeatureId("");
    setSelectedGenomeId("");
    setFastaInputText("");
    setReferenceFastaText("");
    setFastaValidationResult(null);
    setReferenceFastaValidationResult(null);
    setShowStrategy(false);
    setFeatureOptions([]);
    setGenomeOptions([]);
    setGenomeIdDropdownOpen(false);
    // Clear feature group selection
    form.setValue("feature_groups", "");
  }

  // Setup service debugging and form submission
  const {
    handleSubmit,
    showParamsDialog,
    setShowParamsDialog,
    currentParams,
    serviceName,
  } = useServiceFormSubmission<MsaSnpAnalysis.MsaSnpAnalysisFormData>({
    serviceName: "MSA SNP Analysis",
    transformParams: MsaSnpAnalysisUtils.transformMsaSnpAnalysisParams,
    onSubmit: async (data) => {
      try {
        setIsSubmitting(true);
        const result = await submitServiceJob(
          "MSA",
          MsaSnpAnalysisUtils.transformMsaSnpAnalysisParams(data),
        );

        if (result.success) {
          console.log(
            "MSA SNP Analysis job submitted successfully:",
            result.job?.[0],
          );

          toast.success("MSA SNP Analysis job submitted successfully!", {
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
        console.error("Failed to submit MSA SNP Analysis job:", error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to submit MSA SNP Analysis job";
        toast.error("Submission failed", {
          description: errorMessage,
          closeButton: true,
        });
      } finally {
        setIsSubmitting(false);
      }
    },
  });


  // Determine which reference options are available
  const availableRefTypes = useMemo((): Array<
    MsaSnpAnalysis.MsaSnpAnalysisFormData["ref_type"]
  > => {
    if (inputStatus === "aligned") {
      return ["none", "first"];
    }

    if (inputType === "input_feature_group") {
      return ["none", "feature_id", "string"];
    }

    if (inputType === "input_genome_group") {
      return ["none", "genome_id", "string"];
    }

    if (inputType === "input_fasta" || inputType === "input_sequence") {
      return ["none", "first", "string"];
    }

    return ["none", "string"];
  }, [inputStatus, inputType]);

  return (
    <section>
      <ServiceHeader
        title="MSA & SNP / Variation Analysis"
        description="The Multiple Sequence Alignment and SNP / Variation Analysis Service
          allows users to choose an alignment algorithm to align sequences selected from a search result,
          a FASTA file saved to the workspace, or through simply cutting and pasting.
          The service can also be used for variation and SNP analysis with feature groups, FASTA files, aligned FASTA files, and user input FASTA records."
        infoPopupTitle={msaSNPAnalysisInfo.title}
        infoPopupDescription={msaSNPAnalysisInfo.description}
        quickReferenceGuide="https://www.bv-brc.org/docs/quick_references/services/msa_snp_variation_service.html"
        tutorial="https://www.bv-brc.org/docs/tutorial/msa_snp_variation/msa_snp_variation.html"
        instructionalVideo="https://www.youtube.com/watch?v=ea6GboAZPQs"
      />

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="flex flex-col gap-4"
        >
          {/* Start with */}
          <Card>
            <CardHeader className="service-card-header">
              <RequiredFormCardTitle className="service-card-title">
                Start with:
                <DialogInfoPopup
                  title={msaSNPAnalysisStartWith.title}
                  description={msaSNPAnalysisStartWith.description}
                  sections={msaSNPAnalysisStartWith.sections}
                />
              </RequiredFormCardTitle>
            </CardHeader>

            <CardContent className="service-card-content">
              <FormField
                control={form.control}
                name="input_status"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <RadioGroup
                        value={field.value}
                        onValueChange={(value) => {
                          const previousStatus = field.value;
                          field.onChange(value);
                          // Reset input type when status changes
                          if (value === "aligned") {
                            form.setValue("input_type", undefined);
                          } else {
                            form.setValue("input_type", "input_feature_group");
                          }
                          // Reset reference type to "none" when input status changes
                          if (previousStatus !== value) {
                            form.setValue("ref_type", "none");
                            form.setValue("ref_string", "");
                            setSelectedFeatureId("");
                            setSelectedGenomeId("");
                            setReferenceFastaText("");
                            setGenomeIdDropdownOpen(false);
                            setFeatureOptions([]);
                          }
                        }}
                        className="service-radio-group"
                      >
                        <div className="service-radio-group-item">
                          <RadioGroupItem value="unaligned" id="unaligned" />
                          <Label htmlFor="unaligned">Unaligned Sequences</Label>
                        </div>
                        <div className="service-radio-group-item">
                          <RadioGroupItem value="aligned" id="aligned" />
                          <Label htmlFor="aligned">Aligned Sequences</Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Select sequences */}
          <Card>
            <CardHeader className="service-card-header">
              <RequiredFormCardTitle className="service-card-title">
                Select sequences:
                <DialogInfoPopup
                  title={msaSNPAnalysisSelectSequences.title}
                  description={msaSNPAnalysisSelectSequences.description}
                  sections={msaSNPAnalysisSelectSequences.sections}
                />
              </RequiredFormCardTitle>
            </CardHeader>

            <CardContent className="service-card-content">
              {inputStatus === "unaligned" ? (
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="input_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <RadioGroup
                            value={field.value}
                            onValueChange={(value) => {
                              // Reset reference type to "none" when input type changes
                              const previousInputType = field.value;
                              field.onChange(value);
                              
                              // Only reset if the input type actually changed
                              if (previousInputType !== value) {
                                form.setValue("ref_type", "none");
                                form.setValue("ref_string", "");
                                setSelectedFeatureId("");
                                setSelectedGenomeId("");
                                setReferenceFastaText("");
                                setGenomeIdDropdownOpen(false);
                                setFeatureOptions([]);
                              }
                            }}
                            className="service-radio-group"
                          >
                            <div className="service-radio-group-item">
                              <RadioGroupItem
                                value="input_feature_group"
                                id="input_feature_group"
                              />
                              <Label htmlFor="input_feature_group">Feature Group</Label>
                            </div>
                            <div className="service-radio-group-item">
                              <RadioGroupItem
                                value="input_genome_group"
                                id="input_genome_group"
                              />
                              <Label htmlFor="input_genome_group">
                                Viral Genome Group
                              </Label>
                            </div>
                            <div className="service-radio-group-item">
                              <RadioGroupItem
                                value="input_fasta"
                                id="input_fasta"
                              />
                              <Label htmlFor="input_fasta">
                                DNA or Protein FASTA File
                              </Label>
                            </div>
                            <div className="service-radio-group-item">
                              <RadioGroupItem
                                value="input_sequence"
                                id="input_sequence"
                              />
                              <Label htmlFor="input_sequence">
                                Input Sequence
                              </Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Feature Group Input */}
                  {inputType === "input_feature_group" && (
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="feature_groups"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <WorkspaceObjectSelector
                                types={["feature_group"]}
                                placeholder="Select feature group"
                                onSelectedObjectChange={(
                                  object: WorkspaceObject | null,
                                ) => {
                                  if (!object || !object.path) {
                                    field.onChange("");
                                    setSelectedFeatureGroupObject(null);
                                    return;
                                  }

                                  field.onChange(object.path);
                                  setSelectedFeatureGroupObject(object);
                                }}
                                value={field.value}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="alphabet"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <RadioGroup
                                value={field.value}
                                onValueChange={field.onChange}
                                className="service-radio-group"
                              >
                                <div className="service-radio-group-item">
                                  <RadioGroupItem value="dna" id="dna" />
                                  <Label htmlFor="dna">DNA</Label>
                                </div>
                                <div className="service-radio-group-item">
                                  <RadioGroupItem
                                    value="protein"
                                    id="protein"
                                  />
                                  <Label htmlFor="protein">Protein</Label>
                                </div>
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {/* Genome Group Input */}
                  {inputType === "input_genome_group" && (
                    <div className="space-y-2">
                      <WorkspaceObjectSelector
                        types={["genome_group"]}
                        placeholder="Select viral genome group"
                        onSelectedObjectChange={async (
                          object: WorkspaceObject | null,
                        ) => {
                          if (!object || !object.path) {
                            setSelectedGenomeGroupObject(null);
                            return;
                          }

                          const inputValue = object.path;

                          setIsValidatingGenomeGroup(true);

                          try {
                            // Fetch genome group members to get genome IDs
                            const genomes = await fetchGenomeGroupMembers(inputValue);

                            if (genomes.length === 0) {
                              toast.error("Empty genome group", {
                                description: "The selected genome group is empty.",
                                closeButton: true,
                              });
                              setIsValidatingGenomeGroup(false);
                              return;
                            }

                            if (genomes.length > MsaSnpAnalysis.MAX_GENOMES) {
                              toast.error("Genome group too large", {
                                description: `The genome group has ${genomes.length} genomes, but the maximum is ${MsaSnpAnalysis.MAX_GENOMES}.`,
                                closeButton: true,
                              });
                              setIsValidatingGenomeGroup(false);
                              return;
                            }

                            const genomeIds = genomes.map((g) => g.genome_id);

                            // Validate viral genomes
                            const validation = await validateViralGenomes(genomeIds, {
                              maxGenomeLength: MsaSnpAnalysis.MAX_GENOME_LENGTH,
                            });

                            if (!validation.allValid) {
                              const errorMessages = Object.values(validation.errors).filter(Boolean);
                              const errorMsg =
                                errorMessages.length > 0
                                  ? errorMessages.join("\n")
                                  : "Invalid genome group. Please check that all genomes are viruses with single contigs.";

                              toast.error("Genome group validation failed", {
                                description: errorMsg,
                                duration: 10000,
                                closeButton: true,
                              });
                              setIsValidatingGenomeGroup(false);
                              return;
                            }

                            // Replace the existing group (only one group allowed)
                            form.setValue("select_genomegroup", [inputValue]);
                            setSelectedGenomeGroupObject(null);

                          } catch (error) {
                            console.error("Failed to validate genome group:", error);
                            const errorMessage =
                              error instanceof Error
                                ? error.message
                                : "Failed to validate genome group";
                            toast.error("Validation error", {
                              description: errorMessage,
                              closeButton: true,
                            });
                          } finally {
                            setIsValidatingGenomeGroup(false);
                          }
                        }}
                        value={selectedGenomeGroupObject?.path}
                      />
                      {isValidatingGenomeGroup && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Spinner className="h-4 w-4" />
                          <span>Validating genome group...</span>
                        </div>
                      )}
                      <FormField
                        control={form.control}
                        name="select_genomegroup"
                        render={() => (
                          <FormItem>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {/* FASTA File Input */}
                  {inputType === "input_fasta" && (
                    <div className="space-y-2">
                      <WorkspaceObjectSelector
                        types={["feature_protein_fasta", "feature_dna_fasta"]}
                        placeholder="Select FASTA file"
                        onSelectedObjectChange={(
                          object: WorkspaceObject | null,
                        ) => {
                          if (!object || !object.path) {
                            setSelectedFastaObject(null);
                            return;
                          }

                          const inputValue = object.path;
                          
                          // Determine file type - default to DNA, check path for protein indicators
                          let type: MsaSnpAnalysis.FastaFileItem["type"] = "feature_dna_fasta";
                          const pathLower = inputValue.toLowerCase();
                          if (pathLower.includes("protein") || pathLower.includes("aa") || pathLower.includes("pep")) {
                            type = "feature_protein_fasta";
                          }

                          // Replace the existing file (only one file allowed)
                          const newFile = MsaSnpAnalysisUtils.createFastaFileItem(inputValue, type);
                          form.setValue("fasta_files", [newFile]);
                          setSelectedFastaObject(null);

                        }}
                        value={selectedFastaObject?.path}
                      />
                      <FormField
                        control={form.control}
                        name="fasta_files"
                        render={() => (
                          <FormItem>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {/* Input Sequence */}
                  {inputType === "input_sequence" && (
                    <div className="space-y-2">
                      <Textarea
                        value={fastaInputText}
                        onChange={(e) => setFastaInputText(e.target.value)}
                        placeholder="Enter FASTA records of sequences to align"
                        className="service-card-textarea"
                        rows={10}
                      />
                      {fastaValidationResult && (
                        <Alert
                          variant={
                            fastaValidationResult.valid
                              ? "default"
                              : "destructive"
                          }
                        >
                          <AlertDescription className="text-sm">
                            {fastaValidationResult.valid
                              ? `✓ Valid FASTA with ${fastaValidationResult.numseq} sequence${fastaValidationResult.numseq !== 1 ? "s" : ""}`
                              : fastaValidationResult.message}
                          </AlertDescription>
                        </Alert>
                      )}
                      <FormField
                        control={form.control}
                        name="fasta_keyboard_input"
                        render={() => (
                          <FormItem>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <FormLabel className="service-card-label">
                    Select an aligned FASTA file
                  </FormLabel>
                  <WorkspaceObjectSelector
                    types={["aligned_protein_fasta", "aligned_dna_fasta"]}
                    placeholder="Select aligned FASTA file"
                    onSelectedObjectChange={(
                      object: WorkspaceObject | null,
                    ) => {
                      if (!object || !object.path) {
                        setSelectedAlignedFastaObject(null);
                        return;
                      }

                      const inputValue = object.path;
                      
                      // Determine file type - default to DNA, check path for protein indicators
                      let type: MsaSnpAnalysis.FastaFileItem["type"] = "aligned_dna_fasta";
                      const pathLower = inputValue.toLowerCase();
                      if (pathLower.includes("protein") || pathLower.includes("aa") || pathLower.includes("pep")) {
                        type = "aligned_protein_fasta";
                      }

                      // Replace the existing file (only one file allowed)
                      const newFile = MsaSnpAnalysisUtils.createFastaFileItem(inputValue, type);
                      form.setValue("fasta_files", [newFile]);
                      setSelectedAlignedFastaObject(null);


                    }}
                    value={selectedAlignedFastaObject?.path}
                  />
                  <FormField
                    control={form.control}
                    name="fasta_files"
                    render={() => (
                      <FormItem>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

            </CardContent>
          </Card>

          {/* Reference Sequence */}
          <Card>
            <CardHeader className="service-card-header">
              <RequiredFormCardTitle className="service-card-title">
                Select a reference sequence:
              </RequiredFormCardTitle>
            </CardHeader>

            <CardContent className="service-card-content">
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="ref_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <RadioGroup
                          value={field.value}
                          onValueChange={(value) => {
                            field.onChange(value);
                            // Clear ref_string when changing ref_type
                            if (value === "none" || value === "first") {
                              form.setValue("ref_string", "");
                              setSelectedFeatureId("");
                              setSelectedGenomeId("");
                              setReferenceFastaText("");
                            }
                            // Close genome ID dropdown if ref_type changes away from genome_id
                            if (value !== "genome_id") {
                              setGenomeIdDropdownOpen(false);
                            }
                          }}
                          className="service-radio-group"
                        >
                          <div className="service-radio-group-item">
                            <RadioGroupItem value="none" id="ref_none" />
                            <Label htmlFor="ref_none">None</Label>
                          </div>
                          {availableRefTypes.includes("first" as const) && (
                            <div className="service-radio-group-item">
                              <RadioGroupItem value="first" id="ref_first" />
                              <Label htmlFor="ref_first">First Sequence</Label>
                            </div>
                          )}
                          {availableRefTypes.includes(
                            "feature_id" as const,
                          ) && (
                            <div className="service-radio-group-item">
                              <RadioGroupItem
                                value="feature_id"
                                id="ref_feature_id"
                              />
                              <Label htmlFor="ref_feature_id">Feature ID</Label>
                            </div>
                          )}
                          {availableRefTypes.includes("genome_id" as const) && (
                            <div className="service-radio-group-item">
                              <RadioGroupItem
                                value="genome_id"
                                id="ref_genome_id"
                              />
                              <Label htmlFor="ref_genome_id">Genome ID</Label>
                            </div>
                          )}
                          {availableRefTypes.includes("string" as const) && (
                            <div className="service-radio-group-item">
                              <RadioGroupItem value="string" id="ref_string" />
                              <Label htmlFor="ref_string">
                                Input Reference Sequence
                              </Label>
                            </div>
                          )}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Feature ID Reference */}
                {refType === "feature_id" && (
                  <div className="space-y-2">
                    <FormLabel className="service-card-label">
                      Feature ID
                    </FormLabel>
                    <Select
                      value={selectedFeatureId}
                      onValueChange={(value) => {
                        setSelectedFeatureId(value);
                        // Find the selected feature and use patric_id for ref_string
                        const selectedFeature = featureOptions.find(
                          (f) => f.feature_id === value,
                        );
                        const refValue = selectedFeature?.patric_id || selectedFeature?.feature_id || value;
                        form.setValue("ref_string", refValue);
                      }}
                      disabled={isLoadingFeatures}
                    >
                      <SelectTrigger className="service-card-select-trigger">
                        <SelectValue 
                          placeholder={
                            isLoadingFeatures
                              ? "Loading features..."
                              : featureOptions.length === 0
                              ? "No features available"
                              : "Select feature ID"
                          } 
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {isLoadingFeatures ? (
                          <div className="flex items-center justify-center p-4">
                            <Spinner className="h-4 w-4 mr-2" />
                            <span className="text-sm text-muted-foreground">
                              Loading features...
                            </span>
                          </div>
                        ) : featureOptions.length === 0 ? (
                          <div className="p-4 text-sm text-muted-foreground text-center">
                            No features found in the selected feature group
                          </div>
                        ) : (
                          featureOptions.map((feature) => {
                            const displayLabel = feature.patric_id
                              ? `${feature.patric_id}${feature.product ? ` --- ${feature.product}` : ""}`
                              : feature.feature_id;
                            return (
                              <SelectItem
                                key={feature.feature_id}
                                value={feature.feature_id}
                              >
                                {displayLabel}
                              </SelectItem>
                            );
                          })
                        )}
                      </SelectContent>
                    </Select>
                    {isLoadingFeatures && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Spinner className="h-4 w-4" />
                        <span>Loading features from feature group...</span>
                      </div>
                    )}
                    <FormField
                      control={form.control}
                      name="ref_string"
                      render={() => (
                        <FormItem>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {/* Genome ID Reference */}
                {refType === "genome_id" && (
                  <div className="space-y-2">
                    <FormLabel className="service-card-label">
                      Genome ID
                    </FormLabel>
                    <Select
                      value={selectedGenomeId}
                      open={genomeIdDropdownOpen}
                      onOpenChange={(open) => {
                        // Check if a valid genome group is selected before allowing dropdown to open
                        if (open && (!selectGenomegroup || selectGenomegroup.length === 0)) {
                          toast.error("Genome Group required", {
                            description: "A valid Genome Group is needed before selecting a Genome ID",
                            closeButton: true,
                          });
                          setGenomeIdDropdownOpen(false);
                          return;
                        }
                        setGenomeIdDropdownOpen(open);
                      }}
                      onValueChange={(value) => {
                        setSelectedGenomeId(value);
                        form.setValue("ref_string", value);
                      }}
                      disabled={isLoadingGenomes}
                    >
                      <SelectTrigger className="service-card-select-trigger">
                        <SelectValue 
                          placeholder={
                            isLoadingGenomes
                              ? "Loading genomes..."
                              : genomeOptions.length === 0
                              ? "No genomes available"
                              : "Select genome ID"
                          } 
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {isLoadingGenomes ? (
                          <div className="flex items-center justify-center p-4">
                            <Spinner className="h-4 w-4 mr-2" />
                            <span className="text-sm text-muted-foreground">
                              Loading genomes...
                            </span>
                          </div>
                        ) : genomeOptions.length === 0 ? (
                          <div className="p-4 text-sm text-muted-foreground text-center">
                            No genomes found in the selected genome group
                          </div>
                        ) : (
                          genomeOptions.map((genome) => {
                            const displayLabel = genome.genome_name
                              ? `${genome.genome_id} -- ${genome.genome_name}`
                              : genome.genome_id;
                            return (
                              <SelectItem
                                key={genome.genome_id}
                                value={genome.genome_id}
                              >
                                {displayLabel}
                              </SelectItem>
                            );
                          })
                        )}
                      </SelectContent>
                    </Select>
                    {isLoadingGenomes && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Spinner className="h-4 w-4" />
                        <span>Loading genomes from genome group...</span>
                      </div>
                    )}
                    <FormField
                      control={form.control}
                      name="ref_string"
                      render={() => (
                        <FormItem>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {/* Input Reference Sequence */}
                {refType === "string" && (
                  <div className="space-y-2">
                    <FormLabel className="service-card-label">
                      Input Reference Sequence
                    </FormLabel>
                    <Textarea
                      value={referenceFastaText}
                      onChange={(e) => setReferenceFastaText(e.target.value)}
                      placeholder="Enter a FASTA record of a reference sequence to align"
                      className="service-card-textarea"
                      rows={10}
                    />
                    {referenceFastaValidationResult && (
                      <Alert
                        variant={
                          referenceFastaValidationResult.valid
                            ? "default"
                            : "destructive"
                        }
                      >
                        <AlertDescription className="text-sm">
                          {referenceFastaValidationResult.valid
                            ? `✓ Valid FASTA with ${referenceFastaValidationResult.numseq} sequence`
                            : referenceFastaValidationResult.message}
                        </AlertDescription>
                      </Alert>
                    )}
                    <FormField
                      control={form.control}
                      name="ref_string"
                      render={() => (
                        <FormItem>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Parameters */}
          <Card>
            <CardHeader className="service-card-header">
              <RequiredFormCardTitle className="service-card-title">
                Parameters:
                <DialogInfoPopup
                  title={msaSNPAnalysisParameters.title}
                  description={msaSNPAnalysisParameters.description}
                  sections={msaSNPAnalysisParameters.sections}
                />
              </RequiredFormCardTitle>
            </CardHeader>

            <CardContent className="service-card-content">
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="aligner"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="service-card-label">
                        Aligner
                      </FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={(value) => {
                            field.onChange(value);
                            // Reset strategy when aligner changes to Muscle
                            if (value === "Muscle") {
                              form.setValue("strategy", undefined);
                              setShowStrategy(false);
                            } else {
                              form.setValue("strategy", "auto");
                            }
                          }}
                        >
                          <SelectTrigger className="service-card-select-trigger">
                            <SelectValue placeholder="Select aligner" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Mafft">Mafft</SelectItem>
                            <SelectItem value="Muscle">Muscle</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Strategy Options (only for Mafft and unaligned) */}
                {aligner === "Mafft" && inputStatus === "unaligned" && (
                  <Collapsible
                    open={showStrategy}
                    onOpenChange={setShowStrategy}
                    className="service-collapsible-container"
                  >
                    <CollapsibleTrigger className="service-collapsible-trigger text-sm font-medium">
                      Strategy Options
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${showStrategy ? "rotate-180 transform" : ""}`}
                      />
                    </CollapsibleTrigger>

                    <CollapsibleContent className="service-collapsible-content">
                      <FormField
                        control={form.control}
                        name="strategy"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <RadioGroup
                                value={field.value || "auto"}
                                onValueChange={field.onChange}
                                className="space-y-2 p-2"
                              >
                                {MsaSnpAnalysis.STRATEGY_OPTIONS.map(
                                  (option) => (
                                    <div
                                      key={option.value}
                                      className="flex items-center space-x-2"
                                    >
                                      <RadioGroupItem
                                        value={option.value}
                                        id={option.value}
                                      />
                                      <Label
                                        htmlFor={option.value}
                                        className="text-sm font-normal"
                                      >
                                        {option.label}
                                      </Label>
                                    </div>
                                  ),
                                )}
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CollapsibleContent>
                  </Collapsible>
                )}

                <div className="flex flex-col space-y-4">
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

          {/* Form Controls */}
          <div className="service-form-controls">
            <Button type="button" variant="outline" onClick={handleReset}>
              Reset
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !form.formState.isValid}
            >
              {isSubmitting ? <Spinner /> : null}
              Submit
            </Button>
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
