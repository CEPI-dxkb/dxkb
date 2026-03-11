"use client";

import { useState, useEffect } from "react";
import { useForm, useStore } from "@tanstack/react-form";
import { FieldItem, FieldLabel, FieldErrors } from "@/components/ui/tanstack-form";
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
import { useRerunForm } from "@/hooks/services/use-rerun-form";
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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [results, setResults] = useState<SimilarGenomeFinderResultRow[]>([]);

  const {
    handleSubmit,
    showParamsDialog,
    setShowParamsDialog,
    currentParams,
    serviceName,
    isDebugMode,
    isSubmitting: isJobSubmitting,
  } = useServiceFormSubmission<SimilarGenomeFinderFormData>({
    serviceName: "SimilarGenomeFinder",
    displayName: "Similar Genome Finder",
    transformParams: (data) =>
      buildMinhashServicePayload(data) as unknown as Record<string, unknown>,
  });

  const [isCustomSubmitting, setIsCustomSubmitting] = useState(false);
  const isSubmitting = isJobSubmitting || isCustomSubmitting;

  const form = useForm({
    defaultValues: DEFAULT_SIMILAR_GENOME_FINDER_FORM_VALUES as SimilarGenomeFinderFormData,
    validators: { onChange: similarGenomeFinderFormSchema },
    onSubmit: async ({ value }) => {
      const data = value as SimilarGenomeFinderFormData;

      // In debug mode, use the hook to show the params dialog
      if (isDebugMode) {
        await handleSubmit(data);
        return;
      }

      // Custom submission — calls server action instead of submitServiceJob
      setIsCustomSubmitting(true);
      try {
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
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to submit";
        toast.error("Submission failed", {
          description: errorMessage,
          closeButton: true,
        });
      } finally {
        setIsCustomSubmitting(false);
      }
    },
  });

  const canSubmit = useStore(form.store, (s) => s.canSubmit);

  const { rerunData, markApplied } = useRerunForm<Record<string, unknown>>();

  useEffect(() => {
    if (!rerunData || !markApplied()) return;

    const d = rerunData;

    if (typeof d.selectedGenomeId === "string") form.setFieldValue("selectedGenomeId", d.selectedGenomeId);
    if (typeof d.fasta_file === "string") form.setFieldValue("fasta_file", d.fasta_file);
    if (typeof d.output_path === "string") form.setFieldValue("output_path", d.output_path);
    if (typeof d.output_file === "string") form.setFieldValue("output_file", d.output_file);
    if (typeof d.max_hits === "number") form.setFieldValue("max_hits", d.max_hits);
    if (typeof d.max_pvalue === "number") form.setFieldValue("max_pvalue", d.max_pvalue);
    if (typeof d.max_distance === "number") form.setFieldValue("max_distance", d.max_distance);
    if (typeof d.include_bacterial === "boolean") form.setFieldValue("include_bacterial", d.include_bacterial);
    if (typeof d.include_viral === "boolean") form.setFieldValue("include_viral", d.include_viral);
    if (d.scope === "reference" || d.scope === "all") form.setFieldValue("scope", d.scope);
  }, [rerunData, markApplied, form]);

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

      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
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
              <form.Field name="selectedGenomeId">
                {(field) => (
                  <FieldItem>
                    <FieldLabel field={field} className="service-card-label">
                      Search by Genome Name or Genome ID
                    </FieldLabel>
                    <SingleGenomeSelector
                      placeholder="e.g. Mycobacterium tuberculosis H37Rv"
                      value={field.state.value ?? ""}
                      onChange={(value) => {
                        field.handleChange(value);
                        if (value?.trim()) {
                          form.setFieldValue("fasta_file", "");
                        }
                      }}
                    />
                    <FieldErrors field={field} />
                  </FieldItem>
                )}
              </form.Field>

              <form.Field name="fasta_file">
                {(field) => (
                  <FieldItem>
                    <FieldLabel field={field} className="service-card-label">
                      Or Upload FASTA/FASTQ
                    </FieldLabel>
                    <WorkspaceObjectSelector
                      types={["contigs", "reads"]}
                      placeholder="Select a FASTA/FASTQ file..."
                      value={field.state.value ?? ""}
                      onObjectSelect={(object: WorkspaceObject) => {
                        field.handleChange(object.path);
                        form.setFieldValue("selectedGenomeId", "");
                      }}
                    />
                    <FieldErrors field={field} />
                  </FieldItem>
                )}
              </form.Field>

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
                      <form.Field name="max_hits">
                        {(field) => (
                          <FieldItem>
                            <FieldLabel field={field} className="service-card-sublabel">
                              Max Hits
                            </FieldLabel>
                            <Select
                              items={maxHitsOptions}
                              value={(field.state.value ?? 10).toString()}
                              onValueChange={(value) =>
                                value != null &&
                                field.handleChange(parseInt(value, 10))
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
                            <FieldErrors field={field} />
                          </FieldItem>
                        )}
                      </form.Field>

                      <form.Field name="max_pvalue">
                        {(field) => (
                          <FieldItem>
                            <FieldLabel field={field} className="service-card-sublabel">
                              P-Value Threshold
                            </FieldLabel>
                            <Select
                              items={pValueOptions}
                              value={field.state.value?.toString() ?? "1"}
                              onValueChange={(value) =>
                                value != null &&
                                field.handleChange(parseFloat(value))
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
                            <FieldErrors field={field} />
                          </FieldItem>
                        )}
                      </form.Field>

                      <form.Field name="max_distance">
                        {(field) => (
                          <FieldItem>
                            <FieldLabel field={field} className="service-card-sublabel">
                              Distance
                            </FieldLabel>
                            <Select
                              items={distanceOptions}
                              value={field.state.value?.toString() ?? "1"}
                              onValueChange={(value) =>
                                value != null &&
                                field.handleChange(parseFloat(value))
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
                            <FieldErrors field={field} />
                          </FieldItem>
                        )}
                      </form.Field>
                    </div>

                    <div className="space-y-2">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="flex flex-col gap-2">
                          <Label className="service-card-label">
                            Organism Type
                          </Label>

                          <form.Field name="include_bacterial">
                            {(field) => (
                              <FieldItem className="flex flex-row items-center space-y-0 space-x-2">
                                <Checkbox
                                  id="include_bacterial"
                                  name="include_bacterial"
                                  checked={field.state.value}
                                  onCheckedChange={(checked) => field.handleChange(checked)}
                                />
                                <Label htmlFor="include_bacterial" className="text-sm font-normal">
                                  Bacterial and Archaeal Genomes
                                </Label>
                                <FieldErrors field={field} />
                              </FieldItem>
                            )}
                          </form.Field>

                          <form.Field name="include_viral">
                            {(field) => (
                              <FieldItem className="flex flex-row items-center space-y-0 space-x-2">
                                <Checkbox
                                  id="include_viral"
                                  name="include_viral"
                                  checked={field.state.value}
                                  onCheckedChange={(checked) => field.handleChange(checked)}
                                />
                                <Label htmlFor="include_viral" className="text-sm font-normal">
                                  Viral Genomes
                                </Label>
                                <FieldErrors field={field} />
                              </FieldItem>
                            )}
                          </form.Field>
                        </div>

                        <div className="flex flex-col gap-2">
                          <Label className="service-card-label">Scope</Label>

                          <form.Field name="scope">
                            {(field) => (
                              <FieldItem>
                                <RadioGroup
                                  value={field.state.value}
                                  onValueChange={(value) => field.handleChange(value)}
                                  className="grid w-full gap-2"
                                >
                                  <div className="flex items-center gap-3">
                                    <RadioGroupItem
                                      value="reference"
                                      id="reference"
                                    />
                                    <Label
                                      htmlFor="reference"
                                      className="text-sm font-normal"
                                    >
                                      Reference and Representative Genomes
                                    </Label>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <RadioGroupItem value="all" id="all" />
                                    <Label
                                      htmlFor="all"
                                      className="text-sm font-normal"
                                    >
                                      All Public Genomes
                                    </Label>
                                  </div>
                                </RadioGroup>
                                <FieldErrors field={field} />
                              </FieldItem>
                            )}
                          </form.Field>
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
                disabled={isSubmitting || !canSubmit}
              >
                {isSubmitting ? <Spinner className="mr-2 h-4 w-4" /> : null}
                <Search className="mr-2 h-4 w-4" />
                Search
              </Button>
            </div>
          </div>
        </div>
      </form>

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
