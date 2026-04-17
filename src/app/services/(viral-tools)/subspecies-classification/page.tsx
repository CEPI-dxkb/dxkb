"use client";

import { useState, useCallback, Fragment } from "react";
import { useForm, useStore } from "@tanstack/react-form";
import { FieldItem, FieldErrors } from "@/components/ui/tanstack-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectSeparator,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import { ServiceHeader } from "@/components/services/service-header";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import OutputFolder from "@/components/services/output-folder";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import { JobParamsDialog } from "@/components/services/job-params-dialog";
import { Spinner } from "@/components/ui/spinner";

import { useServiceRuntime } from "@/hooks/services/use-service-runtime";
import {
  subspeciesClassificationInfo,
  subspeciesClassificationQuerySource,
  subspeciesClassificationSpeciesInfo,
} from "@/lib/services/info/subspecies-classification";

import {
  subspeciesClassificationFormSchema,
  defaultSubspeciesClassificationFormValues,
  subspeciesVirusTypeOptions,
  type SubspeciesClassificationFormData,
} from "@/lib/forms/(viral-tools)/subspecies-classification/subspecies-classification-form-schema";
import {
  validateSubspeciesFasta,
  getSubspeciesFastaMessage,
} from "@/lib/forms/(viral-tools)/subspecies-classification/subspecies-classification-form-utils";
import { subspeciesClassificationService } from "@/lib/forms/(viral-tools)/subspecies-classification/subspecies-classification-service";

import type { WorkspaceObject } from "@/lib/services/workspace/types";
import type { ValidWorkspaceObjectTypes } from "@/lib/services/workspace/types";

const quickReference =
  "https://www.bv-brc.org/docs/quick_references/services/subspecies_classification_service.html";
const tutorial =
  "https://www.bv-brc.org/docs/tutorial/subspecies_classification/subspecies_classification.html";

const fastaWorkspaceTypes: ValidWorkspaceObjectTypes[] = [
  "feature_protein_fasta",
  "feature_dna_fasta",
  "aligned_protein_fasta",
  "aligned_dna_fasta",
  "contigs",
];

/** Indices in SUBSPECIES_VIRUS_TYPE_OPTIONS before which to render a SelectSeparator (legacy family grouping). */
const subspeciesSpeciesSeparatorBeforeIndex = new Set([5, 7, 17, 21, 23, 24]);

export default function SubspeciesClassificationPage() {
  const form = useForm({
    defaultValues:
      defaultSubspeciesClassificationFormValues as SubspeciesClassificationFormData,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validators: { onChange: subspeciesClassificationFormSchema as any },
    onSubmit: async ({ value }) => {
      await runtime.submitFormData(value as SubspeciesClassificationFormData);
    },
  });

  const outputPath = useStore(form.store, (s) => s.values.output_path);
  const canSubmit = useStore(form.store, (s) => s.canSubmit);

  const [isOutputNameValid, setIsOutputNameValid] = useState(true);

  const inputSource = useStore(form.store, (s) => s.values.input_source);

  const handleFastaBlur = useCallback(() => {
    const value = form.state.values.input_fasta_data ?? "";
    if (!value.trim()) return;
    const result = validateSubspeciesFasta(value);
    if (!result.valid) {
      form.setFieldMeta("input_fasta_data", (prev) => ({
        ...prev,
        errors: [getSubspeciesFastaMessage(result)],
        errorMap: { ...prev.errorMap, onChange: getSubspeciesFastaMessage(result) },
      }));
    } else {
      form.setFieldMeta("input_fasta_data", (prev) => ({
        ...prev,
        errors: [],
        errorMap: { ...prev.errorMap, onChange: undefined },
      }));
      if (result.trimFasta !== value) {
        form.setFieldValue("input_fasta_data", result.trimFasta);
      }
    }
  }, [form]);

  const handleReset = () => {
    form.reset(defaultSubspeciesClassificationFormValues);
    setIsOutputNameValid(true);
  };

  const runtime = useServiceRuntime({
    definition: subspeciesClassificationService,
    form,
    onSuccess: handleReset,
  });
  const { isSubmitting, jobParamsDialogProps } = runtime;

  return (
    <section>
      <ServiceHeader
        title="Subspecies Classification"
        description={
          <>
            The Subspecies Classification tool assigns the genotype/subtype of a
            virus, based on the genotype/subtype assignments maintained by the
            International Committee on Taxonomy of Viruses (ICTV). This tool
            infers the genotype/subtype for a query sequence from its position
            within a reference tree. The service uses the{" "}
            <a
              href="https://matsen.fhcrc.org/pplacer/"
              target="_blank"
              rel="noopener noreferrer"
            >
              pplacer
            </a>{" "}
            tool with a reference tree and reference alignment and includes the
            query sequence as input. Interpretation of the pplacer result is
            handled by{" "}
            <a
              href="https://github.com/cmzmasek/forester/blob/master/forester/java/src/org/forester/application/cladinator.java"
              target="_blank"
              rel="noopener noreferrer"
            >
              Cladinator
            </a>
            .
          </>
        }
        infoPopupTitle={subspeciesClassificationInfo.title}
        infoPopupDescription={subspeciesClassificationInfo.description}
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
        {/* Query Source */}
        <div className="md:col-span-12">
          <Card>
            <CardHeader className="service-card-header">
              <RequiredFormCardTitle className="service-card-title">
                Query Source
                <DialogInfoPopup
                  title={subspeciesClassificationQuerySource.title}
                  description={
                    subspeciesClassificationQuerySource.description
                  }
                  sections={subspeciesClassificationQuerySource.sections}
                />
              </RequiredFormCardTitle>
            </CardHeader>
            <CardContent className="service-card-content">
              <form.Field name="input_source">
                {(field) => (
                  <FieldItem>
                    <RadioGroup
                      value={field.state.value}
                      onValueChange={(v) => {
                        if (v == null) return;
                        field.handleChange(v);
                        if (v === "fasta_file") {
                          form.setFieldMeta("input_fasta_data", (prev) => ({
                            ...prev,
                            errors: [],
                            errorMap: {
                              ...prev.errorMap,
                              onChange: undefined,
                            },
                          }));
                        }
                      }}
                      className="service-radio-group-horizontal"
                    >
                      <div className="service-radio-group-item flex items-center gap-2">
                        <RadioGroupItem
                          value="fasta_data"
                          id="subspecies-fasta-data"
                        />
                        <Label htmlFor="subspecies-fasta-data">
                          Enter sequence
                        </Label>
                      </div>
                      <div className="service-radio-group-item flex items-center gap-2">
                        <RadioGroupItem
                          value="fasta_file"
                          id="subspecies-fasta-file"
                        />
                        <Label htmlFor="subspecies-fasta-file">
                          Select FASTA file
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
                    <FieldItem className="mt-4">
                      <Textarea
                        placeholder="Enter one or more query nucleotide or protein sequences to search. Requires FASTA format."
                        className="min-h-[175px] font-mono text-xs"
                        value={field.state.value ?? ""}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={() => {
                          field.handleBlur();
                          handleFastaBlur();
                        }}
                      />
                      <FieldErrors field={field} />
                    </FieldItem>
                  )}
                </form.Field>
              )}

              {inputSource === "fasta_file" && (
                <form.Field name="input_fasta_file">
                  {(field) => (
                    <FieldItem className="mt-4">
                      <WorkspaceObjectSelector
                        types={fastaWorkspaceTypes}
                        placeholder="Select or upload FASTA file to your workspace."
                        value={field.state.value ?? ""}
                        onObjectSelect={(object: WorkspaceObject) =>
                          field.handleChange(object.path)
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

        {/* Species and Output */}
        <div className="md:col-span-12">
          <Card>
            <CardHeader className="service-card-header">
              <CardTitle className="service-card-title">
                Species
                <DialogInfoPopup
                  title={subspeciesClassificationSpeciesInfo.title}
                  description={
                    subspeciesClassificationSpeciesInfo.description
                  }
                />
              </CardTitle>
            </CardHeader>

            <CardContent className="service-card-content space-y-6">
              <form.Field name="virus_type">
                {(field) => (
                  <FieldItem>
                    <Label className="service-card-label">Species</Label>
                    <Select
                      items={subspeciesVirusTypeOptions}
                      value={field.state.value}
                      onValueChange={(value) =>
                        value != null && field.handleChange(value)
                      }
                    >
                      <SelectTrigger className="service-card-select-trigger">
                        <SelectValue placeholder="Select species" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[min(20rem,70vh)] overflow-y-auto">
                        <SelectGroup>
                          {subspeciesVirusTypeOptions.map((opt, index) => (
                            <Fragment key={opt.value}>
                              {subspeciesSpeciesSeparatorBeforeIndex.has(
                                index,
                              ) && <SelectSeparator />}
                              <SelectItem value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            </Fragment>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FieldErrors field={field} />
                  </FieldItem>
                )}
              </form.Field>

              <div className="service-card-row">
                <div className="service-card-row-item">
                  <form.Field name="output_path">
                    {(field) => (
                      <FieldItem>
                        <OutputFolder
                          value={field.state.value}
                          onChange={(value) => field.handleChange(value)}
                        />
                        <FieldErrors field={field} />
                      </FieldItem>
                    )}
                  </form.Field>
                </div>

                <div className="service-card-row-item">
                  <form.Field name="output_file">
                    {(field) => (
                      <FieldItem>
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
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Form controls */}
        <div className="md:col-span-12">
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
              {isSubmitting ? <Spinner className="mr-2 h-4 w-4" /> : null}
              Submit
            </Button>
          </div>
        </div>
      </form>

      <JobParamsDialog {...jobParamsDialogProps} />
    </section>
  );
}
