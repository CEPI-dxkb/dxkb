"use client";

import { useForm, useStore } from "@tanstack/react-form";
import { FieldItem, FieldErrors } from "@/components/ui/tanstack-form";
import { useState, useMemo, useEffect } from "react";
import { useRerunForm } from "@/hooks/services/use-rerun-form";
import { useDefaultOutputPath } from "@/hooks/services/use-default-output-path";
import { normalizeToArray } from "@/lib/rerun-utility";
import { ServiceHeader } from "@/components/services/service-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import {
  fetchGenomeGroupMembers,
  validateViralGenomes,
  getGenomeIdsFromGroup,
  type GenomeSummary,
  fetchGenomesByIds,
} from "@/lib/services/genome";
import {
  fetchFeaturesFromGroup,
  type FeatureSummary,
} from "@/lib/services/feature";
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

import { msaSNPAnalysisAligners } from "@/lib/forms/(protein-tools)/msa-snp-analysis/msa-snp-analysis-form-utils";

export default function MSAandSNPAnalysisPage() {
  const [_selectedFeatureGroupObject, setSelectedFeatureGroupObject] =
    useState<WorkspaceObject | null>(null);
  const [_selectedGenomeGroupObject, setSelectedGenomeGroupObject] =
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
  const [isOutputNameValid, setIsOutputNameValid] = useState(true);
  const [isValidatingGenomeGroup, setIsValidatingGenomeGroup] = useState(false);

  function handleReset() {
    form.reset(MsaSnpAnalysis.defaultMsaSnpAnalysisFormValues);
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
    form.setFieldValue("feature_groups", "");
  }

  // Setup service debugging and form submission
  const {
    handleSubmit,
    showParamsDialog,
    setShowParamsDialog,
    currentParams,
    serviceName,
    isSubmitting,
  } = useServiceFormSubmission<MsaSnpAnalysis.MsaSnpAnalysisFormData>({
    serviceName: "MSA",
    displayName: "MSA SNP Analysis",
    transformParams: MsaSnpAnalysisUtils.transformMsaSnpAnalysisParams,
    onSuccess: handleReset,
  });

  const form = useForm({
    defaultValues: MsaSnpAnalysis.defaultMsaSnpAnalysisFormValues as MsaSnpAnalysis.MsaSnpAnalysisFormData,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validators: { onChange: MsaSnpAnalysis.msaSnpAnalysisFormSchema as any },
    onSubmit: async ({ value }) => {
      await handleSubmit(value as MsaSnpAnalysis.MsaSnpAnalysisFormData);
    },
  });

  const inputStatus = useStore(form.store, (s) => s.values.input_status);
  const inputType = useStore(form.store, (s) => s.values.input_type);
  const refType = useStore(form.store, (s) => s.values.ref_type);
  const aligner = useStore(form.store, (s) => s.values.aligner);
  const featureGroup = useStore(form.store, (s) => s.values.feature_groups);
  const rawSelectGenomegroup = useStore(form.store, (s) => s.values.select_genomegroup);
  const selectGenomegroup = useMemo(() => rawSelectGenomegroup || [], [rawSelectGenomegroup]);
  const outputPath = useStore(form.store, (s) => s.values.output_path);
  const canSubmit = useStore(form.store, (s) => s.canSubmit);

  // Rerun pre-fill
  const { rerunData, markApplied } = useRerunForm<Record<string, unknown>>();
  useDefaultOutputPath(form, rerunData);

  useEffect(() => {
    if (!rerunData || !markApplied()) return;

    // input_status (unaligned / aligned)
    if (typeof rerunData.input_status === "string") {
      form.setFieldValue("input_status", rerunData.input_status as MsaSnpAnalysis.MsaSnpAnalysisFormData["input_status"]);
    }

    // Map legacy API input_type values back to form values
    const rawInputType = rerunData.input_type as string | undefined;
    if (rawInputType) {
      let inputTypeValue: MsaSnpAnalysis.MsaSnpAnalysisFormData["input_type"] | undefined;
      if (rawInputType === "input_group") {
        inputTypeValue = "input_feature_group";
      } else if (rawInputType === "input_genomegroup") {
        inputTypeValue = "input_genome_group";
      } else if (rawInputType === "input_fasta" || rawInputType === "input_sequence") {
        inputTypeValue = rawInputType as MsaSnpAnalysis.MsaSnpAnalysisFormData["input_type"];
      }
      if (inputTypeValue) {
        form.setFieldValue("input_type", inputTypeValue);
      }
    }

    // feature_groups (API sends as array; form stores as single string)
    const featureGroupsRaw = normalizeToArray<string>(rerunData.feature_groups);
    if (featureGroupsRaw.length > 0) {
      form.setFieldValue("feature_groups", featureGroupsRaw[0]);
    }

    // alphabet
    if (typeof rerunData.alphabet === "string") {
      const alphabetVal = rerunData.alphabet as MsaSnpAnalysis.MsaSnpAnalysisFormData["alphabet"];
      form.setFieldValue("alphabet", alphabetVal);
    }

    // select_genomegroup
    const selectGenomegroupRaw = normalizeToArray<string>(rerunData.select_genomegroup);
    if (selectGenomegroupRaw.length > 0) {
      form.setFieldValue("select_genomegroup", selectGenomegroupRaw);
    }

    // fasta_files
    const fastaFilesRaw = normalizeToArray<MsaSnpAnalysis.FastaFileItem>(rerunData.fasta_files);
    if (fastaFilesRaw.length > 0) {
      form.setFieldValue("fasta_files", fastaFilesRaw);
    }

    // fasta_keyboard_input
    if (typeof rerunData.fasta_keyboard_input === "string" && rerunData.fasta_keyboard_input.trim() !== "") {
      const text = rerunData.fasta_keyboard_input;
      setFastaInputText(text);
      form.setFieldValue("fasta_keyboard_input", text);
    }

    // ref_type
    if (typeof rerunData.ref_type === "string") {
      form.setFieldValue("ref_type", rerunData.ref_type as MsaSnpAnalysis.MsaSnpAnalysisFormData["ref_type"]);
    }

    // ref_string — also restore the relevant UI state variables
    if (typeof rerunData.ref_string === "string" && rerunData.ref_string.trim() !== "") {
      form.setFieldValue("ref_string", rerunData.ref_string);
      const resolvedRefType = rerunData.ref_type as string | undefined;
      if (resolvedRefType === "feature_id") {
        setSelectedFeatureId(rerunData.ref_string);
      } else if (resolvedRefType === "genome_id") {
        setSelectedGenomeId(rerunData.ref_string);
      } else if (resolvedRefType === "string") {
        setReferenceFastaText(rerunData.ref_string);
      }
    }

    // aligner
    if (typeof rerunData.aligner === "string") {
      form.setFieldValue("aligner", rerunData.aligner as MsaSnpAnalysis.MsaSnpAnalysisFormData["aligner"]);
    }

    // strategy (API stores as "strategy" or "strategy_settings", but always
    // sets strategy_settings:"auto" even for Muscle jobs as a backend default)
    if (rerunData.aligner === "Muscle") {
      // Muscle doesn't support strategy — clear the default "auto" value to
      // avoid a schema validation error ("Strategy is only available for Mafft").
      form.setFieldValue("strategy", undefined);
    } else {
      const strategyVal = (rerunData.strategy || rerunData.strategy_settings) as string | undefined;
      if (strategyVal && strategyVal.trim() !== "") {
        form.setFieldValue("strategy", strategyVal as MsaSnpAnalysis.MsaSnpAnalysisFormData["strategy"]);
        setShowStrategy(true);
      }
    }

    // output_path / output_file
    if (typeof rerunData.output_path === "string") {
      form.setFieldValue("output_path", rerunData.output_path);
    }
    if (typeof rerunData.output_file === "string") {
      form.setFieldValue("output_file", rerunData.output_file);
    }
  }, [rerunData, markApplied, form]);

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
      form.setFieldValue("fasta_keyboard_input", "");
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
      form.setFieldValue("fasta_keyboard_input", validation.trimFasta);
    }
  }, [fastaInputText, refType, referenceFastaText, form]);

  // Validate reference FASTA input when text changes
  useEffect(() => {
    if (!referenceFastaText.trim()) {
      setReferenceFastaValidationResult(null);
      // Only clear ref_string when the "string" ref type controls it.
      // For "feature_id" / "genome_id", ref_string is set by the dropdown
      // and must not be wiped out (e.g. after a rerun pre-fill).
      if (refType === "string") {
        form.setFieldValue("ref_string", "");
      }
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
      form.setFieldValue("ref_string", validation.trimFasta);
    }
  }, [referenceFastaText, refType, form]);

  // Fetch features from feature group when Feature ID reference is selected
  useEffect(() => {
    const shouldFetch =
      refType === "feature_id" && featureGroup && featureGroup.trim() !== "";

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
    const shouldFetch =
      refType === "genome_id" &&
      selectGenomegroup &&
      selectGenomegroup.length > 0;

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

        // Fetch summaries for only the genomes in the selected group
        const groupGenomes = await fetchGenomesByIds(genomeIds, {
          signal: abortController.signal,
        });

        setGenomeOptions(
          groupGenomes.map((genome) => ({
            genome_id: genome.genome_id,
            genome_name: genome.genome_name,
          })),
        );
      } catch (error) {
        console.error("Failed to fetch genome IDs:", error);
        toast.error("Failed to fetch genome IDs", {
          description:
            error instanceof Error
              ? error.message
              : "Failed to fetch genome IDs",
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

  // Determine which reference options are available
  const availableRefTypes = useMemo((): MsaSnpAnalysis.MsaSnpAnalysisFormData["ref_type"][] => {
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

      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
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
            <form.Field name="input_status">
              {(field) => (
                <FieldItem>
                  <RadioGroup
                    value={field.state.value}
                    onValueChange={(value) => {
                      if (value == null) return;
                      const previousStatus = field.state.value;
                      field.handleChange(value as MsaSnpAnalysis.MsaSnpAnalysisFormData["input_status"]);
                      // Reset input type when status changes
                      if (value === "aligned") {
                        form.setFieldValue("input_type", undefined);
                      } else {
                        form.setFieldValue("input_type", "input_feature_group");
                      }
                      // Reset reference type to "none" when input status changes
                      if (previousStatus !== value) {
                        form.setFieldValue("ref_type", "none");
                        form.setFieldValue("ref_string", "");
                        setSelectedFeatureId("");
                        setSelectedGenomeId("");
                        setReferenceFastaText("");
                        setGenomeIdDropdownOpen(false);
                        setFeatureOptions([]);
                      }
                    }}
                    className="service-radio-group-horizontal"
                  >
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="unaligned" id="unaligned" />
                      <Label htmlFor="unaligned">Unaligned Sequences</Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="aligned" id="aligned" />
                      <Label htmlFor="aligned">Aligned Sequences</Label>
                    </div>
                  </RadioGroup>
                  <FieldErrors field={field} />
                </FieldItem>
              )}
            </form.Field>
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
                <form.Field name="input_type">
                  {(field) => (
                    <FieldItem>
                      <RadioGroup
                        value={field.state.value}
                        onValueChange={(value) => {
                          if (value == null) return;
                          // Reset reference type to "none" when input type changes
                          const previousInputType = field.state.value;
                          field.handleChange(value as MsaSnpAnalysis.MsaSnpAnalysisFormData["input_type"]);

                          // Only reset if the input type actually changed
                          if (previousInputType !== value) {
                            form.setFieldValue("ref_type", "none");
                            form.setFieldValue("ref_string", "");
                            setSelectedFeatureId("");
                            setSelectedGenomeId("");
                            setReferenceFastaText("");
                            setGenomeIdDropdownOpen(false);
                            setFeatureOptions([]);
                          }
                        }}
                        className="service-radio-group-horizontal"
                      >
                        <div className="flex items-center gap-3">
                          <RadioGroupItem
                            value="input_feature_group"
                            id="input_feature_group"
                          />
                          <Label htmlFor="input_feature_group">
                            Feature Group
                          </Label>
                        </div>
                        <div className="flex items-center gap-3">
                          <RadioGroupItem
                            value="input_genome_group"
                            id="input_genome_group"
                          />
                          <Label htmlFor="input_genome_group">
                            Viral Genome Group
                          </Label>
                        </div>
                        <div className="flex items-center gap-3">
                          <RadioGroupItem
                            value="input_fasta"
                            id="input_fasta"
                          />
                          <Label htmlFor="input_fasta">
                            DNA or Protein FASTA File
                          </Label>
                        </div>
                        <div className="flex items-center gap-3">
                          <RadioGroupItem
                            value="input_sequence"
                            id="input_sequence"
                          />
                          <Label htmlFor="input_sequence">
                            Input Sequence
                          </Label>
                        </div>
                      </RadioGroup>
                      <FieldErrors field={field} />
                    </FieldItem>
                  )}
                </form.Field>

                {/* Feature Group Input */}
                {inputType === "input_feature_group" && (
                  <div className="space-y-4">
                    <form.Field name="feature_groups">
                      {(field) => (
                        <FieldItem>
                          <WorkspaceObjectSelector
                            types={["feature_group"]}
                            placeholder="Select feature group"
                            onSelectedObjectChange={(
                              object: WorkspaceObject | null,
                            ) => {
                              if (!object || !object.path) {
                                field.handleChange("");
                                setSelectedFeatureGroupObject(null);
                                return;
                              }

                              field.handleChange(object.path);
                              setSelectedFeatureGroupObject(object);
                            }}
                            value={field.state.value}
                          />
                          <FieldErrors field={field} />
                        </FieldItem>
                      )}
                    </form.Field>

                    <form.Field name="alphabet">
                      {(field) => (
                        <FieldItem>
                          <RadioGroup
                            value={field.state.value}
                            onValueChange={(value) => value != null && field.handleChange(value as MsaSnpAnalysis.MsaSnpAnalysisFormData["alphabet"])}
                            className="service-radio-group-horizontal"
                          >
                            <div className="flex items-center gap-3">
                              <RadioGroupItem value="dna" id="dna" />
                              <Label htmlFor="dna">DNA</Label>
                            </div>
                            <div className="flex items-center gap-3">
                              <RadioGroupItem
                                value="protein"
                                id="protein"
                              />
                              <Label htmlFor="protein">Protein</Label>
                            </div>
                          </RadioGroup>
                          <FieldErrors field={field} />
                        </FieldItem>
                      )}
                    </form.Field>
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
                          const genomes =
                            await fetchGenomeGroupMembers(inputValue);

                          if (genomes.length === 0) {
                            toast.error("Empty genome group", {
                              description:
                                "The selected genome group is empty.",
                              closeButton: true,
                            });
                            setIsValidatingGenomeGroup(false);
                            return;
                          }

                          if (genomes.length > MsaSnpAnalysis.maxGenomes) {
                            toast.error("Genome group too large", {
                              description: `The genome group has ${genomes.length} genomes, but the maximum is ${MsaSnpAnalysis.maxGenomes}.`,
                              closeButton: true,
                            });
                            setIsValidatingGenomeGroup(false);
                            return;
                          }

                          const genomeIds = genomes.map((g) => g.genome_id);

                          // Validate viral genomes
                          const validation = await validateViralGenomes(
                            genomeIds,
                            {
                              maxGenomeLength:
                                MsaSnpAnalysis.maxGenomeLength,
                            },
                          );

                          if (!validation.allValid) {
                            const errorMessages = Object.values(
                              validation.errors,
                            ).filter(Boolean);
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
                          form.setFieldValue("select_genomegroup", [inputValue]);
                          setSelectedGenomeGroupObject(null);
                        } catch (error) {
                          console.error(
                            "Failed to validate genome group:",
                            error,
                          );
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
                      value={selectGenomegroup[0]}
                    />
                    {isValidatingGenomeGroup && (
                      <div className="text-muted-foreground flex items-center gap-2 text-sm">
                        <Spinner className="h-4 w-4" />
                        <span>Validating genome group...</span>
                      </div>
                    )}
                    <form.Field name="select_genomegroup">
                      {(field) => (
                        <FieldItem>
                          <FieldErrors field={field} />
                        </FieldItem>
                      )}
                    </form.Field>
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
                        let type: MsaSnpAnalysis.FastaFileItem["type"] =
                          "feature_dna_fasta";
                        const pathLower = inputValue.toLowerCase();
                        if (
                          pathLower.includes("protein") ||
                          pathLower.includes("aa") ||
                          pathLower.includes("pep")
                        ) {
                          type = "feature_protein_fasta";
                        }

                        // Replace the existing file (only one file allowed)
                        const newFile =
                          MsaSnpAnalysisUtils.createFastaFileItem(
                            inputValue,
                            type,
                          );
                        form.setFieldValue("fasta_files", [newFile]);
                        setSelectedFastaObject(null);
                      }}
                      value={selectedFastaObject?.path}
                    />
                    <form.Field name="fasta_files">
                      {(field) => (
                        <FieldItem>
                          <FieldErrors field={field} />
                        </FieldItem>
                      )}
                    </form.Field>
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
                    <form.Field name="fasta_keyboard_input">
                      {(field) => (
                        <FieldItem>
                          <FieldErrors field={field} />
                        </FieldItem>
                      )}
                    </form.Field>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="service-card-label">
                  Select an aligned FASTA file
                </Label>
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
                    let type: MsaSnpAnalysis.FastaFileItem["type"] =
                      "aligned_dna_fasta";
                    const pathLower = inputValue.toLowerCase();
                    if (
                      pathLower.includes("protein") ||
                      pathLower.includes("aa") ||
                      pathLower.includes("pep")
                    ) {
                      type = "aligned_protein_fasta";
                    }

                    // Replace the existing file (only one file allowed)
                    const newFile = MsaSnpAnalysisUtils.createFastaFileItem(
                      inputValue,
                      type,
                    );
                    form.setFieldValue("fasta_files", [newFile]);
                    setSelectedAlignedFastaObject(null);
                  }}
                  value={selectedAlignedFastaObject?.path}
                />
                <form.Field name="fasta_files">
                  {(field) => (
                    <FieldItem>
                      <FieldErrors field={field} />
                    </FieldItem>
                  )}
                </form.Field>
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
              <form.Field name="ref_type">
                {(field) => (
                  <FieldItem>
                    <RadioGroup
                      value={field.state.value}
                      onValueChange={(value) => {
                        if (value == null) return;
                        field.handleChange(value as MsaSnpAnalysis.MsaSnpAnalysisFormData["ref_type"]);
                        // Clear ref_string when changing ref_type
                        if (value === "none" || value === "first") {
                          form.setFieldValue("ref_string", "");
                          setSelectedFeatureId("");
                          setSelectedGenomeId("");
                          setReferenceFastaText("");
                        }
                        // Close genome ID dropdown if ref_type changes away from genome_id
                        if (value !== "genome_id") {
                          setGenomeIdDropdownOpen(false);
                        }
                      }}
                      className="service-radio-group-horizontal"
                    >
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value="none" id="ref_none" />
                        <Label htmlFor="ref_none">None</Label>
                      </div>
                      {availableRefTypes.includes("first" as const) && (
                        <div className="flex items-center gap-3">
                          <RadioGroupItem value="first" id="ref_first" />
                          <Label htmlFor="ref_first">First Sequence</Label>
                        </div>
                      )}
                      {availableRefTypes.includes(
                        "feature_id" as const,
                      ) && (
                        <div className="flex items-center gap-3">
                          <RadioGroupItem
                            value="feature_id"
                            id="ref_feature_id"
                          />
                          <Label htmlFor="ref_feature_id">Feature ID</Label>
                        </div>
                      )}
                      {availableRefTypes.includes("genome_id" as const) && (
                        <div className="flex items-center gap-3">
                          <RadioGroupItem
                            value="genome_id"
                            id="ref_genome_id"
                          />
                          <Label htmlFor="ref_genome_id">Genome ID</Label>
                        </div>
                      )}
                      {availableRefTypes.includes("string" as const) && (
                        <div className="flex items-center gap-3">
                          <RadioGroupItem value="string" id="ref_string" />
                          <Label htmlFor="ref_string">
                            Input Reference Sequence
                          </Label>
                        </div>
                      )}
                    </RadioGroup>
                    <FieldErrors field={field} />
                  </FieldItem>
                )}
              </form.Field>

              {/* Feature ID Reference */}
              {refType === "feature_id" && (
                <div className="space-y-2">
                  <Label className="service-card-label">
                    Feature ID
                  </Label>
                  <Select
                    value={selectedFeatureId}
                    onValueChange={(value) => {
                      if (value == null) return;
                      setSelectedFeatureId(value);
                      // Find the selected feature and use patric_id for ref_string
                      const selectedFeature = featureOptions.find(
                        (f) => f.feature_id === value,
                      );
                      const refValue =
                        selectedFeature?.patric_id ||
                        selectedFeature?.feature_id ||
                        value;
                      form.setFieldValue("ref_string", refValue);
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
                          <Spinner className="mr-2 h-4 w-4" />
                          <span className="text-muted-foreground text-sm">
                            Loading features...
                          </span>
                        </div>
                      ) : featureOptions.length === 0 ? (
                        <div className="text-muted-foreground p-4 text-center text-sm">
                          No features found in the selected feature group
                        </div>
                      ) : (
                        <SelectGroup>
                          {featureOptions.map((feature) => {
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
                          })}
                        </SelectGroup>
                      )}
                    </SelectContent>
                  </Select>
                  {isLoadingFeatures && (
                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                      <Spinner className="h-4 w-4" />
                      <span>Loading features from feature group...</span>
                    </div>
                  )}
                  <form.Field name="ref_string">
                    {(field) => (
                      <FieldItem>
                        <FieldErrors field={field} />
                      </FieldItem>
                    )}
                  </form.Field>
                </div>
              )}

              {/* Genome ID Reference */}
              {refType === "genome_id" && (
                <div className="space-y-2">
                  <Label className="service-card-label">
                    Genome ID
                  </Label>
                  <Select
                    value={selectedGenomeId}
                    open={genomeIdDropdownOpen}
                    onOpenChange={(open) => {
                      // Check if a valid genome group is selected before allowing dropdown to open
                      if (
                        open &&
                        (!selectGenomegroup || selectGenomegroup.length === 0)
                      ) {
                        toast.error("Genome Group required", {
                          description:
                            "A valid Genome Group is needed before selecting a Genome ID",
                          closeButton: true,
                        });
                        setGenomeIdDropdownOpen(false);
                        return;
                      }
                      setGenomeIdDropdownOpen(open);
                    }}
                    onValueChange={(value) => {
                      if (value == null) return;
                      setSelectedGenomeId(value);
                      form.setFieldValue("ref_string", value);
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
                          <Spinner className="mr-2 h-4 w-4" />
                          <span className="text-muted-foreground text-sm">
                            Loading genomes...
                          </span>
                        </div>
                      ) : genomeOptions.length === 0 ? (
                        <div className="text-muted-foreground p-4 text-center text-sm">
                          No genomes found in the selected genome group
                        </div>
                      ) : (
                        <SelectGroup>
                          {genomeOptions.map((genome) => {
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
                          })}
                        </SelectGroup>
                      )}
                    </SelectContent>
                  </Select>
                  {isLoadingGenomes && (
                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                      <Spinner className="h-4 w-4" />
                      <span>Loading genomes from genome group...</span>
                    </div>
                  )}
                  <form.Field name="ref_string">
                    {(field) => (
                      <FieldItem>
                        <FieldErrors field={field} />
                      </FieldItem>
                    )}
                  </form.Field>
                </div>
              )}

              {/* Input Reference Sequence */}
              {refType === "string" && (
                <div className="space-y-2">
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
                  <form.Field name="ref_string">
                    {(field) => (
                      <FieldItem>
                        <FieldErrors field={field} />
                      </FieldItem>
                    )}
                  </form.Field>
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
              <form.Field name="aligner">
                {(field) => (
                  <FieldItem>
                    <Label className="service-card-label">
                      Aligner
                    </Label>
                    <Select
                      items={msaSNPAnalysisAligners.map((aligner) => ({ value: aligner.value, label: aligner.label }))}
                      value={field.state.value}
                      onValueChange={(value) => {
                        if (value == null) return;
                        field.handleChange(value as MsaSnpAnalysis.MsaSnpAnalysisFormData["aligner"]);
                        // Reset strategy when aligner changes to Muscle
                        if (value === "Muscle") {
                          form.setFieldValue("strategy", undefined);
                          setShowStrategy(false);
                        } else {
                          form.setFieldValue("strategy", "auto");
                        }
                      }}
                    >
                      <SelectTrigger className="service-card-select-trigger">
                        <SelectValue placeholder="Select aligner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {msaSNPAnalysisAligners.map((aligner) => (
                            <SelectItem key={aligner.value} value={aligner.value}>
                              {aligner.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FieldErrors field={field} />
                  </FieldItem>
                )}
              </form.Field>

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
                    <form.Field name="strategy">
                      {(field) => (
                        <FieldItem>
                          <RadioGroup
                            value={field.state.value || "auto"}
                            onValueChange={(value) => value != null && field.handleChange(value as MsaSnpAnalysis.MsaSnpAnalysisFormData["strategy"])}
                            className="grid gap-2 w-full p-2"
                          >
                            {MsaSnpAnalysis.strategyOptions.map(
                              (option) => (
                                <div
                                  key={option.value}
                                  className="flex items-center gap-3"
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
                          <FieldErrors field={field} />
                        </FieldItem>
                      )}
                    </form.Field>
                  </CollapsibleContent>
                </Collapsible>
              )}

              <div className="flex flex-col space-y-4">
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
            disabled={
              isSubmitting || !canSubmit || !isOutputNameValid
            }
          >
            {isSubmitting ? <Spinner /> : null}
            Submit
          </Button>
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
