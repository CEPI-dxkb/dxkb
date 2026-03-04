"use client";

import { useEffect, useRef, useState } from "react";
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HelpCircle } from "lucide-react";
import {
  genomeAnnotationInfo,
  genomeAnnotationParameters,
} from "@/lib/services/service-info";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import OutputFolder from "@/components/services/output-folder";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import { WorkspaceObject } from "@/lib/workspace-client";
import { JobParamsDialog } from "@/components/services/job-params-dialog";
import { useServiceFormSubmission } from "@/hooks/services/use-service-form-submission";
import { toast } from "sonner";
import {
  completeGenomeAnnotationSchema,
  DEFAULT_GENOME_ANNOTATION_FORM_VALUES,
  type GenomeAnnotationFormData,
  transformGenomeAnnotationParams,
  generateOutputFileName,
  validateMyLabel,
  genomeAnnotationRecipes,
} from "@/lib/forms/(genomics)";
import { submitServiceJob } from "@/lib/services/service-utils";
import {
  RequiredFormLabel,
} from "@/components/forms/required-form-components";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TaxIDSelector } from "@/components/taxonomy/tax-id-selector";
import { TaxonNameSelector } from "@/components/taxonomy/taxon-name-selector";
import { Spinner } from "@/components/ui/spinner";

const GenomeAnnotationContent = () => {
  const form = useForm<GenomeAnnotationFormData>({
    resolver: zodResolver(completeGenomeAnnotationSchema),
    defaultValues: DEFAULT_GENOME_ANNOTATION_FORM_VALUES,
    mode: "onChange",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOutputNameValid, setIsOutputNameValid] = useState(true);

  // Setup service debugging and form submission
  const {
    handleSubmit,
    showParamsDialog,
    setShowParamsDialog,
    currentParams,
    serviceName,
  } = useServiceFormSubmission<GenomeAnnotationFormData>({
    serviceName: "Genome Annotation",
    transformParams: transformGenomeAnnotationParams,
    onSubmit: async (data) => {
      // Validate my label for slashes
      console.log("Submitting Genome Annotation job with data:", data);
      const labelValidation = validateMyLabel(data.my_label);
      if (!labelValidation.isValid) {
        toast.error(labelValidation.message);
        return;
      }

      try {
        setIsSubmitting(true);
        // Submit the Genome Annotation job using the utility function
        const result = await submitServiceJob(
          "GenomeAnnotation",
          transformGenomeAnnotationParams(data),
        );

        if (result.success && result.job?.[0]) {
          console.log("Genome Annotation job submitted successfully:", result.job[0]);

          // Show success message
          toast.success("Genome Annotation job submitted successfully!", {
            description: `Job ID: ${result.job[0].id}`,
          });

          // Optionally redirect to jobs page
          // router.push(`/jobs/${result.job.id}`);
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        console.error("Failed to submit Genome Annotation job:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Failed to submit Genome Annotation job";
        toast.error("Submission failed", {
          description: errorMessage,
        });
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  // Watch all form values for changes
  const watchedValues = form.watch();
  const previousValuesRef = useRef<GenomeAnnotationFormData>(watchedValues);

  // Log form changes to console
  useEffect(() => {
    const previousValues = previousValuesRef.current;
    const currentValues = watchedValues;

    // Compare each field and log changes
    Object.keys(currentValues).forEach((key) => {
      const fieldKey = key as keyof GenomeAnnotationFormData;
      const prevValue = previousValues[fieldKey];
      const currValue = currentValues[fieldKey];

      if (JSON.stringify(prevValue) !== JSON.stringify(currValue)) {
        console.log(`Form field changed: ${fieldKey}`, {
          previous: prevValue,
          current: currValue,
        });
      }
    });

    // Update ref with current values
    previousValuesRef.current = currentValues;
  }, [watchedValues]);

  const handleReset = () => {
    form.reset(DEFAULT_GENOME_ANNOTATION_FORM_VALUES);
  };

  return (
    <section>
      <ServiceHeader
        title="Genome Annotation"
        description="The Genome Annotation Service uses the RAST tool kit, RASTtk, for bacteria and the Viral Genome ORF Reader (VIGOR4) for viruses.
          The service accepts a FASTA formatted contig file and an annotation recipe based on taxonomy to provide an annotated genome, to provide annotation of genomic features."
        infoPopupTitle={genomeAnnotationInfo.title}
        infoPopupDescription={genomeAnnotationInfo.description}
        quickReferenceGuide="#"
        tutorial="#"
        instructionalVideo="#"
      />

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="service-form-section"
        >
          {/* Parameters Card */}
          <Card>
            <CardHeader className="service-card-header">
              <CardTitle className="service-card-title">
                Parameters
                <DialogInfoPopup
                  title={genomeAnnotationParameters.title}
                  description={genomeAnnotationParameters.description}
                  sections={genomeAnnotationParameters.sections}
                />
              </CardTitle>
            </CardHeader>

            <CardContent className="service-card-content">
              <div className="space-y-6">
                {/* Contigs Selection */}
                <FormField
                  control={form.control}
                  name="contigs"
                  render={({ field }) => (
                    <FormItem>
                      <RequiredFormLabel>Contigs</RequiredFormLabel>
                      <FormControl>
                        <WorkspaceObjectSelector
                          types={["contigs"]}
                          placeholder="Select or Upload Contigs to your workspace for Annotation"
                          onObjectSelect={(object: WorkspaceObject) => {
                            field.onChange(object.path);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Annotation Recipe */}
                <FormField
                  control={form.control}
                  name="recipe"
                  render={({ field }) => (
                    <FormItem>
                      <RequiredFormLabel>Annotation Recipe</RequiredFormLabel>
                      <FormControl>
                        <Select
                          items={genomeAnnotationRecipes}
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger className="service-card-select-trigger">
                            <SelectValue placeholder="--- Select Recipe ---" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {genomeAnnotationRecipes.map((recipe) => (
                                <SelectItem key={recipe.value} value={recipe.value}>
                                  {recipe.label}
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

                {/* Taxonomy Name and ID */}
                <div className="flex flex-col gap-4 sm:flex-row ">
                  <FormField
                    control={form.control}
                    name="scientific_name"
                    render={({ field }) => (
                      <FormItem className="sm:w-[75%]">
                        <RequiredFormLabel>
                          Taxonomy Name
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <HelpCircle className="service-card-tooltip-icon ml-1" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-sm">
                                <p>
                                  Taxon must be specified at the genus level or below
                                  to get the latest protein family predictions.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </RequiredFormLabel>

                        <FormControl>
                          <TaxonNameSelector
                            value={field.value ? {
                              taxon_id: parseInt(field.value) || 0,
                              taxon_name: field.value,
                            } : null}
                            onChange={(taxonomyItem) => {
                              // Extract the taxon_name string from the TaxonomyItem object
                              const taxonName = taxonomyItem?.taxon_name || null;
                              field.onChange(taxonName);
                              field.onBlur(); // Mark field as touched/validated
                              // Automatically set taxonomy ID when taxonomy name is selected
                              if (taxonomyItem) {
                                const taxonId = String(taxonomyItem.taxon_id);
                                form.setValue("taxonomy_id", taxonId, { shouldValidate: true, shouldTouch: true });
                              } else {
                                // Clear taxonomy ID when name is cleared
                                form.setValue("taxonomy_id", null, { shouldValidate: true, shouldTouch: true });
                              }
                              // Auto-generate output file name
                              const myLabel = form.getValues("my_label");
                              if (taxonName && myLabel) {
                                const outputFileName = generateOutputFileName(taxonName, myLabel);
                                form.setValue("output_file", outputFileName, { shouldValidate: true });
                              }
                              // Trigger validation after a short delay to ensure all fields are updated
                              setTimeout(() => {
                                form.trigger(["scientific_name", "taxonomy_id"]);
                              }, 0);
                            }}
                            placeholder="e.g. Bacillus cereus..."
                            required={true}
                            includeEukaryotes={false}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="taxonomy_id"
                    render={({ field }) => {
                      // Get scientific_name to populate taxon_name in the selector
                      const scientificName = form.getValues("scientific_name");
                      return (
                        <FormItem className="sm:w-[25%]">
                          <FormLabel>Taxonomy ID</FormLabel>
                          <FormControl>
                            <TaxIDSelector
                              value={field.value ? {
                                taxon_id: parseInt(field.value) || 0,
                                taxon_name: scientificName || "",
                              } : null}
                              onChange={(taxonomyItem) => {
                                // Extract the taxon_id string from the TaxonomyItem object
                                const taxonId = taxonomyItem ? String(taxonomyItem.taxon_id) : null;
                                field.onChange(taxonId);
                                field.onBlur(); // Mark field as touched/validated
                              }}
                              placeholder="NCBI Taxonomy ID"
                              required={true}
                              disabled={true}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                </div>

                {/* My Label */}
                <FormField
                  control={form.control}
                  name="my_label"
                  render={({ field }) => (
                    <FormItem>
                      <RequiredFormLabel>My Label</RequiredFormLabel>
                      <FormControl>
                        <Input
                          placeholder="My identifier123"
                          className="service-card-input"
                          value={field.value}
                          onChange={(e) => {
                            // Use field.onChange to properly register with react-hook-form
                            field.onChange(e.target.value);
                            // Auto-generate output file name
                            const scientificName = form.getValues("scientific_name");
                            if (e.target.value && scientificName) {
                              const outputFileName = generateOutputFileName(scientificName, e.target.value);
                              form.setValue("output_file", outputFileName, { shouldValidate: true });
                            }
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Output Folder */}
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

                {/* Output File Name */}
                <FormField
                  control={form.control}
                  name="output_file"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <OutputFolder
                          variant="name"
                          required={false}
                          value={field.value}
                          onChange={field.onChange}
                          disabled={true}
                          outputFolderPath={form.watch("output_path")}
                          onValidationChange={setIsOutputNameValid}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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
                disabled={isSubmitting || !form.formState.isValid || !isOutputNameValid}
              >
                {isSubmitting ? <Spinner /> : null}
                Annotate
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
};

export default GenomeAnnotationContent;
