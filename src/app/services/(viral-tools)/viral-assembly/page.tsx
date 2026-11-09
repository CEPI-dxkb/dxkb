"use client";

import { useViralAssemblyPage } from "./use-viral-assembly-page";
import { FieldItem, FieldErrors } from "@/components/ui/tanstack-form";
import { fieldErrorMessage } from "@/components/ui/field-error-message";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroupItem } from "@/components/ui/radio-group";

import { ServiceHeader } from "@/components/services/service-header";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import SraRunAccessionWithValidation from "@/components/services/sra-run-accession-with-validation";
import { ServiceOutputFields } from "@/components/services/service-output-fields";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import { JobParamsDialog } from "@/components/services/job-params-dialog";
import {
  ServiceCardContent,
  ServiceCardHeader,
} from "@/components/services/form-ui/service-card";
import { ServiceFieldLabel } from "@/components/services/form-ui/service-field";
import { ServiceInput } from "@/components/services/form-ui/service-input";
import { ServiceLabel } from "@/components/services/form-ui/service-label";
import { ServiceRadioGroup } from "@/components/services/form-ui/service-radio-group";
import { ServiceSelectTrigger } from "@/components/services/form-ui/service-select";
import { ServiceFormFooter } from "@/components/services/form-ui/service-form-footer";

import {
  viralAssemblyInfo,
  viralAssemblyInputFile,
  viralAssemblyParameters,
} from "@/lib/services/info/viral-assembly";

import {
  strategyOptions,
  moduleOptions,
  referenceTypeOptions,
  referenceTypeSchema,
  type ViralAssemblyFormData,
} from "@/lib/forms/(viral-tools)/viral-assembly/viral-assembly-form-schema";

import type { WorkspaceObject } from "@/lib/services/workspace/types";

const tutorial =
  "https://www.bv-brc.org/docs/tutorial/viral_assembly/assembly.html";

const ViralAssemblyPage = function ViralAssemblyPage() {
  const {
    form,
    pairedRead1,
    pairedRead2,
    singleRead,
    sraDefaultValue,
    sraResetKey,
    inputType,
    strategy,
    referenceType,
    selectedLibraries,
    setLibraries,
    setPairedRead1,
    setPairedRead2,
    setSingleRead,
    setIsOutputNameValid,
    handleReset,
    isSubmitting,
    jobParamsDialogProps,
    canSubmit,
  } = useViralAssemblyPage();

  return (
    <section>
      <ServiceHeader
        title="Viral Assembly - BETA"
        description="The Viral Assembly Service utilizes IRMA (Iterative Refinement Meta-Assembler) to assemble viral genomes. Users must select the virus genome for processing. This service is currently in beta; any feedback or improvement is welcomed."
        infoPopupTitle={viralAssemblyInfo.title}
        infoPopupDescription={viralAssemblyInfo.description}
        tutorial={tutorial}
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
        className="grid grid-cols-1 gap-6 md:grid-cols-12"
      >
        {/* Input File */}
        <div className="md:col-span-12">
          <Card>
            <ServiceCardHeader>
              <RequiredFormCardTitle>
                Input File
                <DialogInfoPopup
                  title={viralAssemblyInputFile.title}
                  description={viralAssemblyInputFile.description}
                  sections={viralAssemblyInputFile.sections}
                />
              </RequiredFormCardTitle>
            </ServiceCardHeader>
            <ServiceCardContent className="space-y-6">
              <form.Field name="input_type">
                {(field) => (
                  <FieldItem>
                    <ServiceRadioGroup
                      value={field.state.value}
                      onValueChange={(value) => {
                        if (value != null)
                          field.handleChange(
                            value as ViralAssemblyFormData["input_type"],
                          );
                      }}
                    >
                      <div className="service-radio-group-item">
                        <RadioGroupItem value="paired" id="input-paired" />
                        <Label htmlFor="input-paired">
                          Paired Read Library
                        </Label>
                      </div>
                      <div className="service-radio-group-item">
                        <RadioGroupItem value="single" id="input-single" />
                        <Label htmlFor="input-single">
                          Single Read Library
                        </Label>
                      </div>
                      <div className="service-radio-group-item">
                        <RadioGroupItem value="srr_accession" id="input-sra" />
                        <Label htmlFor="input-sra">SRA Run Accession</Label>
                      </div>
                    </ServiceRadioGroup>
                    <FieldErrors field={field} />
                  </FieldItem>
                )}
              </form.Field>

              <div
                className={inputType === "paired" ? "space-y-3" : "hidden"}
                aria-hidden={inputType !== "paired"}
              >
                <WorkspaceObjectSelector
                  preset="reads"
                  placeholder="Select READ FILE 1..."
                  value={pairedRead1 ?? ""}
                  onObjectSelect={(object: WorkspaceObject) => {
                    setPairedRead1(object.path);
                  }}
                />
                <WorkspaceObjectSelector
                  preset="reads"
                  placeholder="Select READ FILE 2..."
                  value={pairedRead2 ?? ""}
                  onObjectSelect={(object: WorkspaceObject) => {
                    setPairedRead2(object.path);
                  }}
                />
              </div>

              <div
                className={inputType === "single" ? "space-y-3" : "hidden"}
                aria-hidden={inputType !== "single"}
              >
                <WorkspaceObjectSelector
                  preset="reads"
                  placeholder="Select READ FILE..."
                  value={singleRead ?? ""}
                  onObjectSelect={(object: WorkspaceObject) => {
                    setSingleRead(object.path);
                  }}
                />
              </div>

              <div
                className={inputType === "srr_accession" ? "block" : "hidden"}
                aria-hidden={inputType !== "srr_accession"}
              >
                <SraRunAccessionWithValidation
                  key={sraResetKey}
                  title="SRA Run Accession"
                  placeholder="SRA Accession"
                  defaultValue={sraDefaultValue}
                  selectedLibraries={selectedLibraries}
                  setSelectedLibraries={setLibraries}
                  allowDuplicates={false}
                  showLabel={false}
                  showAddButton={false}
                />
              </div>

              <form.Field name="paired_end_libs">
                {(field) => (
                  <FieldItem>
                    <FieldErrors field={field} />
                  </FieldItem>
                )}
              </form.Field>
            </ServiceCardContent>
          </Card>
        </div>

        {/* Parameters */}
        <div className="md:col-span-12">
          <Card>
            <ServiceCardHeader>
              <RequiredFormCardTitle>
                Parameters
                <DialogInfoPopup
                  title={viralAssemblyParameters.title}
                  sections={viralAssemblyParameters.sections}
                />
              </RequiredFormCardTitle>
            </ServiceCardHeader>
            <ServiceCardContent className="space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
                <div className="flex-1 space-y-2">
                  <ServiceLabel>Assembly Strategy</ServiceLabel>
                  <form.Field name="strategy">
                    {(field) => (
                      <FieldItem>
                        <Select
                          items={strategyOptions}
                          value={field.state.value}
                          onValueChange={(value) => {
                            if (value != null) field.handleChange(value);
                          }}
                        >
                          <ServiceSelectTrigger aria-label="Assembly Strategy">
                            <SelectValue placeholder="Select strategy" />
                          </ServiceSelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {strategyOptions.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                        <FieldErrors field={field} />
                      </FieldItem>
                    )}
                  </form.Field>
                </div>
                {strategy === "irma" ? (
                  <div className="flex-1 space-y-2">
                    <ServiceLabel>Reference Database</ServiceLabel>
                    <form.Field name="module">
                      {(field) => (
                        <FieldItem>
                          <Select
                            items={moduleOptions}
                            value={field.state.value}
                            onValueChange={(value) => {
                              if (value != null) field.handleChange(value);
                            }}
                          >
                            <ServiceSelectTrigger
                              aria-label="Reference Database"
                              aria-describedby="module-description"
                            >
                              <SelectValue placeholder="Select" />
                            </ServiceSelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {moduleOptions.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                          <p
                            id="module-description"
                            className="text-xs text-muted-foreground"
                          >
                            {
                              moduleOptions.find(
                                (opt) => opt.value === field.state.value,
                              )?.description
                            }
                          </p>
                          <FieldErrors field={field} />
                        </FieldItem>
                      )}
                    </form.Field>
                  </div>
                ) : (
                  <form.Field name="reference_type">
                    {(field) => (
                      <FieldItem className="flex-1">
                        {/* A radio group is not a labelable element. */}
                        <ServiceFieldLabel
                          field={field}
                          id={`${field.name}-label`}
                          htmlFor={undefined}
                        >
                          Reference
                        </ServiceFieldLabel>
                        <ServiceRadioGroup
                          aria-labelledby={`${field.name}-label`}
                          value={field.state.value}
                          onValueChange={(value) => {
                            const parsed = referenceTypeSchema.safeParse(value);
                            if (parsed.success) field.handleChange(parsed.data);
                          }}
                        >
                          {referenceTypeOptions.map((opt) => (
                            <div
                              key={opt.value}
                              className="service-radio-group-item"
                            >
                              <RadioGroupItem
                                value={opt.value}
                                id={`reference-type-${opt.value}`}
                              />
                              <Label htmlFor={`reference-type-${opt.value}`}>
                                {opt.label}
                              </Label>
                            </div>
                          ))}
                        </ServiceRadioGroup>
                        <FieldErrors field={field} />
                      </FieldItem>
                    )}
                  </form.Field>
                )}
              </div>

              {strategy === "reference_guided" && referenceType === "genbank" ? (
                <form.Field name="reference_genbank_accession">
                  {(field) => (
                    <FieldItem>
                      <ServiceFieldLabel field={field}>Accession</ServiceFieldLabel>
                      <ServiceInput
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => {
                          field.handleChange(event.target.value);
                        }}
                        placeholder="e.g. NC_045512.2 or NC_045512.2,MN908947.3"
                        aria-invalid={fieldErrorMessage(field) !== null || undefined}
                      />
                      <FieldErrors field={field} />
                    </FieldItem>
                  )}
                </form.Field>
              ) : null}

              {strategy === "reference_guided" && referenceType === "fasta" ? (
                <form.Field name="reference_fasta_file">
                  {(field) => (
                    <FieldItem>
                      <ServiceFieldLabel field={field}>FASTA File</ServiceFieldLabel>
                      <WorkspaceObjectSelector
                        id={field.name}
                        preset="featureDnaFastaOrContigs"
                        placeholder="Select a FASTA file..."
                        value={field.state.value}
                        invalid={fieldErrorMessage(field) !== null}
                        onObjectSelect={(object: WorkspaceObject) => {
                          field.handleChange(object.path);
                        }}
                      />
                      <FieldErrors field={field} />
                    </FieldItem>
                  )}
                </form.Field>
              ) : null}

              <form.Field name="output_path">
                {(outputPathField) => (
                  <form.Field name="output_file">
                    {(outputNameField) => (
                      <ServiceOutputFields
                        layout="row"
                        required={false}
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
            </ServiceCardContent>
          </Card>
        </div>

        {/* Form controls */}
        <div className="md:col-span-12">
          <ServiceFormFooter
            form={form}
            onReset={handleReset}
            isSubmitting={isSubmitting}
            submitDisabled={!canSubmit}
            submitLabel="Assemble"
            spinnerClassName="mr-2 size-4"
          />
        </div>
      </form>

      <JobParamsDialog {...jobParamsDialogProps} />
    </section>
  );
};

export default ViralAssemblyPage;
