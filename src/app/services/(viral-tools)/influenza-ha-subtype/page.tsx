"use client";

import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
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
  const form = useForm<InfluenzaHaSubtypeFormData>({
    resolver: zodResolver(influenzaHaSubtypeFormSchema),
    defaultValues: defaultInfluenzaHaSubtypeFormValues,
    mode: "onChange",
  });

  const [isOutputNameValid, setIsOutputNameValid] = useState(true);
  const [fastaValidationMessage, setFastaValidationMessage] = useState("");
  const [isFastaValid, setIsFastaValid] = useState(false);

  const inputSource = form.watch("input_source");
  const fastaData = form.watch("input_fasta_data");

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
      form.setValue("input_fasta_data", result.trimFasta, {
        shouldValidate: true,
      });
    }
  }, [fastaData, form]);

  const handleReset = useCallback(() => {
    form.reset(defaultInfluenzaHaSubtypeFormValues, {
      keepDefaultValues: false,
    });
    setIsOutputNameValid(true);
    setFastaValidationMessage("");
    setIsFastaValid(false);
  }, [form]);

  const {
    handleSubmit,
    showParamsDialog,
    setShowParamsDialog,
    currentParams,
    serviceName,
    isSubmitting,
  } = useServiceFormSubmission<InfluenzaHaSubtypeFormData>({
    serviceName: "HASubtypeNumberingConversion",
    displayName: "HA Subtype Numbering Conversion",
    transformParams: transformHaSubtypeParams,
    onSuccess: handleReset,
  });

  const isFastaDataInvalid =
    inputSource === "fasta_data" && !!fastaData?.trim() && !isFastaValid;
  const isSubmitDisabled = Boolean(
    !form.formState.isValid ||
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

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
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
                <FormField
                  control={form.control}
                  name="input_source"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <RadioGroup
                          value={field.value}
                          onValueChange={field.onChange}
                          className="service-radio-group"
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
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {inputSource === "fasta_data" && (
                  <FormField
                    control={form.control}
                    name="input_fasta_data"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea
                            placeholder="Enter one or more protein sequences in FASTA format."
                            className="service-card-textarea min-h-[175px] font-mono text-sm"
                            value={field.value}
                            onChange={field.onChange}
                            onBlur={() => {
                              field.onBlur();
                              validateFastaData();
                            }}
                          />
                        </FormControl>
                        {fastaValidationMessage ? (
                          <p className="text-destructive text-sm">
                            {fastaValidationMessage}
                          </p>
                        ) : null}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {inputSource === "fasta_file" && (
                  <FormField
                    control={form.control}
                    name="input_fasta_file"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <WorkspaceObjectSelector
                            types={["feature_protein_fasta", "contigs"]}
                            placeholder="Select or upload FASTA file..."
                            value={field.value}
                            onSelectedObjectChange={(obj) =>
                              field.onChange(obj?.path ?? "")
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {inputSource === "feature_group" && (
                  <FormField
                    control={form.control}
                    name="input_feature_group"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <WorkspaceObjectSelector
                            types={["feature_group"]}
                            placeholder="Select a feature group..."
                            value={field.value}
                            onSelectedObjectChange={(obj) =>
                              field.onChange(obj?.path ?? "")
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                <FormField
                  control={form.control}
                  name="types"
                  render={() => (
                    <FormItem>
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
                              checked={form.watch("types").includes(scheme.id)}
                              onCheckedChange={(checked) => {
                                const current = form.getValues("types");
                                const next = checked
                                  ? [...current, scheme.id]
                                  : current.filter((id) => id !== scheme.id);
                                form.setValue("types", next, {
                                  shouldValidate: true,
                                });
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
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="output_path"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormControl>
                        <OutputFolder
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
      </Form>

      <JobParamsDialog
        open={showParamsDialog}
        onOpenChange={setShowParamsDialog}
        params={currentParams}
        serviceName={serviceName}
      />
    </section>
  );
}
