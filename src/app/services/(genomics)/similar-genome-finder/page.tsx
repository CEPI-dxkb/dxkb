"use client";

import { useState } from "react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
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
import { ServiceHeader } from "@/components/services/service-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/containers/DataTable";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import type { WorkspaceObject } from "@/lib/workspace-client";
import { SingleGenomeSelector } from "@/components/services/single-genome-selector";
import { JobParamsDialog } from "@/components/services/job-params-dialog";
import { Spinner } from "@/components/ui/spinner";

import { toast } from "sonner";
import { useServiceFormSubmission } from "@/hooks/services/use-service-form-submission";
import {
  similarGenomeFinderInfo,
  similarGenomeFinderSelectGenome,
  similarGenomeFinderAdvancedParameters,
} from "@/lib/services/service-info";
import {
  similarGenomeFinderFormSchema,
  DEFAULT_SIMILAR_GENOME_FINDER_FORM_VALUES,
  maxHitsOptions,
  pValueOptions,
  distanceOptions,
  type SimilarGenomeFinderFormData,
} from "@/lib/forms/(genomics)/similar-genome-finder/similar-genome-finder-form-schema";
import { buildMinhashServicePayload } from "@/lib/forms/(genomics)/similar-genome-finder/similar-genome-finder-form-utils";
import type { SimilarGenomeFinderResultRow } from "@/lib/forms/(genomics)/similar-genome-finder/similar-genome-finder-result-utils";
import { submitSimilarGenomes } from "./actions";

const similarGenomeFinderTableColumns = [
  { id: "genome_id", label: "Genome ID" },
  { id: "genome_name", label: "Genome Name" },
  { id: "organism_name", label: "Organism" },
  { id: "genome_status", label: "Genome Status" },
  { id: "genome_quality", label: "Genome Quality" },
  { id: "distance", label: "Distance" },
  { id: "pvalue", label: "P Value" },
  { id: "counts", label: "K-mer Counts" },
] as const;

const quickReference =
  "https://www.bv-brc.org/docs/quick_references/services/similar_genome_finder_service.html";
const tutorial =
  "https://www.bv-brc.org/docs/tutorial/similar_genome_finder/similar_genome_finder.html";
const video =
  "https://youtube.com/playlist?list=PLWfOyhOW_OashHfld0w1DUkO7rQz6s8SA&si=Enh6GME_i4LMcXL8";

/** Re-export for consumers that import from the page */
export type { SimilarGenomeFinderResultRow } from "@/lib/forms/(genomics)/similar-genome-finder/similar-genome-finder-result-utils";

export default function SimilarGenomeFinderServicePage() {
  const form = useForm<SimilarGenomeFinderFormData>({
    resolver: zodResolver(similarGenomeFinderFormSchema),
    defaultValues: DEFAULT_SIMILAR_GENOME_FINDER_FORM_VALUES,
    mode: "onChange",
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [results, setResults] = useState<SimilarGenomeFinderResultRow[]>([]);

  const onSuccess = () => {
    form.reset(DEFAULT_SIMILAR_GENOME_FINDER_FORM_VALUES);
    setShowAdvanced(false);
    setResults([]);
  };

  const {
    handleSubmit,
    showParamsDialog,
    setShowParamsDialog,
    currentParams,
    serviceName,
    isSubmitting,
  } = useServiceFormSubmission<SimilarGenomeFinderFormData>({
    serviceName: "SimilarGenomeFinder",
    displayName: "Similar Genome Finder",
    transformParams: (data) =>
      buildMinhashServicePayload(data) as unknown as Record<string, unknown>,
    onSuccess,
    onSubmit: async (data) => {
      const response = await submitSimilarGenomes(data);
      if (response.success) {
        setResults(response.rows);
        toast.success("Similar Genome Finder completed successfully!", {
          description:
            response.rows.length > 0
              ? `Results returned from Minhash service (${response.rows.length} genome${response.rows.length === 1 ? "" : "s"})`
              : "Results returned from Minhash service",
          closeButton: true,
        });
      } else {
        toast.error("Submission failed", {
          description: response.error,
          closeButton: true,
        });
        throw new Error(response.error);
      }
    },
  });

  const handleReset = () => {
    form.reset(DEFAULT_SIMILAR_GENOME_FINDER_FORM_VALUES);
    setShowAdvanced(false);
    setResults([]);
  };

  return (
    <section>
      <ServiceHeader
        title="Similar Genome Finder"
        description="The Similar Genome Finder Service will find similar public genomes in BV-BRC or compute genome distance estimation using Mash/MinHash. It returns a set of genomes matching the specified similarity criteria."
        infoPopupTitle={similarGenomeFinderInfo.title}
        infoPopupDescription={similarGenomeFinderInfo.description}
        quickReferenceGuide={quickReference}
        tutorial={tutorial}
        instructionalVideo={video}
      />

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="grid grid-cols-1 gap-6 md:grid-cols-12"
        >
          {/* Select a Genome */}
          <div className="md:col-span-12">
            <Card>
              <CardHeader className="service-card-header">
                <RequiredFormCardTitle className="service-card-title">
                  Select a Genome
                  <DialogInfoPopup
                    title={similarGenomeFinderSelectGenome.title}
                    description={similarGenomeFinderSelectGenome.description}
                    sections={similarGenomeFinderSelectGenome.sections}
                  />
                </RequiredFormCardTitle>
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
                          onChange={(value) => {
                            field.onChange(value);
                            if (value?.trim()) {
                              form.setValue("fasta_file", "", {
                                shouldValidate: true,
                              });
                            }
                          }}
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
                          value={field.value ?? ""}
                          onObjectSelect={(object: WorkspaceObject) => {
                            field.onChange(object.path);
                            form.setValue("selectedGenomeId", "", {
                              shouldValidate: true,
                            });
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
                          sections={
                            similarGenomeFinderAdvancedParameters.sections
                          }
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
                                  items={maxHitsOptions}
                                  value={(field.value ?? 10).toString()}
                                  onValueChange={(value) =>
                                    value != null &&
                                    field.onChange(parseInt(value, 10))
                                  }
                                >
                                  <SelectTrigger className="service-card-select-trigger">
                                    <SelectValue placeholder="Select max hits" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectGroup>
                                      {maxHitsOptions.map((o) => (
                                        <SelectItem
                                          key={o.value}
                                          value={String(o.value)}
                                        >
                                          {o.label}
                                        </SelectItem>
                                      ))}
                                    </SelectGroup>
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
                                  items={pValueOptions}
                                  value={field.value?.toString() ?? "1"}
                                  onValueChange={(value) =>
                                    value != null &&
                                    field.onChange(parseFloat(value))
                                  }
                                >
                                  <SelectTrigger className="service-card-select-trigger">
                                    <SelectValue placeholder="Select P-value" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectGroup>
                                      {pValueOptions.map((o) => (
                                        <SelectItem
                                          key={o.value}
                                          value={String(o.value)}
                                        >
                                          {o.label}
                                        </SelectItem>
                                      ))}
                                    </SelectGroup>
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
                                  items={distanceOptions}
                                  value={field.value?.toString() ?? "1"}
                                  onValueChange={(value) =>
                                    value != null &&
                                    field.onChange(parseFloat(value))
                                  }
                                >
                                  <SelectTrigger className="service-card-select-trigger">
                                    <SelectValue placeholder="Select distance" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectGroup>
                                      {distanceOptions.map((o) => (
                                        <SelectItem
                                          key={o.value}
                                          value={String(o.value)}
                                        >
                                          {o.label}
                                        </SelectItem>
                                      ))}
                                    </SelectGroup>
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
                                <FormItem className="flex flex-row items-center space-y-0 space-x-2">
                                  <FormControl>
                                    <Checkbox
                                      id="include_bacterial"
                                      name="include_bacterial"
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
                                <FormItem className="flex flex-row items-center space-y-0 space-x-2">
                                  <FormControl>
                                    <Checkbox
                                      id="include_viral"
                                      name="include_viral"
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
                                      className="grid w-full gap-2"
                                    >
                                      <div className="flex items-center gap-3">
                                        <RadioGroupItem
                                          value="reference"
                                          id="reference"
                                        />
                                        <FormLabel
                                          htmlFor="reference"
                                          className="text-sm font-normal"
                                        >
                                          Reference and Representative Genomes
                                        </FormLabel>
                                      </div>
                                      <div className="flex items-center gap-3">
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

            {/* Form controls */}
            <div className="md:col-span-12">
              <div className="service-form-controls">
                <Button type="button" variant="outline" onClick={handleReset}>
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
            </div>
          </div>
        </form>
      </Form>

      {/* Results (DataTable) */}
      <div className="mt-8">
        <Card>
          <CardHeader className="service-card-header">
            <CardTitle className="service-card-title">Results</CardTitle>
          </CardHeader>
          <CardContent className="service-card-content">
            <DataTable
              id="similar-genome-finder-results"
              data={results as unknown as Record<string, unknown>[]}
              columns={[...similarGenomeFinderTableColumns]}
              totalItems={results.length}
              resource="similar-genome-finder-results"
              isLoading={isSubmitting}
            />
          </CardContent>
        </Card>
      </div>

      <JobParamsDialog
        open={showParamsDialog}
        onOpenChange={setShowParamsDialog}
        params={currentParams}
        serviceName={serviceName}
      />
    </section>
  );
}
