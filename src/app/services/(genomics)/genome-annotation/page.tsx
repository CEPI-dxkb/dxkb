"use client";

import { useEffect, useRef, useState } from "react";
import { noop } from "@/lib/utils";
import { useForm, useStore } from "@tanstack/react-form";
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
import { useRerunForm } from "@/hooks/services/use-rerun-form";
import { useDefaultOutputPath } from "@/hooks/services/use-default-output-path";
import { toast } from "sonner";
import {
  completeGenomeAnnotationSchema,
  defaultGenomeAnnotationFormValues,
  type GenomeAnnotationFormData,
} from "@/lib/forms/(genomics)/genome-annotation/genome-annotation-form-schema";
import {
  transformGenomeAnnotationParams,
  generateOutputFileName,
  validateMyLabel,
  genomeAnnotationRecipes,
} from "@/lib/forms/(genomics)/genome-annotation/genome-annotation-form-utils";
import { FieldItem, FieldLabel, FieldErrors } from "@/components/ui/tanstack-form";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TaxIDSelector } from "@/components/taxonomy/tax-id-selector";
import { TaxonNameSelector } from "@/components/taxonomy/taxon-name-selector";
import { Spinner } from "@/components/ui/spinner";
import { Label } from "@/components/ui/label";

const GenomeAnnotationContent = () => {
  const [isOutputNameValid, setIsOutputNameValid] = useState(true);

  // Setup service debugging and form submission
  const {
    handleSubmit,
    showParamsDialog,
    setShowParamsDialog,
    currentParams,
    serviceName,
    isSubmitting,
  } = useServiceFormSubmission<GenomeAnnotationFormData>({
    serviceName: "GenomeAnnotation",
    displayName: "Genome Annotation",
    transformParams: transformGenomeAnnotationParams,
  });

  const form = useForm({
    defaultValues: defaultGenomeAnnotationFormValues as GenomeAnnotationFormData,
    validators: { onChange: completeGenomeAnnotationSchema },
    onSubmit: async ({ value }) => {
      // Validate my label for slashes
      const labelValidation = validateMyLabel(value.my_label);
      if (!labelValidation.isValid) {
        toast.error(labelValidation.message);
        return;
      }

      await handleSubmit(value);
    },
  });

  // Watch all form values for changes
  const watchedValues = useStore(form.store, (s) => s.values);
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

  // Rerun: pre-fill form from job parameters
  const { rerunData, markApplied } = useRerunForm<Record<string, unknown>>();
  useDefaultOutputPath(form, rerunData);

  useEffect(() => {
    if (!rerunData || !markApplied()) return;

    if (rerunData.contigs) form.setFieldValue("contigs", rerunData.contigs as never);
    if (rerunData.recipe) form.setFieldValue("recipe", rerunData.recipe as never);
    if (rerunData.output_path) form.setFieldValue("output_path", rerunData.output_path as never);
    if (rerunData.output_file) form.setFieldValue("output_file", rerunData.output_file as never);

    if (rerunData.taxonomy_id) {
      const taxonId = String(rerunData.taxonomy_id);
      form.setFieldValue("taxonomy_id", taxonId);
      const storedLabel = rerunData.my_label as string | undefined;
      fetch(`/api/services/taxonomy?q=taxon_id:${taxonId}&fl=taxon_id,taxon_name`)
        .then((r) => r.json())
        .then((data) => {
          const docs = Array.isArray(data) ? data : data?.response?.docs;
          if (docs && docs.length > 0) {
            form.setFieldValue("scientific_name", docs[0].taxon_name as never);
          }
          if (storedLabel) {
            form.setFieldValue("my_label", storedLabel as never);
          }
        })
        .catch(noop);
    } else {
      if (rerunData.scientific_name) form.setFieldValue("scientific_name", rerunData.scientific_name as never);
      if (rerunData.my_label) form.setFieldValue("my_label", rerunData.my_label as never);
    }
  }, [rerunData, markApplied, form]);

  const handleReset = () => {
    form.reset(defaultGenomeAnnotationFormValues);
  };

  const canSubmit = useStore(form.store, (s) => s.canSubmit);
  const outputPath = useStore(form.store, (s) => s.values.output_path);

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

      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
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
              <form.Field name="contigs">
                {(field) => (
                  <FieldItem>
                    <Label className="gap-1">
                      Contigs
                      <span className="gap-1 text-red-500">*</span>
                    </Label>
                    <WorkspaceObjectSelector
                      types={["contigs"]}
                      placeholder="Select or Upload Contigs to your workspace for Annotation"
                      onObjectSelect={(object: WorkspaceObject) => {
                        field.handleChange(object.path);
                      }}
                    />
                    <FieldErrors field={field} />
                  </FieldItem>
                )}
              </form.Field>

              {/* Annotation Recipe */}
              <form.Field name="recipe">
                {(field) => (
                  <FieldItem>
                    <Label className="gap-1">
                      Annotation Recipe
                      <span className="gap-1 text-red-500">*</span>
                    </Label>
                    <Select
                      items={genomeAnnotationRecipes}
                      value={field.state.value}
                      onValueChange={(val) => field.handleChange(val as GenomeAnnotationFormData["recipe"])}
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
                    <FieldErrors field={field} />
                  </FieldItem>
                )}
              </form.Field>

              {/* Taxonomy Name and ID */}
              <div className="flex flex-col gap-4 sm:flex-row ">
                <form.Field name="scientific_name">
                  {(field) => (
                    <FieldItem className="sm:w-[75%]">
                      <Label className="gap-1">
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
                        <span className="gap-1 text-red-500">*</span>
                      </Label>

                      <TaxonNameSelector
                        value={field.state.value ? {
                          taxon_id: parseInt(field.state.value) || 0,
                          taxon_name: field.state.value,
                        } : null}
                        onChange={(taxonomyItem) => {
                          // Extract the taxon_name string from the TaxonomyItem object
                          const taxonName = taxonomyItem?.taxon_name || null;
                          field.handleChange(taxonName);
                          // Automatically set taxonomy ID when taxonomy name is selected
                          if (taxonomyItem) {
                            const taxonId = String(taxonomyItem.taxon_id);
                            form.setFieldValue("taxonomy_id", taxonId);
                          } else {
                            // Clear taxonomy ID when name is cleared
                            form.setFieldValue("taxonomy_id", null);
                          }
                          // Auto-generate output file name
                          const myLabel = form.state.values.my_label;
                          if (taxonName && myLabel) {
                            const outputFileName = generateOutputFileName(taxonName, myLabel);
                            form.setFieldValue("output_file", outputFileName);
                          }
                        }}
                        placeholder="e.g. Bacillus cereus..."
                        required={true}
                        includeEukaryotes={false}
                      />
                      <FieldErrors field={field} />
                    </FieldItem>
                  )}
                </form.Field>

                <form.Field name="taxonomy_id">
                  {(field) => {
                    // Get scientific_name to populate taxon_name in the selector
                    const scientificName = form.state.values.scientific_name;
                    return (
                      <FieldItem className="sm:w-[25%]">
                        <FieldLabel field={field}>Taxonomy ID</FieldLabel>
                        <TaxIDSelector
                          value={field.state.value ? {
                            taxon_id: parseInt(field.state.value) || 0,
                            taxon_name: scientificName || "",
                          } : null}
                          onChange={(taxonomyItem) => {
                            // Extract the taxon_id string from the TaxonomyItem object
                            const taxonId = taxonomyItem ? String(taxonomyItem.taxon_id) : null;
                            field.handleChange(taxonId);
                          }}
                          placeholder="NCBI Taxonomy ID"
                          required={true}
                          disabled={true}
                        />
                        <FieldErrors field={field} />
                      </FieldItem>
                    );
                  }}
                </form.Field>
              </div>

              {/* My Label */}
              <form.Field name="my_label">
                {(field) => (
                  <FieldItem>
                    <Label className="gap-1">
                      My Label
                      <span className="gap-1 text-red-500">*</span>
                    </Label>
                    <Input
                      placeholder="My identifier123"
                      className="service-card-input"
                      value={field.state.value}
                      onChange={(e) => {
                        field.handleChange(e.target.value);
                        // Auto-generate output file name
                        const scientificName = form.state.values.scientific_name;
                        if (e.target.value && scientificName) {
                          const outputFileName = generateOutputFileName(scientificName, e.target.value);
                          form.setFieldValue("output_file", outputFileName);
                        }
                      }}
                    />
                    <FieldErrors field={field} />
                  </FieldItem>
                )}
              </form.Field>

              {/* Output Folder */}
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

              {/* Output File Name */}
              <form.Field name="output_file">
                {(field) => (
                  <FieldItem>
                    <OutputFolder
                      variant="name"
                      required={false}
                      value={field.state.value}
                      onChange={field.handleChange}
                      disabled={true}
                      outputFolderPath={outputPath}
                      onValidationChange={setIsOutputNameValid}
                    />
                    <FieldErrors field={field} />
                  </FieldItem>
                )}
              </form.Field>
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
              disabled={isSubmitting || !canSubmit || !isOutputNameValid}
            >
              {isSubmitting ? <Spinner /> : null}
              Annotate
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
};

export default GenomeAnnotationContent;
