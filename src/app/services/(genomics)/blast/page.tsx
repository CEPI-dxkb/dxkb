"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useState, useMemo, useEffect, useRef } from "react";
import { ServiceHeader } from "@/components/services/service-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
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
import { Checkbox } from "@/components/ui/checkbox";
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
import { transformBlastParams, submitServiceJob } from "@/lib/services/service-utils";
import { JobParamsDialog } from "@/components/services/job-params-dialog";
import { useServiceFormSubmission } from "@/hooks/services/use-service-form-submission";
import { FastaTextarea } from "@/components/services/fasta-textarea";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import {
  completeFormSchema,
  DEFAULT_BLAST_FORM_VALUES,
  type BlastFormData,
  useBlastDatabaseTypes,
  useBlastProgramTracking,
  useFastaValidation,
  createBlastFormValues,
  createInputSourceOverrides,
  createDatabaseSourceOverrides,
  extractInputFields,
} from "@/lib/forms/(genomics)";

export default function BlastServicePage() {
  const form = useForm<BlastFormData>({
    resolver: zodResolver(completeFormSchema),
    defaultValues: DEFAULT_BLAST_FORM_VALUES,
    mode: "onChange",
  });

  // Use custom hooks for simplified state management
  const availableDatabaseTypes = useBlastDatabaseTypes(form);
  const currentBlastProgram = useBlastProgramTracking(form);
  const dbPrecomputedDatabase = form.watch("db_precomputed_database");
  const dbType = form.watch("db_type");
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
    form.setValue("input_type", derivedInputType);
  }, [currentBlastProgram, form]);

  // Clear input fields when BLAST program changes to prevent stale/incorrect files
  useEffect(() => {
    const previousProgram = previousProgramRef.current;
    
    // Only clear if program actually changed (not on initial mount)
    if (previousProgram !== currentBlastProgram && previousProgram !== undefined) {
      // Clear file-based input fields
      form.setValue("input_fasta_file", "");
    }
    
    // Update ref for next comparison
    previousProgramRef.current = currentBlastProgram;
  }, [currentBlastProgram, form]);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOutputNameValid, setIsOutputNameValid] = useState(true);

  // Setup service debugging and form submission
  const {
    handleSubmit,
    showParamsDialog,
    setShowParamsDialog,
    currentParams,
    serviceName,
  } = useServiceFormSubmission<BlastFormData>({
    serviceName: "BLAST",
    transformParams: transformBlastParams,
    onSubmit: async (data) => {
      // Validate FASTA data if using fasta_data input source
      if (data.input_source === "fasta_data" && data.input_fasta_data) {
        if (!isFastaValid) {
          const errorMessage =
            fastaValidationResult?.message || "Invalid FASTA data";
          console.error("Invalid FASTA data:", errorMessage);
          toast.error(errorMessage);
          return;
        }
      }

      try {
        setIsSubmitting(true);
        // Submit the BLAST job using the utility function
        const result = await submitServiceJob(
          "Homology",
          transformBlastParams(data),
        );

        if (result.success) {
          console.log("BLAST job submitted successfully:", result.job[0]);

          // Show success message
          toast.success("BLAST job submitted successfully!", {
            description: `Job ID: ${result.job[0].id}`,
          });

          // Optionally redirect to jobs page
          // router.push(`/workspace/jobs/${result.job.id}`);
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        console.error("Failed to submit BLAST job:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Failed to submit BLAST job";
        toast.error("Submission failed", {
          description: errorMessage,
        });
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  const handleReset = () => {
    form.reset(DEFAULT_BLAST_FORM_VALUES);
    setShowAdvanced(false);
  };

  const handleInputSourceChange = (
    newSource: BlastFormData["input_source"],
  ) => {
    const currentValues = form.getValues();
    const preservedFastaData = (currentValues as any).input_fasta_data || "";

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
    const currentValues = form.getValues();
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

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
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
              <FormField
                control={form.control}
                name="blast_program"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <RadioGroup
                        value={field.value}
                        onValueChange={field.onChange}
                        className="service-radio-group-grid"
                      >
                        <div className="service-radio-group-item">
                          <RadioGroupItem value="blastn" id="blastn" />
                          <FormLabel
                            htmlFor="blastn"
                            className="service-radio-group-label"
                          >
                            BLASTN (nucleotide → nucleotide database)
                          </FormLabel>
                        </div>
                        <div className="service-radio-group-item">
                          <RadioGroupItem value="blastp" id="blastp" />
                          <FormLabel
                            htmlFor="blastp"
                            className="service-radio-group-label"
                          >
                            BLASTP (protein → protein database)
                          </FormLabel>
                        </div>
                        <div className="service-radio-group-item">
                          <RadioGroupItem value="blastx" id="blastx" />
                          <FormLabel
                            htmlFor="blastx"
                            className="service-radio-group-label"
                          >
                            BLASTX (translated nucleotide → protein database)
                          </FormLabel>
                        </div>
                        <div className="service-radio-group-item">
                          <RadioGroupItem value="tblastn" id="tblastn" />
                          <FormLabel
                            htmlFor="tblastn"
                            className="service-radio-group-label"
                          >
                            tBLASTn (protein → translated nucleotide database)
                          </FormLabel>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
              <FormField
                control={form.control}
                name="input_source"
                render={({ field }) => (
                  <div className="space-y-6">
                    <FormItem>
                      <FormControl>
                        <RadioGroup
                          onValueChange={(value) => {
                            field.onChange(
                              value as BlastFormData["input_source"],
                            );
                            handleInputSourceChange(
                              value as BlastFormData["input_source"],
                            );
                          }}
                          value={field.value}
                          className="service-radio-group"
                        >
                          <div className="service-radio-group-item">
                            <RadioGroupItem
                              value="fasta_data"
                              id="fastaSequence"
                            />
                            <FormLabel htmlFor="fastaSequence">
                              Enter sequence
                            </FormLabel>
                          </div>
                          <div className="service-radio-group-item">
                            <RadioGroupItem value="fasta_file" id="fastaFile" />
                            <FormLabel htmlFor="fastaFile">
                              Select FASTA file
                            </FormLabel>
                          </div>
                          <div className="service-radio-group-item">
                            <RadioGroupItem
                              value="feature_group"
                              id="featureGroup"
                            />
                            <FormLabel htmlFor="featureGroup">
                              Select feature group
                            </FormLabel>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>

                    <div
                      className={
                        form.watch("input_source") === "fasta_data"
                          ? "service-card-content-grid-item"
                          : "hidden"
                      }
                    >
                      <FormField
                        control={form.control}
                        name="input_fasta_data"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <FastaTextarea
                                value={field.value ?? ""}
                                onChange={field.onChange}
                                inputType={currentBlastProgram}
                                onValidationChange={handleFastaValidationChange}
                                required={true}
                                showValidationStatus={true}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div
                      className={
                        form.watch("input_source") === "fasta_file"
                          ? "service-card-content-grid-item"
                          : "hidden"
                      }
                    >
                      <FormField
                        control={form.control}
                        name="input_fasta_file"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <WorkspaceObjectSelector
                                types={inputFastaTypes}
                                placeholder="Select a FASTA file to search..."
                                value={field.value}
                                onObjectSelect={(object: WorkspaceObject) => {
                                  field.onChange(object.path);
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div
                      className={
                        form.watch("input_source") === "feature_group"
                          ? "service-card-content-grid-item mb-4"
                          : "hidden"
                      }
                    >
                      <FormField
                        control={form.control}
                        name="input_feature_group"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <WorkspaceObjectSelector
                                types={["feature_group"]}
                                placeholder="Select a feature group to search..."
                                value={field.value}
                                onObjectSelect={(object: WorkspaceObject) => {
                                  field.onChange(object.path);
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}
              />
            </CardContent>
          </Card>

          {/* Output Settings Card */}
          <Card>
            <CardHeader className="service-card-header">
              <CardTitle className="service-card-title">Parameters</CardTitle>
            </CardHeader>

            <CardContent className="service-card-content">
              <div className="service-card-row">
                <FormField
                  control={form.control}
                  name="db_precomputed_database"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormControl>
                        <div className="service-card-row-item">
                          <RequiredFormLabelInfo
                            label="Database Source"
                            infoPopup={blastServiceDatabaseSource}
                          />
                          <Select
                            value={field.value}
                            onValueChange={(value) => {
                              field.onChange(
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
                            <SelectContent className="service-card-select-content">
                              {blastPrecomputedDatabases.map((dbSource) => (
                                <SelectItem
                                  key={dbSource.value}
                                  value={dbSource.value}
                                >
                                  {dbSource.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="db_type"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormControl>
                        <div className="service-card-row-item">
                          <RequiredFormLabelInfo
                            label="Database Type"
                            infoPopup={blastServiceDatabaseType}
                          />
                          <Select
                            key={`${currentBlastProgram}-${dbPrecomputedDatabase}-${availableDatabaseTypes.length}`}
                            value={field.value || ""}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger className="service-card-select-trigger">
                              <SelectValue placeholder="Select database type" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableDatabaseTypes.length === 0 ? (
                                <SelectItem value="" disabled>
                                  No options available
                                </SelectItem>
                              ) : (
                                availableDatabaseTypes.map((dbType) => (
                                  <SelectItem
                                    key={dbType.value}
                                    value={dbType.value}
                                  >
                                    {dbType.label}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Database Source Card */}
              {/* OPTIMIZE: Can be optimized by conditionally rendering the divs based on the db_precomputed_database value
              instead of loading all the divs and hiding them based on the value */}
              <div className="service-card-row">
                <div className="service-card-row-item">
                  <div
                    className={
                      form.watch("db_precomputed_database") === "selGenome"
                        ? "service-card-content-grid-item"
                        : "hidden"
                    }
                  >
                    <RequiredFormLabel className="service-card-label">
                      Select a genome
                    </RequiredFormLabel>
                    <FormField
                      control={form.control}
                      name="db_genome_list"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <WorkspaceObjectSelector
                              types={["unspecified"]}
                              placeholder="Genome..."
                              onObjectSelect={(object: WorkspaceObject) => {
                                field.onChange([object.path]);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div
                    className={
                      form.watch("db_precomputed_database") === "selGroup"
                        ? "service-card-content-grid-item"
                        : "hidden"
                    }
                  >
                    <RequiredFormLabel className="service-card-label">
                      Select a genome group
                    </RequiredFormLabel>
                    <FormField
                      control={form.control}
                      name="db_genome_group"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <WorkspaceObjectSelector
                              types={["genome_group"]}
                              placeholder="Genome group..."
                              onObjectSelect={(object: WorkspaceObject) => {
                                field.onChange(object.path);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div
                    className={
                      form.watch("db_precomputed_database") ===
                      "selFeatureGroup"
                        ? "service-card-content-grid-item"
                        : "hidden"
                    }
                  >
                    <RequiredFormLabel className="service-card-label">
                      Select a feature group
                    </RequiredFormLabel>
                    <FormField
                      control={form.control}
                      name="db_feature_group"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <WorkspaceObjectSelector
                              types={["feature_group"]}
                              placeholder="Feature group..."
                              onObjectSelect={(object: WorkspaceObject) => {
                                field.onChange(object.path);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div
                    className={
                      form.watch("db_precomputed_database") === "selTaxon"
                        ? "service-card-content-grid-item"
                        : "hidden"
                    }
                  >
                    <RequiredFormLabel className="service-card-label">
                      Select a taxon
                    </RequiredFormLabel>
                    <FormField
                      control={form.control}
                      name="db_taxon_list"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <WorkspaceObjectSelector
                              types={["unspecified"]}
                              placeholder="Taxon..."
                              onObjectSelect={(object: WorkspaceObject) => {
                                field.onChange([object.path]);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div
                    className={
                      form.watch("db_precomputed_database") === "selFasta"
                        ? "service-card-content-grid-item"
                        : "hidden"
                    }
                  >
                    <RequiredFormLabel className="service-card-label">
                      Select a FASTA file
                    </RequiredFormLabel>
                    <FormField
                      control={form.control}
                      name="db_fasta_file"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <WorkspaceObjectSelector
                              types={dbFastaTypes}
                              placeholder="FASTA file..."
                              onObjectSelect={(object: WorkspaceObject) => {
                                field.onChange(object.path);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>

              <div className="service-card-row">
                <div className="service-card-row-item">
                  <FormField
                    control={form.control}
                    name="output_path"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <OutputFolder
                            required={true}
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
                            required={true}
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
                    <FormField
                      control={form.control}
                      name="blast_max_hits"
                      render={({ field }) => (
                        <FormItem className="service-card-content-grid-item">
                          <FormLabel
                            htmlFor="blast_max_hits"
                            className="service-card-label"
                          >
                            Max Hits
                          </FormLabel>
                          <FormControl>
                            <Select
                              value={(field.value ?? 10).toString()}
                              onValueChange={(value) =>
                                field.onChange(parseInt(value, 10))
                              }
                            >
                              <SelectTrigger className="service-card-select-trigger">
                                <SelectValue placeholder="Select max hits" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1">1</SelectItem>
                                <SelectItem value="10">10</SelectItem>
                                <SelectItem value="20">20</SelectItem>
                                <SelectItem value="50">50</SelectItem>
                                <SelectItem value="100">100</SelectItem>
                                <SelectItem value="500">500</SelectItem>
                                <SelectItem value="5000">5000</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="blast_evalue_cutoff"
                      render={({ field }) => (
                        <FormItem className="service-card-content-grid-item">
                          <FormLabel
                            htmlFor="blast_evalue_cutoff"
                            className="service-card-label"
                          >
                            E-Value Threshold
                          </FormLabel>
                          <FormControl>
                            <Select
                              value={(field.value ?? 0.0001).toString()}
                              onValueChange={(value) =>
                                field.onChange(parseFloat(value))
                              }
                            >
                              <SelectTrigger className="service-card-select-trigger">
                                <SelectValue placeholder="Select E-Value Threshold" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="0.0001">0.0001</SelectItem>
                                <SelectItem value="0.001">0.001</SelectItem>
                                <SelectItem value="0.01">0.01</SelectItem>
                                <SelectItem value="0.1">0.1</SelectItem>
                                <SelectItem value="1">1</SelectItem>
                                <SelectItem value="10">10</SelectItem>
                                <SelectItem value="100">100</SelectItem>
                                <SelectItem value="1000">1000</SelectItem>
                                <SelectItem value="10000">10000</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>

          {/* Form Controls */}
          <div className="service-form-controls">
            <div className="flex items-center gap-2">
              <Checkbox id="view-results" />
              <Label htmlFor="view-results">View Results</Label>
            </div>
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
                disabled={isSubmitting || !form.formState.isValid || !isOutputNameValid}
              >
                {isSubmitting ? <Spinner /> : null}
                Submit
              </Button>
            </div>
          </div>
        </form>
      </Form>

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
