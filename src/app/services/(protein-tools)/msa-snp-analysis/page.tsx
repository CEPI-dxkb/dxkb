"use client";

import { useForm } from "@tanstack/react-form";
import { useSelector } from "@tanstack/react-store";
import { FieldItem, FieldErrors } from "@/components/ui/tanstack-form";
import { useState, useEffect, useRef } from "react";
import { useServiceRuntime } from "@/hooks/services/use-service-runtime";
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
import { ServiceOutputFields } from "@/components/services/service-output-fields";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import { WorkspaceObject } from "@/lib/services/workspace/types";
import { validateGenomeGroup } from "./validate-genome-group";
import { useFeatureGroupOptions } from "@/hooks/services/use-feature-group-options";
import { useGenomeGroupOptions } from "@/hooks/services/use-genome-group-options";
import { JobParamsDialog } from "@/components/services/job-params-dialog";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  msaSNPAnalysisInfo,
  msaSNPAnalysisStartWith,
} from "@/lib/services/info/msa-snp-analysis";
import {
  MsaParametersCard,
  MsaReferenceSequenceCard,
  MsaSequenceSelectionCard,
} from "./msa-snp-analysis-cards";
import * as MsaSnpAnalysis from "@/lib/forms/(protein-tools)/msa-snp-analysis/msa-snp-analysis-form-schema";
import * as MsaSnpAnalysisUtils from "@/lib/forms/(protein-tools)/msa-snp-analysis/msa-snp-analysis-form-utils";
import { msaSnpAnalysisService } from "@/lib/forms/(protein-tools)/msa-snp-analysis/msa-snp-analysis-service";

import { msaSNPAnalysisAligners } from "@/lib/forms/(protein-tools)/msa-snp-analysis/msa-snp-analysis-form-utils";

const emptyGenomeGroups: string[] = [];

function useMSAandSNPAnalysisPage() {
  const [_selectedFeatureGroupObject, setSelectedFeatureGroupObject] =
    useState<WorkspaceObject | null>(null);
  const [selectedFastaObject, setSelectedFastaObject] =
    useState<WorkspaceObject | null>(null);
  const [selectedAlignedFastaObject, setSelectedAlignedFastaObject] =
    useState<WorkspaceObject | null>(null);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string>("");
  const [selectedGenomeId, setSelectedGenomeId] = useState<string>("");
  const [fastaInputText, setFastaInputText] = useState<string>("");
  const [referenceFastaText, setReferenceFastaText] = useState<string>("");
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
  const genomeGroupValidationRequest = useRef(0);

  function handleReset() {
    genomeGroupValidationRequest.current += 1;
    setIsValidatingGenomeGroup(false);
    form.reset(MsaSnpAnalysis.defaultMsaSnpAnalysisFormValues);
    setSelectedFeatureGroupObject(null);
    setSelectedFastaObject(null);
    setSelectedAlignedFastaObject(null);
    setSelectedFeatureId("");
    setSelectedGenomeId("");
    setFastaInputText("");
    setReferenceFastaText("");
    setFastaValidationResult(null);
    setReferenceFastaValidationResult(null);
    setShowStrategy(false);
    setGenomeIdDropdownOpen(false);
    // Clear feature group selection
    form.setFieldValue("feature_groups", "");
  }

  const form = useForm({
    defaultValues: MsaSnpAnalysis.defaultMsaSnpAnalysisFormValues,
    validators: { onChange: MsaSnpAnalysis.msaSnpAnalysisFormSchema },
    onSubmit: async ({ value }) => {
      await runtime.submitFormData(value);
    },
  });

  const inputStatus = useSelector(form.store, (s) => s.values.input_status);
  const inputType = useSelector(form.store, (s) => s.values.input_type);
  const refType = useSelector(form.store, (s) => s.values.ref_type);
  const aligner = useSelector(form.store, (s) => s.values.aligner);
  const featureGroup = useSelector(form.store, (s) => s.values.feature_groups);
  const selectGenomegroup = useSelector(
    form.store,
    (state) => state.values.select_genomegroup ?? emptyGenomeGroups,
  );
  const canSubmit = useSelector(form.store, (s) => s.canSubmit);

  const runtime = useServiceRuntime({
    definition: msaSnpAnalysisService,
    form,
    onSuccess: handleReset,
    rerun: {
      onApply: (rerunData, form) => {
        const rawInputType = rerunData.input_type as string | undefined;
        if (rawInputType) {
          let inputTypeValue:
            MsaSnpAnalysis.MsaSnpAnalysisFormData["input_type"] | undefined;
          if (rawInputType === "input_group") {
            inputTypeValue = "input_feature_group";
          } else if (rawInputType === "input_genomegroup") {
            inputTypeValue = "input_genome_group";
          } else if (
            rawInputType === "input_fasta" ||
            rawInputType === "input_sequence"
          ) {
            inputTypeValue = rawInputType;
          }
          if (inputTypeValue) {
            form.setFieldValue("input_type", inputTypeValue);
          }
        }

        const featureGroupsRaw = normalizeToArray<string>(
          rerunData.feature_groups,
        );
        if (featureGroupsRaw.length > 0) {
          form.setFieldValue("feature_groups", featureGroupsRaw[0]);
        }

        const selectGenomegroupRaw = normalizeToArray<string>(
          rerunData.select_genomegroup,
        );
        if (selectGenomegroupRaw.length > 0) {
          form.setFieldValue("select_genomegroup", selectGenomegroupRaw);
        }

        const fastaFilesRaw = normalizeToArray<MsaSnpAnalysis.FastaFileItem>(
          rerunData.fasta_files,
        );
        if (fastaFilesRaw.length > 0) {
          form.setFieldValue("fasta_files", fastaFilesRaw);
        }

        if (
          typeof rerunData.fasta_keyboard_input === "string" &&
          rerunData.fasta_keyboard_input.trim() !== ""
        ) {
          const text = rerunData.fasta_keyboard_input;
          setFastaInputText(text);
          form.setFieldValue("fasta_keyboard_input", text);
        }

        if (
          typeof rerunData.ref_string === "string" &&
          rerunData.ref_string.trim() !== ""
        ) {
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

        if (rerunData.aligner === "Muscle") {
          form.setFieldValue("strategy", undefined);
        } else {
          const strategyVal = (rerunData.strategy ||
            rerunData.strategy_settings) as string | undefined;
          if (strategyVal && strategyVal.trim() !== "") {
            form.setFieldValue("strategy", strategyVal as never);
            setShowStrategy(true);
          }
        }
      },
    },
  });
  const { isSubmitting, jobParamsDialogProps } = runtime;

  function handleFastaInputChange(
    value: string,
    hasReferenceOverride?: boolean,
  ) {
    setFastaInputText(value);
    if (!value.trim()) {
      form.setFieldValue("fasta_keyboard_input", "");
      setFastaValidationResult(null);
      return;
    }

    const hasReference =
      hasReferenceOverride ??
      (refType === "string" && referenceFastaText.trim() !== "");
    const validation = MsaSnpAnalysisUtils.validateSequenceFasta(
      value,
      hasReference,
    );
    const valid = validation.valid && validation.meetsMinSequenceRequirement;
    setFastaValidationResult({
      valid,
      message: validation.meetsMinSequenceRequirement
        ? validation.message
        : `At least ${hasReference ? "one" : "two"} sequence(s) are required.`,
      numseq: validation.numseq,
    });
    form.setFieldValue(
      "fasta_keyboard_input",
      valid ? validation.trimFasta : "",
    );
  }

  function handleReferenceFastaChange(value: string) {
    setReferenceFastaText(value);
    handleFastaInputChange(
      fastaInputText,
      refType === "string" && value.trim() !== "",
    );
    if (!value.trim()) {
      form.setFieldValue("ref_string", "");
      setReferenceFastaValidationResult(null);
      return;
    }

    const validation = MsaSnpAnalysisUtils.validateReferenceFasta(value);
    const valid = validation.valid && validation.isSingleSequence;
    setReferenceFastaValidationResult({
      valid,
      message: validation.isSingleSequence
        ? validation.message
        : "Only one sequence is allowed.",
      numseq: validation.numseq,
    });
    form.setFieldValue("ref_string", valid ? validation.trimFasta : "");
  }

  async function validateAndSelectGenomeGroup(
    object: WorkspaceObject | null,
  ) {
    const inputValue = object?.path;
    if (!inputValue) {
      genomeGroupValidationRequest.current += 1;
        setIsValidatingGenomeGroup(false);
      return;
    }

    const request = ++genomeGroupValidationRequest.current;
    setIsValidatingGenomeGroup(true);

    try {
      const validation = await validateGenomeGroup(inputValue, {
        maxGenomes: MsaSnpAnalysis.maxGenomes,
        maxGenomeLength: MsaSnpAnalysis.maxGenomeLength,
      });
      if (request !== genomeGroupValidationRequest.current) return;

      if (validation.status !== "valid") {
        if (validation.status === "empty") {
          toast.error("Empty genome group", {
            description: "The selected genome group is empty.",
            closeButton: true,
          });
        } else if (validation.status === "too-large") {
          toast.error("Genome group too large", {
            description: `The genome group has ${String(validation.genomeCount)} genomes, but the maximum is ${String(MsaSnpAnalysis.maxGenomes)}.`,
            closeButton: true,
          });
        } else {
          toast.error("Genome group validation failed", {
            description: validation.message,
            duration: 10000,
            closeButton: true,
          });
        }
        setIsValidatingGenomeGroup(false);
        return;
      }

      const changed = form.state.values.select_genomegroup?.[0] !== inputValue;
      form.setFieldValue("select_genomegroup", [inputValue]);
        if (changed) {
        setSelectedGenomeId("");
        if (form.state.values.ref_type === "genome_id") {
          form.setFieldValue("ref_string", "");
        }
      }
    } catch (error) {
      if (request !== genomeGroupValidationRequest.current) return;
      console.error("Failed to validate genome group:", error);
      toast.error("Validation error", {
        description:
          error instanceof Error
            ? error.message
            : "Failed to validate genome group",
        closeButton: true,
      });
    }

    if (request === genomeGroupValidationRequest.current) {
      setIsValidatingGenomeGroup(false);
    }
  }

  const {
    features: featureOptions,
    isLoading: isLoadingFeatures,
    error: featureGroupError,
  } = useFeatureGroupOptions(featureGroup, refType === "feature_id");

  const {
    options: genomeOptions,
    isLoading: isLoadingGenomes,
    error: genomeGroupError,
  } = useGenomeGroupOptions(
    selectGenomegroup[0],
    refType === "genome_id" && selectGenomegroup.length > 0,
  );

  // Surface fetch errors via toast
  useEffect(() => {
    if (featureGroupError) {
      toast.error("Failed to load features", {
        description: featureGroupError,
        closeButton: true,
      });
    }
  }, [featureGroupError]);

  useEffect(() => {
    if (genomeGroupError) {
      toast.error("Failed to fetch genome IDs", {
        description: genomeGroupError,
        closeButton: true,
      });
    }
  }, [genomeGroupError]);

  let availableRefTypes: MsaSnpAnalysis.MsaSnpAnalysisFormData["ref_type"][];
  if (inputStatus === "aligned") {
    availableRefTypes = ["none", "first"];
  } else if (inputType === "input_feature_group") {
    availableRefTypes = ["none", "feature_id", "string"];
  } else if (inputType === "input_genome_group") {
    availableRefTypes = ["none", "genome_id", "string"];
  } else if (inputType === "input_fasta" || inputType === "input_sequence") {
    availableRefTypes = ["none", "first", "string"];
  } else {
    availableRefTypes = ["none", "string"];
  }

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
          void form.handleSubmit();
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
                      field.handleChange(
                        value as MsaSnpAnalysis.MsaSnpAnalysisFormData["input_status"],
                      );
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
        <MsaSequenceSelectionCard>
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
                          field.handleChange(
                            value as MsaSnpAnalysis.MsaSnpAnalysisFormData["input_type"],
                          );

                          // Only reset if the input type actually changed
                          if (previousInputType !== value) {
                            form.setFieldValue("ref_type", "none");
                            form.setFieldValue("ref_string", "");
                            setSelectedFeatureId("");
                            setSelectedGenomeId("");
                            setReferenceFastaText("");
                            setGenomeIdDropdownOpen(false);
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
                          <Label htmlFor="input_sequence">Input Sequence</Label>
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
                            preset="featureGroup"
                            placeholder="Select feature group"
                            onSelectedObjectChange={(
                              object: WorkspaceObject | null,
                            ) => {
                              if (!object || !object.path) {
                                field.handleChange("");
                                setSelectedFeatureGroupObject(null);
                                return;
                              }

                              const changed = field.state.value !== object.path;
                              field.handleChange(object.path);
                              setSelectedFeatureGroupObject(object);
                              if (changed) {
                                setSelectedFeatureId("");
                                if (refType === "feature_id") {
                                  form.setFieldValue("ref_string", "");
                                }
                              }
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
                            onValueChange={(value) => {
                              if (value != null)
                                field.handleChange(
                                  value as MsaSnpAnalysis.MsaSnpAnalysisFormData["alphabet"],
                                );
                            }}
                            className="service-radio-group-horizontal"
                          >
                            <div className="flex items-center gap-3">
                              <RadioGroupItem value="dna" id="dna" />
                              <Label htmlFor="dna">DNA</Label>
                            </div>
                            <div className="flex items-center gap-3">
                              <RadioGroupItem value="protein" id="protein" />
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
                      preset="genomeGroup"
                      placeholder="Select viral genome group"
                      onSelectedObjectChange={(object) => {
                        void validateAndSelectGenomeGroup(object);
                      }}
                      value={selectGenomegroup[0]}
                    />
                    {isValidatingGenomeGroup && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Spinner className="size-4" />
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
                      preset="featureFasta"
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
                        const newFile = MsaSnpAnalysisUtils.createFastaFileItem(
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
                      onChange={(e) => {
                        handleFastaInputChange(e.target.value);
                      }}
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
                            ? `✓ Valid FASTA with ${String(fastaValidationResult.numseq)} sequence${fastaValidationResult.numseq !== 1 ? "s" : ""}`
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
                  preset="alignedFasta"
                  placeholder="Select aligned FASTA file"
                  onSelectedObjectChange={(object: WorkspaceObject | null) => {
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
        </MsaSequenceSelectionCard>

        {/* Reference Sequence */}
        <MsaReferenceSequenceCard>
            <div className="space-y-4">
              <form.Field name="ref_type">
                {(field) => (
                  <FieldItem>
                    <RadioGroup
                      value={field.state.value}
                      onValueChange={(value) => {
                        if (value == null) return;
                        field.handleChange(
                          value as MsaSnpAnalysis.MsaSnpAnalysisFormData["ref_type"],
                        );
                        handleFastaInputChange(
                          fastaInputText,
                          value === "string" &&
                            referenceFastaText.trim() !== "",
                        );
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
                      {availableRefTypes.includes("feature_id" as const) && (
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
                  <Label className="service-card-label">Feature ID</Label>
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
                    <SelectTrigger
                      className="service-card-select-trigger"
                      aria-label="Select feature ID"
                    >
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
                          <Spinner className="mr-2 size-4" />
                          <span className="text-sm text-muted-foreground">
                            Loading features...
                          </span>
                        </div>
                      ) : featureOptions.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
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
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Spinner className="size-4" />
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
                  <Label className="service-card-label">Genome ID</Label>
                  <Select
                    value={selectedGenomeId}
                    open={genomeIdDropdownOpen}
                    onOpenChange={(open) => {
                      // Check if a valid genome group is selected before allowing dropdown to open
                      if (open && selectGenomegroup.length === 0) {
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
                    <SelectTrigger
                      className="service-card-select-trigger"
                      aria-label="Select genome ID"
                    >
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
                          <Spinner className="mr-2 size-4" />
                          <span className="text-sm text-muted-foreground">
                            Loading genomes...
                          </span>
                        </div>
                      ) : genomeOptions.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
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
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Spinner className="size-4" />
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
                    onChange={(e) => {
                      handleReferenceFastaChange(e.target.value);
                    }}
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
                          ? `✓ Valid FASTA with ${String(referenceFastaValidationResult.numseq)} sequence`
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
        </MsaReferenceSequenceCard>

        {/* Parameters */}
        <MsaParametersCard>
            <div className="space-y-4">
              <form.Field name="aligner">
                {(field) => (
                  <FieldItem>
                    <Label className="service-card-label">Aligner</Label>
                    <Select
                      items={msaSNPAnalysisAligners.map((aligner) => ({
                        value: aligner.value,
                        label: aligner.label,
                      }))}
                      value={field.state.value}
                      onValueChange={(value) => {
                        if (value == null) return;
                        field.handleChange(value);
                        // Reset strategy when aligner changes to Muscle
                        if (value === "Muscle") {
                          form.setFieldValue("strategy", undefined);
                          setShowStrategy(false);
                        } else {
                          form.setFieldValue("strategy", "auto");
                        }
                      }}
                    >
                      <SelectTrigger
                        className="service-card-select-trigger"
                        aria-label="Select aligner"
                      >
                        <SelectValue placeholder="Select aligner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {msaSNPAnalysisAligners.map((aligner) => (
                            <SelectItem
                              key={aligner.value}
                              value={aligner.value}
                            >
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
                      className={`size-4 transition-transform ${showStrategy ? "rotate-180 transform" : ""}`}
                    />
                  </CollapsibleTrigger>

                  <CollapsibleContent className="service-collapsible-content">
                    <form.Field name="strategy">
                      {(field) => (
                        <FieldItem>
                          <RadioGroup
                            value={field.state.value || "auto"}
                            onValueChange={(value) => {
                              if (value != null)
                                field.handleChange(
                                  value as MsaSnpAnalysis.MsaSnpAnalysisFormData["strategy"],
                                );
                            }}
                            className="grid w-full gap-2 p-2"
                          >
                            {MsaSnpAnalysis.strategyOptions.map((option) => (
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
                            ))}
                          </RadioGroup>
                          <FieldErrors field={field} />
                        </FieldItem>
                      )}
                    </form.Field>
                  </CollapsibleContent>
                </Collapsible>
              )}

              <form.Field name="output_path">
                {(outputPathField) => (
                  <form.Field name="output_file">
                    {(outputNameField) => (
                      <ServiceOutputFields
                        outputPath={{
                          value: outputPathField.state.value,
                          onChange: outputPathField.handleChange,
                          errors: <FieldErrors field={outputPathField} />,
                        }}
                        outputName={{
                          value: outputNameField.state.value,
                          onChange: outputNameField.handleChange,
                          errors: <FieldErrors field={outputNameField} />,
                        }}
                        onOutputNameValidationChange={setIsOutputNameValid}
                      />
                    )}
                  </form.Field>
                )}
              </form.Field>
            </div>
        </MsaParametersCard>

        {/* Form Controls */}
        <div className="service-form-controls">
          <Button type="button" variant="outline" onClick={handleReset}>
            Reset
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || !canSubmit || !isOutputNameValid}
          >
            {isSubmitting ? <Spinner /> : null}
            Submit
          </Button>
        </div>
      </form>

      <JobParamsDialog {...jobParamsDialogProps} />
    </section>
  );
}

export default function MSAandSNPAnalysisPage() {
  return useMSAandSNPAnalysisPage();
}
