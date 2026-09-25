import { useSelector } from "@tanstack/react-store";
import { HelpCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  FieldErrors,
  FieldItem,
  FieldLabel,
} from "@/components/ui/tanstack-form";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import OutputFolder from "@/components/services/output-folder";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import { TaxIDSelector } from "@/components/taxonomy/tax-id-selector";
import { TaxonNameSelector } from "@/components/taxonomy/taxon-name-selector";
import {
  ServiceCardContent,
  ServiceCardHeader,
  ServiceCardTitle,
} from "@/components/services/form-ui/service-card";
import { ServiceInput } from "@/components/services/form-ui/service-input";
import { ServiceSelectTrigger } from "@/components/services/form-ui/service-select";
import { genomeAnnotationParameters } from "@/lib/services/info/genome-annotation";
import {
  genomeAnnotationRecipes,
  generateOutputFileName,
} from "@/lib/forms/(genomics)/genome-annotation/genome-annotation-form-utils";
import type { GenomeAnnotationFormData } from "@/lib/forms/(genomics)/genome-annotation/genome-annotation-form-schema";
import type { WorkspaceObject } from "@/lib/services/workspace/types";
import type { GenomeAnnotationForm } from "./page";

interface Props {
  form: GenomeAnnotationForm;
  onOutputNameValidationChange: (isValid: boolean) => void;
}

export function GenomeAnnotationParameters({
  form,
  onOutputNameValidationChange,
}: Props) {
  const outputPath = useSelector(
    form.store,
    (state) => state.values.output_path,
  );
  const updateOutputName = (name: string | null, label: string) => {
    if (name && label)
      form.setFieldValue("output_file", generateOutputFileName(name, label));
  };

  return (
    <Card>
      <ServiceCardHeader>
        <ServiceCardTitle>
          Parameters
          <DialogInfoPopup
            title={genomeAnnotationParameters.title}
            description={genomeAnnotationParameters.description}
            sections={genomeAnnotationParameters.sections}
          />
        </ServiceCardTitle>
      </ServiceCardHeader>
      <ServiceCardContent>
        <div className="space-y-6">
          <form.Field name="contigs">
            {(field) => (
              <FieldItem>
                <RequiredLabel>Contigs</RequiredLabel>
                <WorkspaceObjectSelector
                  preset="contigs"
                  placeholder="Select or Upload Contigs to your workspace for Annotation"
                  value={field.state.value}
                  onObjectSelect={(object: WorkspaceObject) => {
                    field.handleChange(object.path);
                  }}
                />
                <FieldErrors field={field} />
              </FieldItem>
            )}
          </form.Field>
          <form.Field name="recipe">
            {(field) => (
              <FieldItem>
                <RequiredLabel>Annotation Recipe</RequiredLabel>
                <Select
                  items={genomeAnnotationRecipes}
                  value={field.state.value}
                  onValueChange={(value) => {
                    field.handleChange(
                      value as GenomeAnnotationFormData["recipe"],
                    );
                  }}
                >
                  <ServiceSelectTrigger aria-label="Annotation Recipe">
                    <SelectValue placeholder="--- Select Recipe ---" />
                  </ServiceSelectTrigger>
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
          <div className="flex flex-col gap-4 sm:flex-row">
            <form.Field name="scientific_name">
              {(field) => (
                <FieldItem className="sm:w-9/12">
                  <Label className="gap-1">
                    Taxonomy Name
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger aria-label="Help: taxon must be genus level or below">
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
                    <span className="text-red-500">*</span>
                  </Label>
                  <TaxonNameSelector
                    value={
                      field.state.value
                        ? {
                            taxon_id: parseInt(field.state.value) || 0,
                            taxon_name: field.state.value,
                          }
                        : null
                    }
                    onChange={(item) => {
                      const name = item?.taxon_name || null;
                      field.handleChange(name);
                      form.setFieldValue(
                        "taxonomy_id",
                        item ? String(item.taxon_id) : null,
                      );
                      updateOutputName(name, form.state.values.my_label);
                    }}
                    placeholder="e.g. Bacillus cereus..."
                    required
                    includeEukaryotes={false}
                  />
                  <FieldErrors field={field} />
                </FieldItem>
              )}
            </form.Field>
            <form.Field name="taxonomy_id">
              {(field) => (
                <FieldItem className="sm:w-3/12">
                  <FieldLabel field={field}>Taxonomy ID</FieldLabel>
                  <TaxIDSelector
                    id={field.name}
                    value={
                      field.state.value
                        ? {
                            taxon_id: parseInt(field.state.value) || 0,
                            taxon_name: form.state.values.scientific_name || "",
                          }
                        : null
                    }
                    onChange={(item) => {
                      field.handleChange(item ? String(item.taxon_id) : null);
                    }}
                    placeholder="NCBI Taxonomy ID"
                    required
                    disabled
                  />
                  <FieldErrors field={field} />
                </FieldItem>
              )}
            </form.Field>
          </div>
          <form.Field name="my_label">
            {(field) => (
              <FieldItem>
                <RequiredLabel>My Label</RequiredLabel>
                <ServiceInput
                  placeholder="My identifier123"
                  value={field.state.value}
                  onChange={(event) => {
                    field.handleChange(event.target.value);
                    updateOutputName(
                      form.state.values.scientific_name,
                      event.target.value,
                    );
                  }}
                />
                <FieldErrors field={field} />
              </FieldItem>
            )}
          </form.Field>
          <form.Field name="output_path">
            {(field) => (
              <FieldItem>
                <OutputFolder
                  required
                  value={field.state.value}
                  onChange={field.handleChange}
                />
                <FieldErrors field={field} />
              </FieldItem>
            )}
          </form.Field>
          <form.Field name="output_file">
            {(field) => (
              <FieldItem>
                <OutputFolder
                  variant="name"
                  value={field.state.value}
                  onChange={field.handleChange}
                  disabled
                  outputFolderPath={outputPath}
                  onValidationChange={onOutputNameValidationChange}
                />
                <FieldErrors field={field} />
              </FieldItem>
            )}
          </form.Field>
        </div>
      </ServiceCardContent>
    </Card>
  );
}

function RequiredLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label className="gap-1">
      {children}
      <span className="text-red-500">*</span>
    </Label>
  );
}
