"use client";

import { useForm } from "@tanstack/react-form";
import { useSelector } from "@tanstack/react-store";
import {
  FieldItem,
  FieldErrors,
  fieldErrorMessage,
} from "@/components/ui/tanstack-form";
import { useState, useEffect } from "react";
import { useServiceRuntime } from "@/hooks/services/use-service-runtime";
import { normalizeToArray } from "@/lib/rerun-utility";
import { ServiceHeader } from "@/components/services/service-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ChevronDown } from "lucide-react";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import { ServiceOutputFields } from "@/components/services/service-output-fields";
import { FieldErrorDetails } from "@/components/services/field-error-details";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import { WorkspaceObject } from "@/lib/services/workspace/types";
import { genomeGroupRejection, validateGenomeGroup } from "./validate-genome-group";
import { checkFastaFile } from "./validate-fasta-file";
import { usePickCheck } from "./use-pick-check";
import { useWorkspaceRepository } from "@/contexts/workspace-repository-context";
import { useFeatureGroupOptions } from "@/hooks/services/use-feature-group-options";
import { useGenomeGroupOptions } from "@/hooks/services/use-genome-group-options";
import { JobParamsDialog } from "@/components/services/job-params-dialog";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import {
  ServiceCardContent,
  ServiceCardHeader,
} from "@/components/services/form-ui/service-card";
import {
  ServiceCollapsible,
  ServiceCollapsibleContent,
  ServiceCollapsibleTrigger,
} from "@/components/services/form-ui/service-collapsible";
import { ServiceTextarea } from "@/components/services/form-ui/service-input";
import { ServiceLabel } from "@/components/services/form-ui/service-label";
import { ServiceRadioGroup } from "@/components/services/form-ui/service-radio-group";
import { ServiceSelectTrigger } from "@/components/services/form-ui/service-select";
import { ServiceSubmitError } from "@/components/services/form-ui/service-submit-error";
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
import { cn } from "@/lib/utils";

import { msaSNPAnalysisAligners } from "@/lib/forms/(protein-tools)/msa-snp-analysis/msa-snp-analysis-form-utils";

const emptyGenomeGroups: string[] = [];
const featureOptionsErrorTitle = "Failed to load features";
const featureOptionsToastId = "msa-feature-options-error";
const genomeOptionsErrorTitle = "Failed to fetch genome IDs";
const genomeOptionsToastId = "msa-genome-options-error";

/**
 * A FASTA textarea with the one status line under it, as BLAST's
 * `FastaTextarea` draws them: the border turns destructive (`aria-invalid`) or
 * success (`valid`), and a single message names the problem or the valid
 * count. `error` is the FASTA's own message, or the form's when the FASTA has
 * none, so the "required" error does not stack under it. The line is always
 * present, so the card does not resize as the state changes.
 */
function FastaTextareaStatus({
  value,
  onChange,
  placeholder,
  error,
  validMessage,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  error: string | null;
  validMessage: string | null;
}) {
  const hasError = Boolean(error);
  return (
    <div className="space-y-2">
      <ServiceTextarea
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        placeholder={placeholder}
        rows={10}
        aria-invalid={hasError || undefined}
        variant={!hasError && validMessage ? "valid" : undefined}
      />
      <p
        role="status"
        className={cn(
          "min-h-5 text-sm",
          hasError ? "text-destructive" : "text-success",
        )}
      >
        {hasError ? error : validMessage}
      </p>
    </div>
  );
}

function useMSAandSNPAnalysisPage() {
  const [selectedFeatureId, setSelectedFeatureId] = useState<string>("");
  const [selectedGenomeId, setSelectedGenomeId] = useState<string>("");
  const [fastaInputText, setFastaInputText] = useState<string>("");
  const [referenceFastaText, setReferenceFastaText] = useState<string>("");
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
  const workspaceRepository = useWorkspaceRepository();
  const genomeGroupCheck = usePickCheck();
  const fastaFileCheck = usePickCheck();

  function handleReset() {
    genomeGroupCheck.cancel();
    fastaFileCheck.cancel();
    form.reset(MsaSnpAnalysis.defaultMsaSnpAnalysisFormValues);
    setSelectedFeatureId("");
    setSelectedGenomeId("");
    setFastaInputText("");
    setReferenceFastaText("");
    setFastaValidationResult(null);
    setReferenceFastaValidationResult(null);
    setShowStrategy(false);
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

  // Swap-clears must not touch or validate the field a choice swaps in, or it
  // opens on "required" in production (BLAST's `untouched`; docs/architecture.md).
  const untouched = { dontUpdateMeta: true, dontValidate: true };

  function handleFastaInputChange(
    value: string,
    hasReferenceOverride?: boolean,
    programmatic = false,
  ) {
    setFastaInputText(value);
    if (!value.trim()) {
      // A re-check from the reference controls must not mark an untouched
      // textarea touched, or "FASTA sequence input is required" shows before
      // the user has typed. `dontUpdateMeta` alone is not enough:
      // `setFieldValue` still validates a mounted field, and that marks it
      // touched. Typing keeps the default, so clearing the textarea shows it.
      form.setFieldValue(
        "fasta_keyboard_input",
        "",
        programmatic ? untouched : undefined,
      );
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
      true,
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

  /** Drops the reference picked from a group, when the group changes. */
  function clearGroupReference(kind: "feature_id" | "genome_id") {
    if (kind === "feature_id") setSelectedFeatureId("");
    else setSelectedGenomeId("");
    if (form.state.values.ref_type === kind) {
      form.setFieldValue("ref_string", "", untouched);
    }
  }

  /**
   * A picked group enters the form only once it validates. Until then the
   * form holds none, so neither Submit nor the Genome ID list can use the
   * group picked before it, and a rejected group stays on screen in its
   * error state, with its message under it.
   */
  function selectGenomeGroup(object: WorkspaceObject | null) {
    const path = object?.path;
    if (form.state.values.select_genomegroup?.[0] !== path) {
      clearGroupReference("genome_id");
    }
    if (!path) {
      // Typing in the selector drops the pick.
      genomeGroupCheck.cancel();
      form.setFieldValue("select_genomegroup", []);
      return;
    }

    form.setFieldValue("select_genomegroup", [], untouched);
    void genomeGroupCheck.start(path, {
      check: async () => {
        try {
          const validation = await validateGenomeGroup(path, {
            maxGenomes: MsaSnpAnalysis.maxGenomes,
            maxGenomeLength: MsaSnpAnalysis.maxGenomeLength,
          });
          if (validation.status === "valid") return null;
          return genomeGroupRejection(validation, MsaSnpAnalysis.maxGenomes);
        } catch (error) {
          console.error("Failed to validate genome group:", error);
          const message =
            error instanceof Error
              ? error.message
              : "Failed to validate genome group";
          return { title: "Could not validate the genome group", message };
        }
      },
      onPass: () => {
        form.setFieldValue("select_genomegroup", [path]);
      },
      onReject: () => {
        form.setFieldValue("select_genomegroup", []);
      },
    });
  }

  /**
   * A picked unaligned FASTA file is read and checked as legacy checks it,
   * and enters the form, as a group does, only once it passes. Aligned files
   * go straight in: legacy checks only these.
   */
  function selectFastaFile(object: WorkspaceObject | null) {
    if (!object?.path) {
      fastaFileCheck.cancel();
      form.setFieldValue("fasta_files", []);
      return;
    }

    const file = MsaSnpAnalysisUtils.fastaFileFromObject(object, "feature");
    form.setFieldValue("fasta_files", [], untouched);
    void fastaFileCheck.start(file.file, {
      check: () => checkFastaFile(workspaceRepository, file),
      onPass: () => {
        form.setFieldValue("fasta_files", [file]);
      },
      onReject: () => {
        form.setFieldValue("fasta_files", []);
      },
    });
  }

  const {
    features: featureOptions,
    isLoading: isLoadingFeatures,
    error: featureOptionsError,
  } = useFeatureGroupOptions(featureGroup, refType === "feature_id");

  const {
    options: genomeOptions,
    isLoading: isLoadingGenomes,
    error: genomeOptionsError,
  } = useGenomeGroupOptions(
    selectGenomegroup[0],
    refType === "genome_id" && selectGenomegroup.length > 0,
  );

  // A load error's toast stays until it is closed, or until the load
  // succeeds; the field keeps its summary.
  useEffect(() => {
    if (featureOptionsError) {
      toast.error(featureOptionsErrorTitle, {
        id: featureOptionsToastId,
        description: featureOptionsError,
        closeButton: true,
        duration: Infinity,
      });
    } else {
      toast.dismiss(featureOptionsToastId);
    }
  }, [featureOptionsError]);

  useEffect(() => {
    if (genomeOptionsError) {
      toast.error(genomeOptionsErrorTitle, {
        id: genomeOptionsToastId,
        description: genomeOptionsError,
        closeButton: true,
        duration: Infinity,
      });
    } else {
      toast.dismiss(genomeOptionsToastId);
    }
  }, [genomeOptionsError]);

  const isValidatingGenomeGroup = genomeGroupCheck.isValidating;
  const isCheckingShownPick =
    inputStatus === "unaligned" &&
    ((inputType === "input_genome_group" && genomeGroupCheck.isValidating) ||
      (inputType === "input_fasta" && fastaFileCheck.isValidating));

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
          <ServiceCardHeader>
            <RequiredFormCardTitle>
              Start with:
              <DialogInfoPopup
                title={msaSNPAnalysisStartWith.title}
                description={msaSNPAnalysisStartWith.description}
                sections={msaSNPAnalysisStartWith.sections}
              />
            </RequiredFormCardTitle>
          </ServiceCardHeader>

          <ServiceCardContent>
            <form.Field name="input_status">
              {(field) => (
                <FieldItem>
                  <ServiceRadioGroup
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
                        form.setFieldValue("ref_string", "", untouched);
                        // Unaligned and aligned files share `fasta_files`;
                        // one the other selector does not show must not be
                        // submitted from it.
                        form.setFieldValue("fasta_files", [], untouched);
                        fastaFileCheck.cancel();
                        setSelectedFeatureId("");
                        setSelectedGenomeId("");
                        setReferenceFastaText("");
                      }
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="unaligned" id="unaligned" />
                      <Label htmlFor="unaligned">Unaligned Sequences</Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="aligned" id="aligned" />
                      <Label htmlFor="aligned">Aligned Sequences</Label>
                    </div>
                  </ServiceRadioGroup>
                  <FieldErrors field={field} />
                </FieldItem>
              )}
            </form.Field>
          </ServiceCardContent>
        </Card>

        {/* Select sequences */}
        <MsaSequenceSelectionCard>
            {inputStatus === "unaligned" ? (
              <div className="space-y-4">
                <form.Field name="input_type">
                  {(field) => (
                    <FieldItem>
                      <ServiceRadioGroup
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
                            form.setFieldValue("ref_string", "", untouched);
                            setSelectedFeatureId("");
                            setSelectedGenomeId("");
                            setReferenceFastaText("");
                          }
                        }}
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
                      </ServiceRadioGroup>
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
                              const path = object?.path ?? "";
                              if (field.state.value !== path) {
                                clearGroupReference("feature_id");
                              }
                              field.handleChange(path);
                            }}
                            value={field.state.value}
                            invalid={fieldErrorMessage(field) !== null}
                          />
                          <FieldErrors field={field} />
                        </FieldItem>
                      )}
                    </form.Field>

                    <form.Field name="alphabet">
                      {(field) => (
                        <FieldItem>
                          <ServiceRadioGroup
                            value={field.state.value}
                            onValueChange={(value) => {
                              if (value != null)
                                field.handleChange(
                                  value as MsaSnpAnalysis.MsaSnpAnalysisFormData["alphabet"],
                                );
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <RadioGroupItem value="dna" id="dna" />
                              <Label htmlFor="dna">DNA</Label>
                            </div>
                            <div className="flex items-center gap-3">
                              <RadioGroupItem value="protein" id="protein" />
                              <Label htmlFor="protein">Protein</Label>
                            </div>
                          </ServiceRadioGroup>
                          <FieldErrors field={field} />
                        </FieldItem>
                      )}
                    </form.Field>
                  </div>
                )}

                {/* Genome Group Input */}
                {inputType === "input_genome_group" && (
                  <form.Field name="select_genomegroup">
                    {(field) => {
                      const { rejection } = genomeGroupCheck;
                      return (
                        <FieldItem>
                          <WorkspaceObjectSelector
                            preset="genomeGroup"
                            placeholder="Select viral genome group"
                            onSelectedObjectChange={selectGenomeGroup}
                            value={
                              genomeGroupCheck.state?.path ??
                              selectGenomegroup[0]
                            }
                            invalid={
                              rejection !== null ||
                              fieldErrorMessage(field) !== null
                            }
                          />
                          {isValidatingGenomeGroup && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Spinner className="size-4" />
                              <span>Validating genome group...</span>
                            </div>
                          )}
                          {rejection ? (
                            <FieldErrorDetails
                              summary={rejection.title}
                              details={rejection.message}
                            />
                          ) : (
                            <FieldErrors field={field} />
                          )}
                        </FieldItem>
                      );
                    }}
                  </form.Field>
                )}

                {/* FASTA File Input */}
                {inputType === "input_fasta" && (
                  <form.Field name="fasta_files">
                    {(field) => (
                      <FieldItem>
                        <WorkspaceObjectSelector
                          preset="featureFasta"
                          placeholder="Select FASTA file"
                          onSelectedObjectChange={selectFastaFile}
                          value={
                            fastaFileCheck.state?.path ??
                            field.state.value?.[0]?.file
                          }
                          invalid={
                            fastaFileCheck.rejection !== null ||
                            fieldErrorMessage(field) !== null
                          }
                        />
                        {fastaFileCheck.isValidating && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Spinner className="size-4" />
                            <span>Checking FASTA file...</span>
                          </div>
                        )}
                        {fastaFileCheck.rejection ? (
                          <FieldErrorDetails
                            summary={fastaFileCheck.rejection.title}
                            details={fastaFileCheck.rejection.message}
                          />
                        ) : (
                          <FieldErrors field={field} />
                        )}
                      </FieldItem>
                    )}
                  </form.Field>
                )}

                {/* Input Sequence */}
                {inputType === "input_sequence" && (
                  <form.Field name="fasta_keyboard_input">
                    {(field) => (
                      <FastaTextareaStatus
                        value={fastaInputText}
                        onChange={handleFastaInputChange}
                        placeholder="Enter FASTA records of sequences to align"
                        error={
                          fastaValidationResult?.valid === false
                            ? fastaValidationResult.message
                            : fieldErrorMessage(field)
                        }
                        validMessage={
                          fastaValidationResult?.valid
                            ? `✓ Valid FASTA with ${String(fastaValidationResult.numseq)} sequence${fastaValidationResult.numseq !== 1 ? "s" : ""}`
                            : null
                        }
                      />
                    )}
                  </form.Field>
                )}
              </div>
            ) : (
              <form.Field name="fasta_files">
                {(field) => (
                  <FieldItem>
                    <ServiceLabel>Select an aligned FASTA file</ServiceLabel>
                    <WorkspaceObjectSelector
                      preset="alignedFasta"
                      placeholder="Select aligned FASTA file"
                      onSelectedObjectChange={(
                        object: WorkspaceObject | null,
                      ) => {
                        // Only one file allowed: a pick replaces it, and
                        // typing over it drops it.
                        field.handleChange(
                          object?.path
                            ? [
                                MsaSnpAnalysisUtils.fastaFileFromObject(
                                  object,
                                  "aligned",
                                ),
                              ]
                            : [],
                        );
                      }}
                      value={field.state.value?.[0]?.file}
                      invalid={fieldErrorMessage(field) !== null}
                    />
                    <FieldErrors field={field} />
                  </FieldItem>
                )}
              </form.Field>
            )}
        </MsaSequenceSelectionCard>

        {/* Reference Sequence */}
        <MsaReferenceSequenceCard>
            <div className="space-y-4">
              <form.Field name="ref_type">
                {(field) => (
                  <FieldItem>
                    <ServiceRadioGroup
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
                          true,
                        );
                        // Clear ref_string when changing ref_type
                        if (value === "none" || value === "first") {
                          form.setFieldValue("ref_string", "", untouched);
                          setSelectedFeatureId("");
                          setSelectedGenomeId("");
                          setReferenceFastaText("");
                        }
                      }}
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
                    </ServiceRadioGroup>
                    <FieldErrors field={field} />
                  </FieldItem>
                )}
              </form.Field>

              {/* Feature ID Reference */}
              {refType === "feature_id" && (
                <form.Field name="ref_string">
                  {(field) => {
                    const loadError = featureOptionsError;
                    return (
                      <FieldItem>
                        <ServiceLabel>Feature ID</ServiceLabel>
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
                          disabled={isLoadingFeatures || !featureGroup}
                        >
                          <ServiceSelectTrigger
                            aria-label="Select feature ID"
                            aria-invalid={
                              Boolean(loadError ?? fieldErrorMessage(field)) ||
                              undefined
                            }
                          >
                            <SelectValue
                              placeholder={
                                !featureGroup
                                  ? "Select a feature group first"
                                  : isLoadingFeatures
                                    ? "Loading features..."
                                    : featureOptions.length === 0
                                      ? "No features available"
                                      : "Select feature ID"
                              }
                            />
                          </ServiceSelectTrigger>
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
                        {loadError ? (
                          <FieldErrorDetails
                            summary={featureOptionsErrorTitle}
                            details={loadError}
                          />
                        ) : (
                          <FieldErrors field={field} />
                        )}
                      </FieldItem>
                    );
                  }}
                </form.Field>
              )}

              {/* Genome ID Reference */}
              {refType === "genome_id" && (
                <form.Field name="ref_string">
                  {(field) => {
                    const loadError = genomeOptionsError;
                    // Only a group that passed validation is in the form.
                    const hasGenomeGroup = selectGenomegroup.length > 0;
                    return (
                      <FieldItem>
                        <ServiceLabel>Genome ID</ServiceLabel>
                        <Select
                          value={selectedGenomeId}
                          onValueChange={(value) => {
                            if (value == null) return;
                            setSelectedGenomeId(value);
                            form.setFieldValue("ref_string", value);
                          }}
                          disabled={isLoadingGenomes || !hasGenomeGroup}
                        >
                          <ServiceSelectTrigger
                            aria-label="Select genome ID"
                            aria-invalid={
                              Boolean(loadError ?? fieldErrorMessage(field)) ||
                              undefined
                            }
                          >
                            <SelectValue
                              placeholder={
                                !hasGenomeGroup
                                  ? isValidatingGenomeGroup
                                    ? "Validating genome group..."
                                    : "Select a valid viral genome group first"
                                  : isLoadingGenomes
                                    ? "Loading genomes..."
                                    : genomeOptions.length === 0
                                      ? "No genomes available"
                                      : "Select genome ID"
                              }
                            />
                          </ServiceSelectTrigger>
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
                        {loadError ? (
                          <FieldErrorDetails
                            summary={genomeOptionsErrorTitle}
                            details={loadError}
                          />
                        ) : (
                          <FieldErrors field={field} />
                        )}
                      </FieldItem>
                    );
                  }}
                </form.Field>
              )}

              {/* Input Reference Sequence */}
              {refType === "string" && (
                <form.Field name="ref_string">
                  {(field) => (
                    <FastaTextareaStatus
                      value={referenceFastaText}
                      onChange={handleReferenceFastaChange}
                      placeholder="Enter a FASTA record of a reference sequence to align"
                      error={
                        referenceFastaValidationResult?.valid === false
                          ? referenceFastaValidationResult.message
                          : fieldErrorMessage(field)
                      }
                      validMessage={
                        referenceFastaValidationResult?.valid
                          ? `✓ Valid FASTA with ${String(referenceFastaValidationResult.numseq)} sequence`
                          : null
                      }
                    />
                  )}
                </form.Field>
              )}
            </div>
        </MsaReferenceSequenceCard>

        {/* Parameters */}
        <MsaParametersCard>
            <div className="space-y-4">
              {/* Legacy hides the aligner for an aligned file, which App-MSA
                  does not realign. */}
              {inputStatus === "unaligned" && (
              <form.Field name="aligner">
                {(field) => (
                  <FieldItem>
                    <ServiceLabel>Aligner</ServiceLabel>
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
                      <ServiceSelectTrigger aria-label="Select aligner">
                        <SelectValue placeholder="Select aligner" />
                      </ServiceSelectTrigger>
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
              )}

              {/* Strategy Options (only for Mafft and unaligned) */}
              {aligner === "Mafft" && inputStatus === "unaligned" && (
                <ServiceCollapsible
                  open={showStrategy}
                  onOpenChange={setShowStrategy}
                >
                  <ServiceCollapsibleTrigger>
                    Strategy Options
                    <ChevronDown
                      className={`size-4 transition-transform ${showStrategy ? "rotate-180 transform" : ""}`}
                    />
                  </ServiceCollapsibleTrigger>

                  <ServiceCollapsibleContent>
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
                            className="w-auto"
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
                                  variant="option"
                                  leading="normal"
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
                  </ServiceCollapsibleContent>
                </ServiceCollapsible>
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
                          invalid: fieldErrorMessage(outputPathField) !== null,
                        }}
                        outputName={{
                          value: outputNameField.state.value,
                          onChange: outputNameField.handleChange,
                          errors: <FieldErrors field={outputNameField} />,
                          invalid: fieldErrorMessage(outputNameField) !== null,
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
        <ServiceSubmitError form={form} />
        <div className="service-form-controls">
          <Button type="button" variant="outline" onClick={handleReset}>
            Reset
          </Button>
          <Button
            type="submit"
            disabled={
              isSubmitting ||
              !canSubmit ||
              !isOutputNameValid ||
              isCheckingShownPick
            }
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
