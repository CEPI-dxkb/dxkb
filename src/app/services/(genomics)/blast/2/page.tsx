"use client";

import { z } from "zod"
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import SearchWorkspaceInput from "@/components/services/search-workspace-input";
import { Checkbox } from "@/components/ui/checkbox";
import OutputFolder from "@/components/services/output-folder";
import { RequiredFormLabel, RequiredFormLabelInfo, RequiredFormCardTitle } from "@/components/forms/required-form-components";


const baseFormSchema = z.object({
  input_type: z.enum(["aa", "dna"]),
  // input_source: z.enum(["fasta_data", "fasta_file", "feature_group"]),
  db_type: z.enum(["fna", "ffn", "faa", "frn"]),
  db_source: z.enum(["precomputed_database", "genome_list", "genome_group", "feature_group", "taxon_list", "fasta_file"]),
  blast_program: z.enum(["blastn", "blastp", "blastx", "tblastn"]),
  output_file: z.string(),
  output_path: z.string(),
  blast_max_hits: z.number().refine((val) => [1, 10, 20, 50, 100, 500, 5000].includes(val), {
    message: "blast_max_hits must be one of: 1, 10, 20, 50, 100, 500, 5000"
  }),
  blast_evalue_cutoff: z.number().refine((val) => [0.0001, 0.001, 0.01, 0.1, 1, 10, 100, 1000, 10000].includes(val), {
    message: "blast_evalue_cutoff must be one of: 0.0001, 0.001, 0.01, 0.1, 1, 10, 100, 1000, 10000"
  }),
  db_precomputed_database: z.enum(["bacteria-archaea", "viral-reference", "selGenome", "selGroup", "selFeatureGroup", "selTaxon", "selFasta"]),
});

const formSchema = z.discriminatedUnion("input_source", [
  baseFormSchema.extend({
    input_source: z.literal("fasta_data"),
    input_fasta_data: z.string(),
  }),
  baseFormSchema.extend({
    input_source: z.literal("fasta_file"),
    input_fasta_file: z.string(),
  }),
  baseFormSchema.extend({
    input_source: z.literal("feature_group"),
    input_feature_group: z.string(),
  }),
]);

export default function BlastServicePage() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      input_type: "aa",
      input_source: "fasta_data",
      input_fasta_data: "",
      db_type: "fna",
      db_source: "precomputed_database",
      blast_program: "blastn",
      output_file: "",
      output_path: "",
      blast_max_hits: 10,
      blast_evalue_cutoff: 0.0001,
      db_precomputed_database: "bacteria-archaea",
    },
  });

  const [searchProgram, setSearchProgram] = useState("blastn");
  const [inputSourceType, setInputSourceType] = useState("enterSequence");
  const [sequenceInput, setSequenceInput] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [_maxHits, setMaxHits] = useState("10");
  const [_eValueThreshold, setEValueThreshold] = useState("0.0001");
  const [_outputFolder, setOutputFolder] = useState("");
  const [_outputName, setOutputName] = useState("");

  // Log form value changes
  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
      console.log("Form changed:", { name, type, value });
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Log local state changes
  useEffect(() => {
    console.log("inputSourceType changed:", inputSourceType);
  }, [inputSourceType]);
  useEffect(() => {
    console.log("sequenceInput changed:", sequenceInput);
  }, [sequenceInput]);
  useEffect(() => {
    console.log("searchProgram changed:", searchProgram);
  }, [searchProgram]);
  useEffect(() => {
    console.log("showAdvanced changed:", showAdvanced);
  }, [showAdvanced]);
  useEffect(() => {
    console.log("maxHits changed:", _maxHits);
  }, [_maxHits]);
  useEffect(() => {
    console.log("eValueThreshold changed:", _eValueThreshold);
  }, [_eValueThreshold]);
  useEffect(() => {
    console.log("outputFolder changed:", _outputFolder);
  }, [_outputFolder]);
  useEffect(() => {
    console.log("outputName changed:", _outputName);
  }, [_outputName]);

  const handleReset = () => {
    setSearchProgram("");
    setInputSourceType("enterSequence");
    setSequenceInput("");
    setShowAdvanced(false);
    setMaxHits("10");
    setEValueThreshold("0.0001");
    setOutputFolder("");
    setOutputName("");
  };

  const handleInputSourceChange = (newSource: string) => {
    // Get current form values
    const currentValues = form.getValues();

    // Create new values object without any input fields
    const baseValues = {
      input_type: currentValues.input_type,
      input_source: newSource,
      db_type: currentValues.db_type,
      db_source: currentValues.db_source,
      blast_program: currentValues.blast_program,
      output_file: currentValues.output_file,
      output_path: currentValues.output_path,
      blast_max_hits: currentValues.blast_max_hits,
      blast_evalue_cutoff: currentValues.blast_evalue_cutoff,
      db_precomputed_database: currentValues.db_precomputed_database,
    };

    // Add the appropriate input field based on the new source
    const newValues = {
      ...baseValues,
      ...(newSource === 'fasta_data' && { input_fasta_data: '' }),
      ...(newSource === 'fasta_file' && { input_fasta_file: '' }),
      ...(newSource === 'feature_group' && { input_feature_group: '' }),
    };

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
                          <FormLabel htmlFor="blastn" className="service-radio-group-label">
                            BLASTN (nucleotide → nucleotide database)
                          </FormLabel>
                        </div>
                        <div className="service-radio-group-item">
                          <RadioGroupItem value="blastp" id="blastp" />
                          <FormLabel htmlFor="blastp" className="service-radio-group-label">
                            BLASTP (protein → protein database)
                          </FormLabel>
                        </div>
                        <div className="service-radio-group-item">
                          <RadioGroupItem value="blastx" id="blastx" />
                          <FormLabel htmlFor="blastx" className="service-radio-group-label">
                            BLASTX (translated nucleotide → protein database)
                          </FormLabel>
                        </div>
                        <div className="service-radio-group-item">
                          <RadioGroupItem value="tblastn" id="tblastn" />
                          <FormLabel htmlFor="tblastn" className="service-radio-group-label">
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
                            <RadioGroupItem value="fasta_data" id="fastaSequence" />
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
                            <RadioGroupItem value="feature_group" id="featureGroup" />
                            <FormLabel htmlFor="featureGroup">
                              Select feature group
                            </FormLabel>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>


                    {field.value === "fasta_data" && (
                      <FormField
                        control={form.control}
                        name="input_fasta_data"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <div className="service-card-content-grid-item">
                                <RequiredFormLabel
                                  className="service-card-label"
                                >
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
                    )}

                    {field.value === "fasta_file" && (
                      <FormField
                        control={form.control}
                        name="input_fasta_file"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <div className="service-card-content-grid-item">
                                <SearchWorkspaceInput
                                  title="Upload a FASTA file"
                                  placeholder="FASTA file..."
                                  value={field.value}
                                  onChange={field.onChange}
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {field.value === "feature_group" && (
                      <FormField
                        control={form.control}
                        name="input_feature_group"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <div className="service-card-content-grid-item">
                                <SearchWorkspaceInput
                                  title="Select a feature group"
                                  placeholder="Feature group..."
                                  value={field.value}
                                  onChange={field.onChange}
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                )}
              />
            </CardContent>
          </Card>

          {/* Output Settings Card */}
          <Card>
            <CardHeader className="service-card-header">
              <CardTitle className="service-card-title">
                Parameters
              </CardTitle>
            </CardHeader>

            <CardContent className="service-card-content">
              {/* TODO: Add the workspace folder selector here */}

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
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger className="service-card-select-trigger">
                              <SelectValue placeholder="Select database source" />
                            </SelectTrigger>
                            {/* TODO: Conditionally render based on input source type */}
                            <SelectContent className="service-card-select-content" onChange={field.onChange}>
                              <SelectItem value="bacteria-archaea">
                                Reference and representative genomes (bacteria, archaea)
                              </SelectItem>
                              <SelectItem value="viral-reference">
                                Reference and representative genomes (viruses)
                              </SelectItem>
                              <SelectItem value="selGenome">
                                Search within selected genome list
                              </SelectItem>
                              <SelectItem value="selGroup">
                                Search within selected genome group
                              </SelectItem>
                              <SelectItem value="selFeatureGroup">
                                Search within selected feature group
                              </SelectItem>
                              <SelectItem value="selTaxon">
                                Search within a taxon
                              </SelectItem>
                              <SelectItem value="selFasta">
                                Search within selected FASTA file
                              </SelectItem>
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
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger className="service-card-select-trigger">
                              <SelectValue placeholder="Select database type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fna">
                                Genome sequences (NT)
                              </SelectItem>
                              <SelectItem value="ffn">Genes (NT)</SelectItem>
                              <SelectItem value="frn">RNAs (NT)</SelectItem>
                              <SelectItem value="faa">Proteins (AA)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />


              </div>

              <OutputFolder onChange={setOutputFolder} />

              <OutputFolder variant="name" onChange={setOutputName} />

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
                    <div className="service-card-content-grid-item">
                      <Label htmlFor="max-hits" className="service-card-label">
                        Max Hits
                      </Label>

                      <Select>
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
                          <SelectItem value="1000">1000</SelectItem>
                          <SelectItem value="5000">5000</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="service-card-content-grid-item">
                      <Label htmlFor="e-value" className="service-card-label">
                        E-Value Threshold
                      </Label>

                      <Select defaultValue="10">
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
                    </div>
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
            <Button type="submit">Submit</Button>
          </div>
        </form>
      </Form>
    </section >
  );
}

