"use client";

import { useState, useEffect } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Search } from "lucide-react";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import {
  similarGenomeFinderAdvancedParameters,
  similarGenomeFinderInfo,
  similarGenomeFinderSelectGenome,
} from "@/lib/services/service-info";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import { WorkspaceObject } from "@/lib/workspace-client";
import { SingleGenomeSelector } from "@/components/services/single-genome-selector";
import { JobParamsDialog } from "@/components/services/job-params-dialog";
import { useServiceFormSubmission } from "@/hooks/services/use-service-form-submission";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { submitServiceJob } from "@/lib/services/service-utils";
import {
  similarGenomeFinderFormSchema,
  DEFAULT_SIMILAR_GENOME_FINDER_FORM_VALUES,
  type SimilarGenomeFinderFormData,
} from "@/lib/forms/(genomics)";
import { transformSimilarGenomeFinderParams } from "@/lib/forms/(genomics)/similar-genome-finder/similar-genome-finder-form-utils";

export default function SimilarGenomeFinderServicePage() {
  const form = useForm<SimilarGenomeFinderFormData>({
    resolver: zodResolver(similarGenomeFinderFormSchema),
    defaultValues: DEFAULT_SIMILAR_GENOME_FINDER_FORM_VALUES,
    mode: "onChange",
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Watch both fields to trigger cross-validation when either changes
  const fastaFile = form.watch("fasta_file");
  const selectedGenomeId = form.watch("selectedGenomeId");
  
  useEffect(() => {
    // When fasta_file changes, trigger validation of selectedGenomeId
    // This ensures the error clears if fasta_file has a value
    if (fastaFile?.trim()) {
      form.trigger("selectedGenomeId");
    }
  }, [fastaFile, form]);

  useEffect(() => {
    // When selectedGenomeId changes, trigger validation to ensure error state is correct
    if (selectedGenomeId?.trim()) {
      form.trigger("selectedGenomeId");
    }
  }, [selectedGenomeId, form]);

  // Setup service debugging and form submission
  const {
    handleSubmit,
    showParamsDialog,
    setShowParamsDialog,
    currentParams,
    serviceName,
  } = useServiceFormSubmission<SimilarGenomeFinderFormData>({
    serviceName: "Similar Genome Finder",
    transformParams: transformSimilarGenomeFinderParams,
    onSubmit: async (data) => {
      try {
        setIsSubmitting(true);
        // Submit the Similar Genome Finder job using the utility function
        const result = await submitServiceJob(
          "SimilarGenomeFinder",
          transformSimilarGenomeFinderParams(data),
        );

        if (result.success) {
          console.log("Similar Genome Finder job submitted successfully:", result.job[0]);

          // Show success message
          toast.success("Similar Genome Finder job submitted successfully!", {
            description: `Job ID: ${result.job[0].id}`,
          });
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        console.error("Failed to submit Similar Genome Finder job:", error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to submit Similar Genome Finder job";
        toast.error("Submission failed", {
          description: errorMessage,
        });
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  const handleReset = () => {
    form.reset(DEFAULT_SIMILAR_GENOME_FINDER_FORM_VALUES);
    setShowAdvanced(false);
  };

  return (
    <section>
      <ServiceHeader
        title="Similar Genome Finder"
        description="The Similar Genome Finder Service will find similar public genomes in BV-BRC or compute genome distance estimation using Mash/MinHash. It returns a set of genomes matching the specified similarity criteria."
        infoPopupTitle={similarGenomeFinderInfo.title}
        infoPopupDescription={similarGenomeFinderInfo.description}
        quickReferenceGuide="#"
        tutorial="#"
        instructionalVideo="#"
      />

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="service-form-section"
        >
          {/* Select a Genome Section */}
          <Card>
            <CardHeader className="service-card-header">
              <div className="flex items-center">
                <CardTitle className="service-card-title">
                  Select a Genome
                </CardTitle>
                <DialogInfoPopup
                  title={similarGenomeFinderSelectGenome.title}
                  description={similarGenomeFinderSelectGenome.description}
                  sections={similarGenomeFinderSelectGenome.sections}
                  className="ml-2"
                />
              </div>
            </CardHeader>

            <CardContent className="service-card-content space-y-6">
              <FormField
                control={form.control}
                name="selectedGenomeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="service-card-label">
                      Search by Genome Name or Genome ID
                    </FormLabel>
                    <FormControl>
                      <SingleGenomeSelector
                        placeholder="e.g. Mycobacterium tuberculosis H37Rv"
                        value={field.value ?? ""}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fasta_file"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="service-card-label">
                      Or Upload FASTA/FASTQ
                    </FormLabel>
                    <FormControl>
                      <WorkspaceObjectSelector
                        types={["contigs", "reads"]}
                        placeholder="Select a FASTA/FASTQ file..."
                        onObjectSelect={(object: WorkspaceObject) => {
                          field.onChange(object.path);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Advanced Options */}
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
                  <div className="flex w-full flex-col justify-between space-y-4">
                    <div className="flex items-center">
                      <Label className="service-card-label">Parameters</Label>
                      <DialogInfoPopup
                        title={similarGenomeFinderAdvancedParameters.title}
                        description={
                          similarGenomeFinderAdvancedParameters.description
                        }
                        sections={similarGenomeFinderAdvancedParameters.sections}
                        className="mb-2 ml-2"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <FormField
                        control={form.control}
                        name="max_hits"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="service-card-sublabel">
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
                                  <SelectItem value="50">50</SelectItem>
                                  <SelectItem value="100">100</SelectItem>
                                  <SelectItem value="500">500</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="max_pvalue"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="service-card-sublabel">
                              P-Value Threshold
                            </FormLabel>
                            <FormControl>
                              <Select
                                value={field.value?.toString() ?? "1"}
                                onValueChange={(value) =>
                                  field.onChange(parseFloat(value))
                                }
                              >
                                <SelectTrigger className="service-card-select-trigger">
                                  <SelectValue placeholder="Select P-value" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="0.001">0.001</SelectItem>
                                  <SelectItem value="0.01">0.01</SelectItem>
                                  <SelectItem value="0.1">0.1</SelectItem>
                                  <SelectItem value="1">1</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="max_distance"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="service-card-sublabel">
                              Distance
                            </FormLabel>
                            <FormControl>
                              <Select
                                value={field.value?.toString() ?? "1"}
                                onValueChange={(value) =>
                                  field.onChange(parseFloat(value))
                                }
                              >
                                <SelectTrigger className="service-card-select-trigger">
                                  <SelectValue placeholder="Select distance" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="0.01">0.01</SelectItem>
                                  <SelectItem value="0.05">0.05</SelectItem>
                                  <SelectItem value="0.1">0.1</SelectItem>
                                  <SelectItem value="0.5">0.5</SelectItem>
                                  <SelectItem value="1">1</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="flex flex-col gap-2">
                          <Label className="service-card-label">
                            Organism Type
                          </Label>

                          <FormField
                            control={form.control}
                            name="include_bacterial"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                                <FormLabel className="text-sm font-normal">
                                  Bacterial and Archaeal Genomes
                                </FormLabel>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="include_viral"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                                <FormLabel className="text-sm font-normal">
                                  Viral Genomes
                                </FormLabel>
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="flex flex-col gap-2">
                          <Label className="service-card-label">Scope</Label>

                          <FormField
                            control={form.control}
                            name="scope"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <RadioGroup
                                    value={field.value}
                                    onValueChange={field.onChange}
                                    className="gap-2"
                                  >
                                    <div className="flex items-center space-x-2">
                                      <RadioGroupItem value="reference" id="reference" />
                                      <FormLabel
                                        htmlFor="reference"
                                        className="text-sm font-normal"
                                      >
                                        Reference and Representative Genomes
                                      </FormLabel>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <RadioGroupItem value="all" id="all" />
                                      <FormLabel
                                        htmlFor="all"
                                        className="text-sm font-normal"
                                      >
                                        All Public Genomes
                                      </FormLabel>
                                    </div>
                                  </RadioGroup>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>

          {/* Form Controls */}
          <div className="service-form-controls">
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
              disabled={isSubmitting || !form.formState.isValid}
            >
              {isSubmitting ? <Spinner className="mr-2 h-4 w-4" /> : null}
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
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
