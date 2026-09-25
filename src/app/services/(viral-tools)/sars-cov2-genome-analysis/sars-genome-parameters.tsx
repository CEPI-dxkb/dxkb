import { FieldErrors, FieldItem } from "@/components/ui/tanstack-form";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import OutputFolder from "@/components/services/output-folder";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";
import { TaxonNameSelector } from "@/components/taxonomy/taxon-name-selector";
import { TaxIDSelector } from "@/components/taxonomy/tax-id-selector";
import {
  ServiceCardContent,
  ServiceCardHeader,
} from "@/components/services/form-ui/service-card";
import { ServiceInput } from "@/components/services/form-ui/service-input";
import { ServiceLabel } from "@/components/services/form-ui/service-label";
import { ServiceSelectTrigger } from "@/components/services/form-ui/service-select";
import { sarsCov2GenomeAnalysisParameters } from "@/lib/services/info/sars-cov2-genome-analysis";
import { computeOutputName } from "@/lib/forms/(viral-tools)/sars-cov2-genome-analysis/sars-cov2-genome-analysis-form-utils";
import {
  primerOptions,
  recipeOptions,
} from "@/lib/forms/(viral-tools)/sars-cov2-genome-analysis/sars-cov2-genome-analysis-form-schema";
import type { SarsGenomeForm } from "./page";

interface Props {
  form: SarsGenomeForm;
  inputType: string;
  showPrimers: boolean;
  primerVersions: readonly { value: string; label: string }[];
  outputPath: string;
  onValidationChange: (valid: boolean) => void;
}

export function SarsGenomeParameters({
  form,
  inputType,
  showPrimers,
  primerVersions,
  outputPath,
  onValidationChange,
}: Props) {
  return (
    <Card className="h-full">
      <ServiceCardHeader>
        <RequiredFormCardTitle>
          Parameters
          <DialogInfoPopup
            title={sarsCov2GenomeAnalysisParameters.title}
            sections={sarsCov2GenomeAnalysisParameters.sections}
          />
        </RequiredFormCardTitle>
      </ServiceCardHeader>
      <ServiceCardContent className="space-y-4">
        {inputType === "reads" && (
          <>
            <OptionField
              form={form}
              name="recipe"
              label="Strategy"
              options={recipeOptions}
            />
            {showPrimers && (
              <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
                <div className="flex-1">
                  <OptionField
                    form={form}
                    name="primers"
                    label="Primers"
                    options={primerOptions}
                  />
                </div>
                <div className="w-full sm:w-32">
                  <OptionField
                    form={form}
                    name="primer_version"
                    label="Version"
                    options={primerVersions}
                  />
                </div>
              </div>
            )}
          </>
        )}
        <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
          <div className="flex-1 space-y-2">
            <ServiceLabel>
              Taxonomy Name
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger aria-label="Help: select taxonomy name for SARS-CoV-2">
                    <HelpCircle className="service-card-tooltip-icon ml-1 inline-block" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Select the taxonomy name for SARS-CoV-2</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </ServiceLabel>
            <form.Field name="scientific_name">
              {(field) => (
                <FieldItem>
                  <TaxonNameSelector
                    value={
                      field.state.value || form.state.values.taxonomy_id
                        ? {
                            taxon_id:
                              parseInt(
                                form.state.values.taxonomy_id || "0",
                                10,
                              ) || 0,
                            taxon_name: field.state.value || "",
                          }
                        : null
                    }
                    onChange={(item) => {
                      if (item) {
                        field.handleChange(item.taxon_name);
                        form.setFieldValue(
                          "taxonomy_id",
                          String(item.taxon_id),
                        );
                        setOutputName(
                          form,
                          item.taxon_name,
                          form.state.values.my_label,
                        );
                      } else {
                        field.handleChange("");
                        form.setFieldValue("taxonomy_id", "");
                      }
                    }}
                    placeholder="e.g. Severe acute respiratory syndrome coronavirus 2"
                    includeViruses={false}
                    includeBacteria={false}
                    includeEukaryotes={false}
                  />
                  <FieldErrors field={field} />
                </FieldItem>
              )}
            </form.Field>
          </div>
          <div className="w-full space-y-2 sm:w-40">
            <ServiceLabel>Taxonomy ID</ServiceLabel>
            <form.Field name="taxonomy_id">
              {(field) => (
                <FieldItem>
                  <TaxIDSelector
                    value={
                      field.state.value
                        ? {
                            taxon_id: parseInt(field.state.value, 10) || 0,
                            taxon_name: form.state.values.scientific_name || "",
                          }
                        : null
                    }
                    onChange={(item) => {
                      if (item) {
                        field.handleChange(String(item.taxon_id));
                        form.setFieldValue("scientific_name", item.taxon_name);
                        setOutputName(
                          form,
                          item.taxon_name,
                          form.state.values.my_label,
                        );
                      } else {
                        field.handleChange("");
                        form.setFieldValue("scientific_name", "");
                      }
                    }}
                    placeholder="NCBI Taxonomy ID"
                  />
                  <FieldErrors field={field} />
                </FieldItem>
              )}
            </form.Field>
          </div>
        </div>
        <form.Field name="my_label">
          {(field) => (
            <FieldItem>
              <ServiceLabel>My Label</ServiceLabel>
              <ServiceInput
                placeholder="My identifier123"
                value={field.state.value}
                onChange={(event) => {
                  field.handleChange(event.target.value);
                  setOutputName(
                    form,
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
                outputFolderPath={outputPath}
                onValidationChange={onValidationChange}
                disabled={true}
              />
              <FieldErrors field={field} />
            </FieldItem>
          )}
        </form.Field>
      </ServiceCardContent>
    </Card>
  );
}

function OptionField({
  form,
  name,
  label,
  options,
}: {
  form: SarsGenomeForm;
  name: "recipe" | "primers" | "primer_version";
  label: string;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <div className="space-y-2">
      <ServiceLabel>{label}</ServiceLabel>
      <form.Field name={name}>
        {(field) => (
          <FieldItem>
            <Select
              items={options}
              value={field.state.value}
              onValueChange={(value) => {
                if (value != null) field.handleChange(value);
              }}
            >
              <ServiceSelectTrigger aria-label={label}>
                <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
              </ServiceSelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
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
  );
}
function setOutputName(form: SarsGenomeForm, name: string, label: string) {
  const output = computeOutputName(name, label);
  if (output) form.setFieldValue("output_file", output);
}
