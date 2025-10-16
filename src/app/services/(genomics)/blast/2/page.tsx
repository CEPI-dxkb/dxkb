"use client";

import { z } from "zod";
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
import { useState, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
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
} from "@/lib/service-info";
import { Checkbox } from "@/components/ui/checkbox";
import OutputFolder from "@/components/services/output-folder";
import {
  RequiredFormLabel,
  RequiredFormLabelInfo,
  RequiredFormCardTitle,
} from "@/components/forms/required-form-components";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import { WorkspaceObject } from "@/lib/workspace-api";
import { blastPrecomputedDatabases } from "@/types/services";
import {
  getAvailableBlastDatabaseTypes,
  getDefaultBlastDatabaseType,
  handleFormSubmit,
} from "@/lib/service-utils";

// Base schema with common fields (excluding discriminators)
const baseFormSchema = z.object({
  input_type: z.enum(["aa", "dna"]),
  db_type: z.enum(["fna", "ffn", "faa", "frn"]),
  db_source: z.enum([
    "precomputed_database",
    "genome_list",
    "genome_group",
    "feature_group",
    "taxon_list",
    "fasta_file",
  ]),
  db_precomputed_database: z.enum([
    "bacteria_archaea",
    "viral_reference",
    "selGenome",
    "selGroup",
    "selFeatureGroup",
    "selTaxon",
    "selFasta",
  ]),
  blast_program: z.enum(["blastn", "blastp", "blastx", "tblastn"]),
  output_file: z.string(),
  output_path: z.string(),
  blast_max_hits: z
    .number()
    .refine((val) => [1, 10, 20, 50, 100, 500, 5000].includes(val), {
      message: "blast_max_hits must be one of: 1, 10, 20, 50, 100, 500, 5000",
    }),
  blast_evalue_cutoff: z
    .number()
    .refine(
      (val) =>
        [0.0001, 0.001, 0.01, 0.1, 1, 10, 100, 1000, 10000].includes(val),
      {
        message:
          "blast_evalue_cutoff must be one of: 0.0001, 0.001, 0.01, 0.1, 1, 10, 100, 1000, 10000",
      },
    ),
});

// Input source discriminated union
const inputSourceFormSchema = z.discriminatedUnion("input_source", [
  z.object({
    input_source: z.literal("fasta_data"),
    input_fasta_data: z.string(),
  }),
  z.object({
    input_source: z.literal("fasta_file"),
    input_fasta_file: z.string(),
  }),
  z.object({
    input_source: z.literal("feature_group"),
    input_feature_group: z.string(),
  }),
]);

// Database conditional fields - optional fields that may be present based on db_precomputed_database
const databaseConditionalFieldsSchema = z.object({
  db_genome_list: z.array(z.string()).optional(),
  db_genome_group: z.string().optional(),
  db_feature_group: z.string().optional(),
  db_taxon_list: z.array(z.string()).optional(),
  db_fasta_file: z.string().optional(),
});

// Combined schema using intersection
const completeFormSchema = baseFormSchema
  .and(inputSourceFormSchema)
  .and(databaseConditionalFieldsSchema);

// Default form values constant
const DEFAULT_BLAST_FORM_VALUES = {
  input_type: "aa" as const,
  input_source: "fasta_data" as const,
  input_fasta_data: "",
  db_type: "fna" as const,
  db_source: "precomputed_database" as const,
  blast_program: "blastn" as const,
  output_file: "",
  output_path: "",
  blast_max_hits: 10,
  blast_evalue_cutoff: 0.0001,
  db_precomputed_database: "bacteria_archaea" as const,
};

export default function BlastServicePage() {
  const form = useForm<z.infer<typeof completeFormSchema>>({
    resolver: zodResolver(completeFormSchema),
    defaultValues: DEFAULT_BLAST_FORM_VALUES,
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [availableDatabaseTypes, setAvailableDatabaseTypes] = useState(
    getAvailableBlastDatabaseTypes("blastn", "bacteria_archaea"),
  );

  // Log form value changes
  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
      console.log("Form changed:", { name, type, value });
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Update available database types when blast_program or db_precomputed_database changes
  useEffect(() => {
    const subscription = form.watch((value) => {
      if (value.blast_program && value.db_precomputed_database) {
        const newAvailableTypes = getAvailableBlastDatabaseTypes(
          value.blast_program,
          value.db_precomputed_database,
        );
        setAvailableDatabaseTypes(newAvailableTypes);

        // If current db_type is not available, set to default
        const isCurrentTypeAvailable = newAvailableTypes.some(
          (type) => type.value === value.db_type,
        );
        if (!isCurrentTypeAvailable) {
          const defaultType = getDefaultBlastDatabaseType(
            value.blast_program,
            value.db_precomputed_database,
          );
          form.setValue("db_type", defaultType as any);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Helper function to create base form values with overrides
  const createFormValues = (currentValues: any, overrides: Record<string, any>) => ({
    input_type: currentValues.input_type,
    input_source: currentValues.input_source,
    db_type: currentValues.db_type,
    db_source: currentValues.db_source,
    blast_program: currentValues.blast_program,
    output_file: currentValues.output_file,
    output_path: currentValues.output_path,
    blast_max_hits: currentValues.blast_max_hits,
    blast_evalue_cutoff: currentValues.blast_evalue_cutoff,
    db_precomputed_database: currentValues.db_precomputed_database,
    ...overrides,
  });

  const handleReset = () => {
    form.reset(DEFAULT_BLAST_FORM_VALUES);
    setShowAdvanced(false);
    setAvailableDatabaseTypes(
      getAvailableBlastDatabaseTypes("blastn", "bacteria_archaea"),
    );
  };

  const handleInputSourceChange = (newSource: string) => {
    const currentValues = form.getValues();

    // Create new values with updated input_source and appropriate input field
    const inputFieldOverrides = {
      input_source: newSource,
      ...(newSource === "fasta_data" && { input_fasta_data: "" }),
      ...(newSource === "fasta_file" && { input_fasta_file: "" }),
      ...(newSource === "feature_group" && { input_feature_group: "" }),
    };

    const newValues = createFormValues(currentValues, inputFieldOverrides);

    // Reset form with new values
    form.reset(newValues as any);
  };

  const handleDatabaseSourceChange = (newDBPrecomputedDatabase: string) => {
    const currentValues = form.getValues();

    // Find the selected database option to get its db_source
    const selectedDb = blastPrecomputedDatabases.find(
      (db) => db.value === newDBPrecomputedDatabase
    );

    if (!selectedDb) return;

    // Create new values with updated db_source, db_precomputed_database, and appropriate database field
    const databaseFieldOverrides = {
      db_source: selectedDb.db_source,
      db_precomputed_database: newDBPrecomputedDatabase,
      ...(newDBPrecomputedDatabase === "selGenome" && { db_genome_list: [] }),
      ...(newDBPrecomputedDatabase === "selGroup" && { db_genome_group: "" }),
      ...(newDBPrecomputedDatabase === "selFeatureGroup" && { db_feature_group: "" }),
      ...(newDBPrecomputedDatabase === "selTaxon" && { db_taxon_list: [] }),
      ...(newDBPrecomputedDatabase === "selFasta" && { db_fasta_file: "" }),
    };

    const newValues = createFormValues(currentValues, databaseFieldOverrides);

    // Reset form with new values
    form.reset(newValues as any);
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
          onSubmit={form.handleSubmit((data) => {
            console.log("Form submitted:", data);
            // handleFormSubmit();
          })}
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
                            field.onChange(value);
                            handleInputSourceChange(value);
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

                    <div className={form.watch("input_source") === "fasta_data" ? "service-card-content-grid-item" : "hidden"}>
                      <FormField
                        control={form.control}
                        name="input_fasta_data"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <div className="service-card-content-grid-item">
                                <RequiredFormLabel className="service-card-label">
                                  Enter a FASTA formatted sequence.
                                </RequiredFormLabel>
                                <Textarea
                                  id="sequence-input"
                                  placeholder="Enter one or more source nucleotide or protein sequences to search. Requires FASTA format."
                                  value={field.value}
                                  onChange={field.onChange}
                                  className="service-card-textarea"
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className={form.watch("input_source") === "fasta_file" ? "service-card-content-grid-item" : "hidden"}>
                      <FormField
                        control={form.control}
                        name="input_fasta_file"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <WorkspaceObjectSelector
                                types={["feature_protein_fasta", "feature_dna_fasta"]}
                                placeholder="Select a FASTA file to search..."
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

                    <div className={form.watch("input_source") === "feature_group" ? "service-card-content-grid-item mb-4" : "hidden"}>
                      <FormField
                        control={form.control}
                        name="input_feature_group"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                            <WorkspaceObjectSelector
                                types={["feature_group"]}
                                placeholder="Select a feature group to search..."
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
                              field.onChange(value);
                              handleDatabaseSourceChange(value);
                            }}
                          >
                            <SelectTrigger className="service-card-select-trigger">
                              <SelectValue placeholder="Select database source" />
                            </SelectTrigger>
                            <SelectContent className="service-card-select-content">
                              {blastPrecomputedDatabases.map((dbSource) => (
                                <SelectItem key={dbSource.value} value={dbSource.value}>
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
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger className="service-card-select-trigger">
                              <SelectValue placeholder="Select database type" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableDatabaseTypes.map((dbType) => (
                                <SelectItem key={dbType.value} value={dbType.value}>
                                  {dbType.label}
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
              </div>

              {/* Database Source Card */}
              {/* OPTIMIZE: Can be optimized by conditionally rendering the divs based on the db_precomputed_database value
              instead of loading all the divs and hiding them based on the value */}
              <div className="service-card-row">
                <div className="service-card-row-item">
                  <div className={form.watch("db_precomputed_database") === "selGenome" ? "service-card-content-grid-item" : "hidden"}>
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
                                field.onChange(object.path);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className={form.watch("db_precomputed_database") === "selGroup" ? "service-card-content-grid-item" : "hidden"}>
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

                  <div className={form.watch("db_precomputed_database") === "selFeatureGroup" ? "service-card-content-grid-item" : "hidden"}>
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

                  <div className={form.watch("db_precomputed_database") === "selTaxon" ? "service-card-content-grid-item" : "hidden"}>
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
                                field.onChange(object.path);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className={form.watch("db_precomputed_database") === "selFasta" ? "service-card-content-grid-item" : "hidden"}>
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
                              types={["feature_protein_fasta", "feature_dna_fasta"]}
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
                          <OutputFolder required={true} onChange={field.onChange} />
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
                          <OutputFolder variant="name" required={true} value={field.value} onChange={field.onChange} />
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
                          <FormLabel htmlFor="blast_max_hits" className="service-card-label">
                            Max Hits
                          </FormLabel>
                          <FormControl>
                            <Select
                              value={field.value.toString()}
                              onValueChange={(value) => field.onChange(parseInt(value, 10))}
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
                          <FormLabel htmlFor="blast_evalue_cutoff" className="service-card-label">
                            E-Value Threshold
                          </FormLabel>
                          <FormControl>
                            <Select
                              value={field.value.toString()}
                              onValueChange={(value) => field.onChange(parseFloat(value))}
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
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              className="service-form-controls-button"
            >
              Reset
            </Button>
            <Button type="submit" onClick={() => handleFormSubmit(form.getValues() as any)}>Submit</Button>
          </div>
        </form>
      </Form>
    </section>
  );
}
