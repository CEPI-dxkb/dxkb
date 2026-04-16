"use client";

import { useState, useCallback } from "react";
import { useForm, useStore } from "@tanstack/react-form";
import { FieldItem, FieldErrors } from "@/components/ui/tanstack-form";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import { ServiceHeader } from "@/components/services/service-header";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import OutputFolder from "@/components/services/output-folder";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import { JobParamsDialog } from "@/components/services/job-params-dialog";
import { Spinner } from "@/components/ui/spinner";

import { useServiceFormSubmission } from "@/hooks/services/use-service-form-submission";
import { useDebugParamsPreview } from "@/hooks/services/use-debug-params-preview";
import { useRerunForm } from "@/hooks/services/use-rerun-form";
import { normalizeToArray } from "@/lib/rerun-utility";
import { validateFasta } from "@/lib/fasta-validation";
import {
  haSubtypeNumberingInput,
  haSubtypeNumberingConversionScheme,
} from "@/lib/services/service-info";
import { HaReferenceTypes } from "@/types/services";

import {
  influenzaHaSubtypeFormSchema,
  defaultInfluenzaHaSubtypeFormValues,
  type InfluenzaHaSubtypeFormData,
} from "@/lib/forms/(viral-tools)/influenza-ha-subtype/influenza-ha-subtype-form-schema";
import { transformHaSubtypeParams } from "@/lib/forms/(viral-tools)/influenza-ha-subtype/influenza-ha-subtype-form-utils";

const quickReference =
  "https://www.bv-brc.org/docs/quick_references/services/ha_numbering_service.html";
const tutorial =
  "https://www.bv-brc.org/docs/tutorial/ha_numbering/ha_numbering.html";

export default function HASubtypeNumberingPage() {
  const form = useForm({
    defaultValues:
      defaultInfluenzaHaSubtypeFormValues as InfluenzaHaSubtypeFormData,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validators: { onChange: influenzaHaSubtypeFormSchema as any },
    onSubmit: async ({ value }) => {
      const data = value as InfluenzaHaSubtypeFormData;
      await previewOrPassthrough(transformHaSubtypeParams(data), submit);
    },
  });

  useRerunForm<Record<string, unknown>>({
    form,
    fields: [
      "input_source",
      "input_fasta_data",
      "input_fasta_file",
      "input_feature_group",
      "output_path",
      "output_file",
    ] as const,
    onApply: (rerunData, form) => {
      if (rerunData.types != null) {
        form.setFieldValue("types", normalizeToArray(rerunData.types) as never);
      }
    },
  });

  const outputPath = useStore(form.store, (s) => s.values.output_path);
  const watchedTypes = useStore(form.store, (s) => s.values.types);
  const canSubmit = useStore(form.store, (s) => s.canSubmit);

  const [isOutputNameValid, setIsOutputNameValid] = useState(true);
  const [fastaValidationMessage, setFastaValidationMessage] = useState("");
  const [isFastaValid, setIsFastaValid] = useState(false);

  const inputSource = useStore(form.store, (s) => s.values.input_source);
  const fastaData = useStore(form.store, (s) => s.values.input_fasta_data);

  const validateFastaData = useCallback(() => {
    const trimmed = fastaData?.trim() ?? "";
    if (!trimmed) {
      setFastaValidationMessage("");
      setIsFastaValid(false);
      return;
    }
    const result = validateFasta(trimmed, "aa");
    if (result.valid && result.status === "valid_dna") {
      setIsFastaValid(false);
      setFastaValidationMessage(
        "This service requires protein (amino acid) sequences."
      );
      return;
    }
    setIsFastaValid(result.valid);
    setFastaValidationMessage(result.message || "");
    if (result.valid && result.trimFasta && result.trimFasta !== trimmed) {
      form.setFieldValue("input_fasta_data", result.trimFasta);
    }
  }, [fastaData, form]);

  const handleReset = () => {
    form.reset(defaultInfluenzaHaSubtypeFormValues);
    setIsOutputNameValid(true);
    setFastaValidationMessage("");
    setIsFastaValid(false);
  };

  const { submit, isSubmitting } = useServiceFormSubmission({
    serviceName: "HASubtypeNumberingConversion",
    displayName: "HA Subtype Numbering Conversion",
    onSuccess: handleReset,
  });
  const { previewOrPassthrough, dialogProps } = useDebugParamsPreview({
    serviceName: "HASubtypeNumberingConversion",
  });

  const isFastaDataInvalid =
    inputSource === "fasta_data" && !!fastaData?.trim() && !isFastaValid;
  const isSubmitDisabled = Boolean(
    !canSubmit ||
      !isOutputNameValid ||
      isSubmitting ||
      isFastaDataInvalid,
  );

  return (
    <section>
      <ServiceHeader
        title="HA Subtype Numbering Conversion"
        description={
          <>
            The HA Subtype Numbering Conversion service allows you to renumber
            Influenza HA sequences according to a cross-subtype numbering scheme
            proposed by Burke and Smith in{" "}
            <a
              href="https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4100033/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              Burke DF, Smith DJ (2014). A recommended numbering scheme for
              influenza A HA subtypes. PLoS One 9:e112302
            </a>
            . Burke and Smith&apos;s numbering scheme uses analysis of known HA
            structures to identify amino acids that are structurally and
            functionally equivalent across all HA subtypes, using a numbering
            system based on the mature HA sequence.
          </>
        }
        quickReferenceGuide={quickReference}
        tutorial={tutorial}
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="grid grid-cols-1 gap-6 md:grid-cols-12"
      >
        {/* Input Sequence Card */}
        <div className="md:col-span-12">
          <Card>
            <CardHeader className="service-card-header">
              <RequiredFormCardTitle className="service-card-title">
                Input Sequence
                <DialogInfoPopup
                  title={haSubtypeNumberingInput.title}
                  description={haSubtypeNumberingInput.description}
                  sections={haSubtypeNumberingInput.sections}
                />
              </RequiredFormCardTitle>
            </CardHeader>

            <CardContent className="service-card-content space-y-4">
              <form.Field name="input_source">
                {(field) => (
                  <FieldItem>
                    <RadioGroup
                      value={field.state.value}
                      onValueChange={(value) =>
                        value != null && field.handleChange(value)
                      }
                      className="service-radio-group-horizontal"
                    >
                      <div className="service-radio-group-item">
                        <RadioGroupItem
                          value="fasta_data"
                          id="input_fasta_data"
                        />
                        <Label htmlFor="input_fasta_data">
                          Enter sequence
                        </Label>
                      </div>
                      <div className="service-radio-group-item">
                        <RadioGroupItem
                          value="fasta_file"
                          id="input_fasta_file"
                        />
                        <Label htmlFor="input_fasta_file">
                          Select FASTA file
                        </Label>
                      </div>
                      <div className="service-radio-group-item">
                        <RadioGroupItem
                          value="feature_group"
                          id="input_feature_group"
                        />
                        <Label htmlFor="input_feature_group">
                          Feature group
                        </Label>
                      </div>
                    </RadioGroup>
                    <FieldErrors field={field} />
                  </FieldItem>
                )}
              </form.Field>

              {inputSource === "fasta_data" && (
                <form.Field name="input_fasta_data">
                  {(field) => (
                    <FieldItem>
                      <Textarea
                        placeholder="Enter one or more protein sequences in FASTA format."
                        className="service-card-textarea min-h-[175px] font-mono text-sm"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={() => {
                          field.handleBlur();
                          validateFastaData();
                        }}
                      />
                      {fastaValidationMessage ? (
                        <p className="text-destructive text-sm">
                          {fastaValidationMessage}
                        </p>
                      ) : null}
                      <FieldErrors field={field} />
                    </FieldItem>
                  )}
                </form.Field>
              )}

              {inputSource === "fasta_file" && (
                <form.Field name="input_fasta_file">
                  {(field) => (
                    <FieldItem>
                      <WorkspaceObjectSelector
                        types={["feature_protein_fasta", "contigs"]}
                        placeholder="Select or upload FASTA file..."
                        value={field.state.value}
                        onSelectedObjectChange={(obj) =>
                          field.handleChange(obj?.path ?? "")
                        }
                      />
                      <FieldErrors field={field} />
                    </FieldItem>
                  )}
                </form.Field>
              )}

              {inputSource === "feature_group" && (
                <form.Field name="input_feature_group">
                  {(field) => (
                    <FieldItem>
                      <WorkspaceObjectSelector
                        types={["feature_group"]}
                        placeholder="Select a feature group..."
                        value={field.state.value}
                        onSelectedObjectChange={(obj) =>
                          field.handleChange(obj?.path ?? "")
                        }
                      />
                      <FieldErrors field={field} />
                    </FieldItem>
                  )}
                </form.Field>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Parameters Card: Conversion scheme + Output */}
        <div className="md:col-span-12">
          <Card>
            <CardHeader className="service-card-header">
              <RequiredFormCardTitle className="service-card-title">
                Parameters
                <DialogInfoPopup
                  title={haSubtypeNumberingConversionScheme.title}
                  description={
                    haSubtypeNumberingConversionScheme.description
                  }
                />
              </RequiredFormCardTitle>
            </CardHeader>

            <CardContent className="service-card-content space-y-6">
              <form.Field name="types">
                {(field) => (
                  <FieldItem>
                    <Label className="service-card-label">
                      Conversion Sequence Numbering Scheme
                    </Label>
                    <div className="bg-muted/50 grid max-h-[220px] grid-cols-2 gap-2 overflow-y-auto rounded-md border p-4 md:grid-cols-4">
                      {HaReferenceTypes.map((scheme) => (
                        <div
                          className="flex items-center gap-2"
                          key={scheme.id}
                        >
                          <Checkbox
                            id={`scheme-${scheme.id}`}
                            checked={watchedTypes.includes(scheme.id)}
                            onCheckedChange={(checked) => {
                              const current = field.state.value;
                              const next = checked
                                ? [...current, scheme.id]
                                : current.filter((id) => id !== scheme.id);
                              field.handleChange(next);
                            }}
                            className="service-card-checkbox"
                          />
                          <Label
                            htmlFor={`scheme-${scheme.id}`}
                            className="cursor-pointer text-sm"
                          >
                            {scheme.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                    <FieldErrors field={field} />
                  </FieldItem>
                )}
              </form.Field>

              <form.Field name="output_path">
                {(field) => (
                  <FieldItem className="w-full">
                    <OutputFolder
                      value={field.state.value}
                      onChange={(value) => field.handleChange(value)}
                    />
                    <FieldErrors field={field} />
                  </FieldItem>
                )}
              </form.Field>

              <form.Field name="output_file">
                {(field) => (
                  <FieldItem className="w-full">
                    <OutputFolder
                      variant="name"
                      value={field.state.value}
                      onChange={(value) => field.handleChange(value)}
                      outputFolderPath={outputPath}
                      onValidationChange={setIsOutputNameValid}
                    />
                    <FieldErrors field={field} />
                  </FieldItem>
                )}
              </form.Field>
            </CardContent>
          </Card>
        </div>

        {/* Form Controls */}
        <div className="md:col-span-12">
          <div className="service-form-controls">
            <Button type="button" variant="outline" onClick={handleReset}>
              Reset
            </Button>
            <Button type="submit" disabled={isSubmitDisabled}>
              {isSubmitting ? (
                <Spinner className="mr-2 h-4 w-4" />
              ) : null}
              Submit
            </Button>
          </div>
        </div>
      </form>

      <JobParamsDialog {...dialogProps} />
    </section>
  );
}
