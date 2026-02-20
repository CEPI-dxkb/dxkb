"use client";

import { useState, useCallback, Fragment } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
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

import { useServiceFormSubmission } from "@/hooks/services/use-service-form-submission";
import {
  subspeciesClassificationInfo,
  subspeciesClassificationQuerySource,
  subspeciesClassificationSpeciesInfo,
} from "@/lib/services/service-info";

import {
  subspeciesClassificationFormSchema,
  defaultSubspeciesClassificationFormValues,
  subspeciesVirusTypeOptions,
  type SubspeciesClassificationFormData,
} from "@/lib/forms/(viral-tools)/subspecies-classification/subspecies-classification-form-schema";
import {
  transformSubspeciesClassificationParams,
  validateSubspeciesFasta,
  getSubspeciesFastaMessage,
} from "@/lib/forms/(viral-tools)/subspecies-classification/subspecies-classification-form-utils";

import type { WorkspaceObject } from "@/lib/workspace-client";
import type { ValidWorkspaceObjectTypes } from "@/lib/services/workspace/types";

const quickReference =
  "https://www.bv-brc.org/docs/quick_references/services/subspecies_classification_service.html";
const tutorial =
  "https://www.bv-brc.org/docs/tutorial/subspecies_classification/subspecies_classification.html";

const FASTA_WORKSPACE_TYPES: ValidWorkspaceObjectTypes[] = [
  "feature_protein_fasta",
  "feature_dna_fasta",
  "aligned_protein_fasta",
  "aligned_dna_fasta",
  "contigs",
];

/** Indices in SUBSPECIES_VIRUS_TYPE_OPTIONS before which to render a SelectSeparator (legacy family grouping). */
const subspeciesSpeciesSeparatorBeforeIndex = new Set([5, 7, 17, 21, 23, 24]);

export default function SubspeciesClassificationPage() {
  const form = useForm<SubspeciesClassificationFormData>({
    resolver: zodResolver(subspeciesClassificationFormSchema),
    defaultValues: defaultSubspeciesClassificationFormValues,
    mode: "onChange",
  });

  const [isOutputNameValid, setIsOutputNameValid] = useState(true);

  const inputSource = form.watch("input_source");

  const handleFastaBlur = useCallback(() => {
    const value = form.getValues("input_fasta_data") ?? "";
    if (!value.trim()) return;
    const result = validateSubspeciesFasta(value);
    if (!result.valid) {
      form.setError("input_fasta_data", {
        type: "manual",
        message: getSubspeciesFastaMessage(result),
      });
    } else {
      form.clearErrors("input_fasta_data");
      if (result.trimFasta !== value) {
        form.setValue("input_fasta_data", result.trimFasta, {
          shouldValidate: true,
        });
      }
    }
  }, [form]);

  const handleReset = useCallback(() => {
    form.reset(defaultSubspeciesClassificationFormValues, {
      keepDefaultValues: false,
    });
    setIsOutputNameValid(true);
  }, [form]);

  const {
    handleSubmit,
    showParamsDialog,
    setShowParamsDialog,
    currentParams,
    serviceName,
    isSubmitting,
  } = useServiceFormSubmission<SubspeciesClassificationFormData>({
    serviceName: "SubspeciesClassification",
    displayName: "Subspecies Classification",
    transformParams: transformSubspeciesClassificationParams,
    onSuccess: handleReset,
  });

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

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
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
                <FormField
                  control={form.control}
                  name="input_source"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <RadioGroup
                          value={field.value}
                          onValueChange={(v) => {
                            field.onChange(v);
                            if (v === "fasta_file") {
                              form.clearErrors("input_fasta_data");
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
                      <FormItem className="mt-4">
                        <FormControl>
                          <Textarea
                            placeholder="Enter one or more query nucleotide or protein sequences to search. Requires FASTA format."
                            className="min-h-[175px] font-mono text-xs"
                            {...field}
                            value={field.value ?? ""}
                            onBlur={() => {
                              field.onBlur();
                              handleFastaBlur();
                            }}
                          />
                        </FormControl>
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
                      <FormItem className="mt-4">
                        <FormControl>
                          <WorkspaceObjectSelector
                            types={FASTA_WORKSPACE_TYPES}
                            placeholder="Select or upload FASTA file to your workspace."
                            value={field.value ?? ""}
                            onObjectSelect={(object: WorkspaceObject) =>
                              field.onChange(object.path)
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
                <FormField
                  control={form.control}
                  name="virus_type"
                  render={({ field }) => (
                    <FormItem>
                      <Label className="service-card-label">Species</Label>
                      <Select
                        items={subspeciesVirusTypeOptions}
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className="service-card-select-trigger">
                            <SelectValue placeholder="Select species" />
                          </SelectTrigger>
                        </FormControl>
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
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="service-card-row">
                  <div className="service-card-row-item">
                    <FormField
                      control={form.control}
                      name="output_path"
                      render={({ field }) => (
                        <FormItem>
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
                  </div>

                  <div className="service-card-row-item">
                    <FormField
                      control={form.control}
                      name="output_file"
                      render={({ field }) => (
                        <FormItem>
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
                  isSubmitting || !form.formState.isValid || !isOutputNameValid
                }
              >
                {isSubmitting ? <Spinner className="mr-2 h-4 w-4" /> : null}
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
