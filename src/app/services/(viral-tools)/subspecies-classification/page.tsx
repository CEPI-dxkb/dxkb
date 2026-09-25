"use client";

import { Fragment } from "react";
import { useSubspeciesClassificationPage } from "./use-subspecies-classification-page";
import { FieldItem, FieldErrors } from "@/components/ui/tanstack-form";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectSeparator,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroupItem } from "@/components/ui/radio-group";

import { ServiceHeader } from "@/components/services/service-header";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import OutputFolder from "@/components/services/output-folder";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import { JobParamsDialog } from "@/components/services/job-params-dialog";
import { Spinner } from "@/components/ui/spinner";
import {
  ServiceCardContent,
  ServiceCardHeader,
  ServiceCardTitle,
} from "@/components/services/form-ui/service-card";
import { ServiceLabel } from "@/components/services/form-ui/service-label";
import { ServiceRadioGroup } from "@/components/services/form-ui/service-radio-group";
import { ServiceSelectTrigger } from "@/components/services/form-ui/service-select";

import {
  subspeciesClassificationInfo,
  subspeciesClassificationQuerySource,
  subspeciesClassificationSpeciesInfo,
} from "@/lib/services/info/subspecies-classification";

import {
  subspeciesVirusTypeOptions,
  type SubspeciesClassificationFormData,
} from "@/lib/forms/(viral-tools)/subspecies-classification/subspecies-classification-form-schema";

import type { WorkspaceObject } from "@/lib/services/workspace/types";

const quickReference =
  "https://www.bv-brc.org/docs/quick_references/services/subspecies_classification_service.html";
const tutorial =
  "https://www.bv-brc.org/docs/tutorial/subspecies_classification/subspecies_classification.html";

/** Indices in SUBSPECIES_VIRUS_TYPE_OPTIONS before which to render a SelectSeparator (legacy family grouping). */
const subspeciesSpeciesSeparatorBeforeIndex = new Set([5, 7, 17, 21, 23, 24]);

export default function SubspeciesClassificationPage() {
  const {
    form,
    outputPath,
    inputSource,
    handleFastaBlur,
    handleReset,
    setIsOutputNameValid,
    isSubmitting,
    jobParamsDialogProps,
    canSubmit,
  } = useSubspeciesClassificationPage();

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
          void form.handleSubmit();
        }}
        className="grid grid-cols-1 gap-6 md:grid-cols-12"
      >
        {/* Query Source */}
        <div className="md:col-span-12">
          <Card>
            <ServiceCardHeader>
              <RequiredFormCardTitle>
                Query Source
                <DialogInfoPopup
                  title={subspeciesClassificationQuerySource.title}
                  description={subspeciesClassificationQuerySource.description}
                  sections={subspeciesClassificationQuerySource.sections}
                />
              </RequiredFormCardTitle>
            </ServiceCardHeader>
            <ServiceCardContent>
              <form.Field name="input_source">
                {(field) => (
                  <FieldItem>
                    <ServiceRadioGroup
                      value={field.state.value}
                      onValueChange={(v) => {
                        if (v == null) return;
                        field.handleChange(
                          v as SubspeciesClassificationFormData["input_source"],
                        );
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
                    </ServiceRadioGroup>
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
                        className="min-h-44 font-mono text-xs"
                        value={field.state.value ?? ""}
                        onChange={(e) => {
                          field.handleChange(e.target.value);
                        }}
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
                        preset="fasta"
                        placeholder="Select or upload FASTA file to your workspace."
                        value={field.state.value ?? ""}
                        onObjectSelect={(object: WorkspaceObject) => {
                          field.handleChange(object.path);
                        }}
                      />
                      <FieldErrors field={field} />
                    </FieldItem>
                  )}
                </form.Field>
              )}
            </ServiceCardContent>
          </Card>
        </div>

        {/* Species and Output */}
        <div className="md:col-span-12">
          <Card>
            <ServiceCardHeader>
              <ServiceCardTitle>
                Species
                <DialogInfoPopup
                  title={subspeciesClassificationSpeciesInfo.title}
                  description={subspeciesClassificationSpeciesInfo.description}
                />
              </ServiceCardTitle>
            </ServiceCardHeader>

            <ServiceCardContent className="space-y-6">
              <form.Field name="virus_type">
                {(field) => (
                  <FieldItem>
                    <ServiceLabel>Species</ServiceLabel>
                    <Select
                      items={subspeciesVirusTypeOptions}
                      value={field.state.value}
                      onValueChange={(value) => {
                        if (value != null) field.handleChange(value);
                      }}
                    >
                      <ServiceSelectTrigger aria-label="Species">
                        <SelectValue placeholder="Select species" />
                      </ServiceSelectTrigger>
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
                          onChange={(value) => {
                            field.handleChange(value);
                          }}
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
                          onChange={(value) => {
                            field.handleChange(value);
                          }}
                          outputFolderPath={outputPath}
                          onValidationChange={setIsOutputNameValid}
                        />
                        <FieldErrors field={field} />
                      </FieldItem>
                    )}
                  </form.Field>
                </div>
              </div>
            </ServiceCardContent>
          </Card>
        </div>

        {/* Form controls */}
        <div className="md:col-span-12">
          <div className="service-form-controls">
            <Button type="button" variant="outline" onClick={handleReset}>
              Reset
            </Button>

            <Button type="submit" disabled={isSubmitting || !canSubmit}>
              {isSubmitting ? <Spinner className="mr-2 size-4" /> : null}
              Submit
            </Button>
          </div>
        </div>
      </form>

      <JobParamsDialog {...jobParamsDialogProps} />
    </section>
  );
}
