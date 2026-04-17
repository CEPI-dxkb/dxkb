"use client";

import { useEffect, useRef, useState } from "react";
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
} from "@/lib/services/info/genome-annotation";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import OutputFolder from "@/components/services/output-folder";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import { WorkspaceObject } from "@/lib/services/workspace/types";
import { JobParamsDialog } from "@/components/services/job-params-dialog";
import { useServiceRuntime } from "@/hooks/services/use-service-runtime";
import { toast } from "sonner";
import {
  completeGenomeAnnotationSchema,
  defaultGenomeAnnotationFormValues,
  type GenomeAnnotationFormData,
} from "@/lib/forms/(genomics)/genome-annotation/genome-annotation-form-schema";
import {
  generateOutputFileName,
  validateMyLabel,
  genomeAnnotationRecipes,
} from "@/lib/forms/(genomics)/genome-annotation/genome-annotation-form-utils";
import { genomeAnnotationService } from "@/lib/forms/(genomics)/genome-annotation/genome-annotation-service";
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

      await runtime.submitFormData(value);
    },
  });

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

  const runtime = useServiceRuntime({
    definition: genomeAnnotationService,
    form,
  });
  const { isSubmitting, jobParamsDialogProps } = runtime;

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

      <JobParamsDialog {...jobParamsDialogProps} />
    </section>
  );
};

export default GenomeAnnotationContent;
