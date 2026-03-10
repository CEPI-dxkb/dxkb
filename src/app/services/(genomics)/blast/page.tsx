"use client";

import { useForm, useStore } from "@tanstack/react-form";
import { FieldItem, FieldErrors } from "@/components/ui/tanstack-form";
import { useState, useMemo, useEffect, useRef } from "react";
import { ServiceHeader } from "@/components/services/service-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { ChevronDown } from "lucide-react";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import {
  blastServiceInfo,
  blastServiceSearchProgram,
  blastServiceInputSource,
  blastServiceDatabaseSource,
  blastServiceDatabaseType,
} from "@/lib/services/service-info";
import OutputFolder from "@/components/services/output-folder";
import {
  RequiredFormLabel,
  RequiredFormLabelInfo,
  RequiredFormCardTitle,
} from "@/components/forms/required-form-components";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import { WorkspaceObject } from "@/lib/workspace-client";
import { ValidWorkspaceObjectTypes } from "@/lib/services/workspace/types";
import { blastPrecomputedDatabases } from "@/types/services";
import {
  transformBlastParams,
  useBlastDatabaseTypes,
  useBlastProgramTracking,
  useFastaValidation,
  createBlastFormValues,
  createInputSourceOverrides,
  createDatabaseSourceOverrides,
  extractInputFields,
  maxHitsOptionsBlast,
  evalueOptionsBlast,
} from "@/lib/forms/(genomics)/blast/blast-form-utils";
import {
  completeFormSchema,
  DEFAULT_BLAST_FORM_VALUES,
  type BlastFormData,
} from "@/lib/forms/(genomics)/blast/blast-form-schema";
import { JobParamsDialog } from "@/components/services/job-params-dialog";
import { useServiceFormSubmission } from "@/hooks/services/use-service-form-submission";
import { FastaTextarea } from "@/components/services/fasta-textarea";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { Label } from "@/components/ui/label";

export default function BlastServicePage() {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isOutputNameValid, setIsOutputNameValid] = useState(true);

  // Setup service debugging and form submission
  const {
    handleSubmit: submitForm,
    showParamsDialog,
    setShowParamsDialog,
    currentParams,
    serviceName,
    isSubmitting,
  } = useServiceFormSubmission<BlastFormData>({
    serviceName: "Homology",
    displayName: "BLAST",
    transformParams: transformBlastParams,
  });

  const form = useForm({
    defaultValues: DEFAULT_BLAST_FORM_VALUES as BlastFormData,
    validators: { onChange: completeFormSchema },
    onSubmit: async ({ value }) => {
      const data = value as BlastFormData;

      // Validate FASTA data if using fasta_data input source
      if (data.input_source === "fasta_data" && data.input_fasta_data) {
        if (!isFastaValid) {
          const errorMessage =
            fastaValidationResult?.message || "Invalid FASTA data";
          toast.error(errorMessage);
          return;
        }
      }

      await submitForm(data);
    },
  });

  // Use custom hooks for simplified state management
  const availableDatabaseTypes = useBlastDatabaseTypes(form);
  const currentBlastProgram = useBlastProgramTracking(form);
  const dbPrecomputedDatabase = useStore(form.store, (s) => s.values.db_precomputed_database);
  const dbType = useStore(form.store, (s) => s.values.db_type);
  const inputSource = useStore(form.store, (s) => s.values.input_source);
  const outputPath = useStore(form.store, (s) => s.values.output_path);
  const canSubmit = useStore(form.store, (s) => s.canSubmit);
  const { fastaValidationResult, isFastaValid, handleFastaValidationChange } =
    useFastaValidation(form, currentBlastProgram);
  const dbFastaTypes = useMemo(
    (): ValidWorkspaceObjectTypes[] => {
      if (dbPrecomputedDatabase !== "selFasta") {
        return ["feature_protein_fasta", "feature_dna_fasta"];
      }
      return dbType === "faa"
        ? ["feature_protein_fasta"]
        : ["feature_dna_fasta", "contigs"];
    },
    [dbPrecomputedDatabase, dbType],
  );

  // Determine workspace object types based on BLAST program (matching legacy behavior)
  const inputFastaTypes = useMemo((): ValidWorkspaceObjectTypes[] => {
    switch (currentBlastProgram) {
      case "blastp":
        return ["feature_protein_fasta"];
      case "blastn":
        return ["feature_dna_fasta", "contigs"];
      case "blastx":
        return ["feature_dna_fasta", "contigs"];
      case "tblastn":
        return ["feature_protein_fasta"];
      default:
        return ["feature_protein_fasta", "feature_dna_fasta"];
    }
  }, [currentBlastProgram]);

  // Track previous program to detect changes
  const previousProgramRef = useRef<BlastFormData["blast_program"]>(currentBlastProgram);

  // Keep input_type aligned with the current program (legacy behavior)
  useEffect(() => {
    const derivedInputType =
      currentBlastProgram === "blastp" || currentBlastProgram === "tblastn"
        ? "aa"
        : "dna";
    form.setFieldValue("input_type", derivedInputType);
  }, [currentBlastProgram, form]);

  // Clear input fields when BLAST program changes to prevent stale/incorrect files
  useEffect(() => {
    const previousProgram = previousProgramRef.current;

    // Only clear if program actually changed (not on initial mount)
    if (previousProgram !== currentBlastProgram && previousProgram !== undefined) {
      // Clear file-based input fields
      form.setFieldValue("input_fasta_file", "");
    }

    // Update ref for next comparison
    previousProgramRef.current = currentBlastProgram;
  }, [currentBlastProgram, form]);

  const handleReset = () => {
    form.reset(DEFAULT_BLAST_FORM_VALUES);
    setShowAdvanced(false);
  };

  const handleInputSourceChange = (
    newSource: BlastFormData["input_source"],
  ) => {
    const currentValues = form.state.values;
    const preservedFastaData = String((currentValues as Record<string, unknown>).input_fasta_data ?? "");

    const inputOverrides = createInputSourceOverrides(
      newSource,
      preservedFastaData,
    );
    const newValues = createBlastFormValues(currentValues, inputOverrides);

    form.reset(newValues);
  };

  const handleDatabaseSourceChange = (
    newDBPrecomputedDatabase: BlastFormData["db_precomputed_database"],
  ) => {
    const currentValues = form.state.values;
    const preservedInputFields = extractInputFields(currentValues);

    const databaseOverrides = createDatabaseSourceOverrides(
      newDBPrecomputedDatabase,
      preservedInputFields,
    );
    const newValues = createBlastFormValues(currentValues, databaseOverrides);

    form.reset(newValues);
  };

  return (
    <section>
      <ServiceHeader
        title="BLAST"
        description="The BLAST service uses BLAST (Basic Local Alignment Search Tool) to search against
          public or private genomes or other databases using DNA or protein sequence(s)."
        infoPopupTitle={blastServiceInfo.title}
        infoPopupDescription={blastServiceInfo.description}
        quickReferenceGuide="#"
        tutorial="#"
        instructionalVideo="#"
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="service-form-section"
      >
        {/* Search Program Card */}
        <Card>
          <CardHeader className="service-card-header">
            <RequiredFormCardTitle className="service-card-title">
              Search Program
              <DialogInfoPopup
                title={blastServiceSearchProgram.title}
                description={blastServiceSearchProgram.description}
                sections={blastServiceSearchProgram.sections}
              />
            </RequiredFormCardTitle>
          </CardHeader>

          <CardContent className="service-card-content">
            <form.Field name="blast_program">
              {(field) => (
                <FieldItem>
                  <RadioGroup
                    value={field.state.value}
                    onValueChange={field.handleChange}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full"
                  >
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="blastn" id="blastn" />
                      <Label
                        htmlFor="blastn"
                        className="service-radio-group-label"
                      >
                        BLASTN (nucleotide → nucleotide database)
                      </Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="blastp" id="blastp" />
                      <Label
                        htmlFor="blastp"
                        className="service-radio-group-label"
                      >
                        BLASTP (protein → protein database)
                      </Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="blastx" id="blastx" />
                      <Label
                        htmlFor="blastx"
                        className="service-radio-group-label"
                      >
                        BLASTX (translated nucleotide → protein database)
                      </Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="tblastn" id="tblastn" />
                      <Label
                        htmlFor="tblastn"
                        className="service-radio-group-label"
                      >
                        tBLASTn (protein → translated nucleotide database)
                      </Label>
                    </div>
                  </RadioGroup>
                  <FieldErrors field={field} />
                </FieldItem>
              )}
            </form.Field>
          </CardContent>
        </Card>

        {/* Input Source Card */}
        <Card>
          <CardHeader className="service-card-header">
            <RequiredFormCardTitle className="service-card-title">
              Input Source
              <DialogInfoPopup
                title={blastServiceInputSource.title}
                description={blastServiceInputSource.description}
                sections={blastServiceInputSource.sections}
              />
            </RequiredFormCardTitle>
          </CardHeader>

          <CardContent className="service-card-content">
            <form.Field name="input_source">
              {(field) => (
                <div className="space-y-6">
                  <FieldItem>
                    <RadioGroup
                      onValueChange={(value) => {
                        field.handleChange(
                          value as BlastFormData["input_source"],
                        );
                        handleInputSourceChange(
                          value as BlastFormData["input_source"],
                        );
                      }}
                      value={field.state.value}
                      className="service-radio-group-horizontal"
                    >
                      <div className="flex items-center gap-3">
                        <RadioGroupItem
                          value="fasta_data"
                          id="fastaSequence"
                        />
                        <Label htmlFor="fastaSequence">
                          Enter sequence
                        </Label>
                      </div>
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value="fasta_file" id="fastaFile" />
                        <Label htmlFor="fastaFile">
                          Select FASTA file
                        </Label>
                      </div>
                      <div className="flex items-center gap-3">
                        <RadioGroupItem
                          value="feature_group"
                          id="featureGroup"
                        />
                        <Label htmlFor="featureGroup">
                          Select feature group
                        </Label>
                      </div>
                    </RadioGroup>
                    <FieldErrors field={field} />
                  </FieldItem>

                  <div
                    className={
                      inputSource === "fasta_data"
                        ? "service-card-content-grid-item"
                        : "hidden"
                    }
                  >
                    <form.Field name="input_fasta_data">
                      {(fastaField) => (
                        <FieldItem>
                          <FastaTextarea
                            value={fastaField.state.value ?? ""}
                            onChange={fastaField.handleChange}
                            inputType={currentBlastProgram}
                            onValidationChange={handleFastaValidationChange}
                            required={true}
                            showValidationStatus={true}
                          />
                          <FieldErrors field={fastaField} />
                        </FieldItem>
                      )}
                    </form.Field>
                  </div>

                  <div
                    className={
                      inputSource === "fasta_file"
                        ? "service-card-content-grid-item"
                        : "hidden"
                    }
                  >
                    <form.Field name="input_fasta_file">
                      {(fileField) => (
                        <FieldItem>
                          <WorkspaceObjectSelector
                            types={inputFastaTypes}
                            placeholder="Select a FASTA file to search..."
                            value={fileField.state.value}
                            onObjectSelect={(object: WorkspaceObject) => {
                              fileField.handleChange(object.path);
                            }}
                          />
                          <FieldErrors field={fileField} />
                        </FieldItem>
                      )}
                    </form.Field>
                  </div>

                  <div
                    className={
                      inputSource === "feature_group"
                        ? "service-card-content-grid-item mb-4"
                        : "hidden"
                    }
                  >
                    <form.Field name="input_feature_group">
                      {(groupField) => (
                        <FieldItem>
                          <WorkspaceObjectSelector
                            types={["feature_group"]}
                            placeholder="Select a feature group to search..."
                            value={groupField.state.value}
                            onObjectSelect={(object: WorkspaceObject) => {
                              groupField.handleChange(object.path);
                            }}
                          />
                          <FieldErrors field={groupField} />
                        </FieldItem>
                      )}
                    </form.Field>
                  </div>
                </div>
              )}
            </form.Field>
          </CardContent>
        </Card>

        {/* Output Settings Card */}
        <Card>
          <CardHeader className="service-card-header">
            <CardTitle className="service-card-title">Parameters</CardTitle>
          </CardHeader>

          <CardContent className="service-card-content">
            <div className="service-card-row">
              <form.Field name="db_precomputed_database">
                {(field) => (
                  <FieldItem className="w-full">
                    <div className="service-card-row-item">
                      <RequiredFormLabelInfo
                        label="Database Source"
                        infoPopup={blastServiceDatabaseSource}
                      />
                      <Select
                        items={blastPrecomputedDatabases}
                        value={field.state.value}
                        onValueChange={(value) => {
                          field.handleChange(
                            value as BlastFormData["db_precomputed_database"],
                          );
                          handleDatabaseSourceChange(
                            value as BlastFormData["db_precomputed_database"],
                          );
                        }}
                      >
                        <SelectTrigger className="service-card-select-trigger">
                          <SelectValue placeholder="Select database source" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {blastPrecomputedDatabases.map((dbSource) => (
                              <SelectItem key={dbSource.value} value={dbSource.value}>
                                {dbSource.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                    <FieldErrors field={field} />
                  </FieldItem>
                )}
              </form.Field>

              <form.Field name="db_type">
                {(field) => (
                  <FieldItem className="w-full">
                    <div className="service-card-row-item">
                      <RequiredFormLabelInfo
                        label="Database Type"
                        infoPopup={blastServiceDatabaseType}
                      />
                      <Select
                        items={availableDatabaseTypes}
                        key={`${currentBlastProgram}-${dbPrecomputedDatabase}-${availableDatabaseTypes.length}`}
                        value={field.state.value || ""}
                        onValueChange={(value) => {
                          if (value != null) field.handleChange(value as BlastFormData["db_type"]);
                        }}
                      >
                        <SelectTrigger className="service-card-select-trigger">
                          <SelectValue placeholder="Select database type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {availableDatabaseTypes.map((dbTypeOption) => (
                              <SelectItem key={dbTypeOption.value} value={dbTypeOption.value}>
                                {dbTypeOption.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                    <FieldErrors field={field} />
                  </FieldItem>
                )}
              </form.Field>
            </div>

            {/* Database Source Card */}
            {/* OPTIMIZE: Can be optimized by conditionally rendering the divs based on the db_precomputed_database value
            instead of loading all the divs and hiding them based on the value */}
            <div className="service-card-row">
              <div className="service-card-row-item">
                <div
                  className={
                    dbPrecomputedDatabase === "selGenome"
                      ? "service-card-content-grid-item"
                      : "hidden"
                  }
                >
                  <RequiredFormLabel className="service-card-label">
                    Select a genome
                  </RequiredFormLabel>
                  <form.Field name="db_genome_list">
                    {(field) => (
                      <FieldItem>
                        <WorkspaceObjectSelector
                          types={["unspecified"]}
                          placeholder="Genome..."
                          onObjectSelect={(object: WorkspaceObject) => {
                            field.handleChange([object.path]);
                          }}
                        />
                        <FieldErrors field={field} />
                      </FieldItem>
                    )}
                  </form.Field>
                </div>

                <div
                  className={
                    dbPrecomputedDatabase === "selGroup"
                      ? "service-card-content-grid-item"
                      : "hidden"
                  }
                >
                  <RequiredFormLabel className="service-card-label">
                    Select a genome group
                  </RequiredFormLabel>
                  <form.Field name="db_genome_group">
                    {(field) => (
                      <FieldItem>
                        <WorkspaceObjectSelector
                          types={["genome_group"]}
                          placeholder="Genome group..."
                          onObjectSelect={(object: WorkspaceObject) => {
                            field.handleChange(object.path);
                          }}
                        />
                        <FieldErrors field={field} />
                      </FieldItem>
                    )}
                  </form.Field>
                </div>

                <div
                  className={
                    dbPrecomputedDatabase === "selFeatureGroup"
                      ? "service-card-content-grid-item"
                      : "hidden"
                  }
                >
                  <RequiredFormLabel className="service-card-label">
                    Select a feature group
                  </RequiredFormLabel>
                  <form.Field name="db_feature_group">
                    {(field) => (
                      <FieldItem>
                        <WorkspaceObjectSelector
                          types={["feature_group"]}
                          placeholder="Feature group..."
                          onObjectSelect={(object: WorkspaceObject) => {
                            field.handleChange(object.path);
                          }}
                        />
                        <FieldErrors field={field} />
                      </FieldItem>
                    )}
                  </form.Field>
                </div>

                <div
                  className={
                    dbPrecomputedDatabase === "selTaxon"
                      ? "service-card-content-grid-item"
                      : "hidden"
                  }
                >
                  <RequiredFormLabel className="service-card-label">
                    Select a taxon
                  </RequiredFormLabel>
                  <form.Field name="db_taxon_list">
                    {(field) => (
                      <FieldItem>
                        <WorkspaceObjectSelector
                          types={["unspecified"]}
                          placeholder="Taxon..."
                          onObjectSelect={(object: WorkspaceObject) => {
                            field.handleChange([object.path]);
                          }}
                        />
                        <FieldErrors field={field} />
                      </FieldItem>
                    )}
                  </form.Field>
                </div>

                <div
                  className={
                    dbPrecomputedDatabase === "selFasta"
                      ? "service-card-content-grid-item"
                      : "hidden"
                  }
                >
                  <RequiredFormLabel className="service-card-label">
                    Select a FASTA file
                  </RequiredFormLabel>
                  <form.Field name="db_fasta_file">
                    {(field) => (
                      <FieldItem>
                        <WorkspaceObjectSelector
                          types={dbFastaTypes}
                          placeholder="FASTA file..."
                          onObjectSelect={(object: WorkspaceObject) => {
                            field.handleChange(object.path);
                          }}
                        />
                        <FieldErrors field={field} />
                      </FieldItem>
                    )}
                  </form.Field>
                </div>
              </div>
            </div>

            <div className="service-card-row">
              <div className="service-card-row-item">
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
              </div>

              <div className="service-card-row-item">
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

            <Collapsible
              open={showAdvanced}
              onOpenChange={setShowAdvanced}
              className="service-collapsible-container"
            >
              <CollapsibleTrigger className="service-collapsible-trigger">
                Advanced Options
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-180 transform" : ""}`}
                />
              </CollapsibleTrigger>

              <CollapsibleContent className="service-collapsible-content">
                <div className="service-card-content-grid">
                  <form.Field name="blast_max_hits">
                    {(field) => (
                      <FieldItem className="service-card-content-grid-item">
                        <Label
                          htmlFor="blast_max_hits"
                          className="service-card-label"
                        >
                          Max Hits
                        </Label>
                        <Select
                          items={maxHitsOptionsBlast}
                          value={field.state.value}
                          onValueChange={(value) =>
                            value != null && field.handleChange(Number(value))
                          }
                        >
                          <SelectTrigger className="service-card-select-trigger">
                            <SelectValue placeholder="Select max hits" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {maxHitsOptionsBlast.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                        <FieldErrors field={field} />
                      </FieldItem>
                    )}
                  </form.Field>

                  <form.Field name="blast_evalue_cutoff">
                    {(field) => (
                      <FieldItem className="service-card-content-grid-item">
                        <Label
                          htmlFor="blast_evalue_cutoff"
                          className="service-card-label"
                        >
                          E-Value Threshold
                        </Label>
                        <Select
                          items={evalueOptionsBlast}
                          value={field.state.value}
                          onValueChange={(value) =>
                            value != null && field.handleChange(Number(value))
                          }
                        >
                          <SelectTrigger className="service-card-select-trigger">
                            <SelectValue placeholder="Select E-Value Threshold" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {evalueOptionsBlast.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
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
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>

        {/* Form Controls */}
        <div className="service-form-controls">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              className="service-form-controls-button"
            >
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
