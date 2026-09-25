"use client";

import { Card } from "@/components/ui/card";
import { FieldErrors, FieldItem } from "@/components/ui/tanstack-form";
import OutputFolder from "@/components/services/output-folder";
import {
  ServiceCardContent,
  ServiceCardHeader,
  ServiceCardTitle,
} from "@/components/services/form-ui/service-card";
import type { PrimerDesignController } from "./use-primer-design-form";

export function PrimerOutputSection({
  controller,
}: {
  controller: PrimerDesignController;
}) {
  const { form, outputPath, setIsOutputNameValid } = controller;
  return (
    <Card className="gap-0">
      <ServiceCardHeader className="pb-1">
        <ServiceCardTitle>Output</ServiceCardTitle>
      </ServiceCardHeader>
      <ServiceCardContent className="space-y-3 pt-1">
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
                required
                value={field.state.value}
                onChange={field.handleChange}
                outputFolderPath={outputPath}
                onValidationChange={setIsOutputNameValid}
              />
              <FieldErrors field={field} />
            </FieldItem>
          )}
        </form.Field>
      </ServiceCardContent>
    </Card>
  );
}
