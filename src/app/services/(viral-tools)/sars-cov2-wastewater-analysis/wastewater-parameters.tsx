import { FieldErrors, FieldItem } from "@/components/ui/tanstack-form";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import OutputFolder from "@/components/services/output-folder";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";
import {
  ServiceCardContent,
  ServiceCardHeader,
} from "@/components/services/form-ui/service-card";
import { ServiceLabel } from "@/components/services/form-ui/service-label";
import { ServiceSelectTrigger } from "@/components/services/form-ui/service-select";
import { sarsCov2WastewaterAnalysisParameters } from "@/lib/services/info/sars-cov2-wastewater-analysis";
import { recipeOptions } from "@/lib/forms/(viral-tools)/sars-cov2-wastewater-analysis/sars-cov2-wastewater-analysis-form-schema";
import type { WastewaterForm } from "./page";

export function WastewaterParameters({
  form,
  outputPath,
  onValidationChange,
}: {
  form: WastewaterForm;
  outputPath: string;
  onValidationChange: (valid: boolean) => void;
}) {
  return (
    <Card>
      <ServiceCardHeader>
        <RequiredFormCardTitle>
          Parameters
          <DialogInfoPopup
            title={sarsCov2WastewaterAnalysisParameters.title}
            sections={sarsCov2WastewaterAnalysisParameters.sections}
          />
        </RequiredFormCardTitle>
      </ServiceCardHeader>
      <ServiceCardContent className="space-y-4">
        <div className="space-y-2">
          <ServiceLabel>Strategy</ServiceLabel>
          <form.Field name="recipe">
            {(field) => (
              <FieldItem>
                <Select
                  items={recipeOptions}
                  value={field.state.value}
                  onValueChange={(value) => {
                    if (value != null) field.handleChange(value);
                  }}
                >
                  <ServiceSelectTrigger aria-label="Strategy">
                    <SelectValue placeholder="Select strategy" />
                  </ServiceSelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {recipeOptions.map((recipe) => (
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
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
          <form.Field name="output_path">
            {(field) => (
              <FieldItem className="flex-1">
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
              <FieldItem className="flex-1">
                <OutputFolder
                  variant="name"
                  value={field.state.value}
                  onChange={field.handleChange}
                  outputFolderPath={outputPath}
                  onValidationChange={onValidationChange}
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
