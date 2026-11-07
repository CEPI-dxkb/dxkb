"use client";

import type { ReactNode } from "react";
import OutputFolder from "@/components/services/output-folder";
import { FieldItem } from "@/components/ui/tanstack-form";

export interface ServiceOutputFieldBinding {
  value: string;
  onChange: (value: string) => void;
  errors?: ReactNode;
  /** Draws the field in its error state while `errors` shows a message. */
  invalid?: boolean;
}

interface ServiceOutputFieldsProps {
  outputPath: ServiceOutputFieldBinding;
  outputName: ServiceOutputFieldBinding;
  onOutputNameValidationChange: (valid: boolean) => void;
  required?: boolean;
  /**
   * `column` stacks the two fields; `row` puts each in a
   * `service-card-row-item` of one `service-card-row`.
   */
  layout?: "column" | "row";
  className?: string;
}

export function ServiceOutputFields({
  outputPath,
  outputName,
  onOutputNameValidationChange,
  required = true,
  layout = "column",
  className,
}: ServiceOutputFieldsProps) {
  const pathField = (
    <FieldItem>
      <OutputFolder
        required={required}
        value={outputPath.value}
        onChange={outputPath.onChange}
        invalid={outputPath.invalid}
      />
      {outputPath.errors}
    </FieldItem>
  );
  const nameField = (
    <FieldItem>
      <OutputFolder
        variant="name"
        required={required}
        value={outputName.value}
        onChange={outputName.onChange}
        outputFolderPath={outputPath.value}
        onValidationChange={onOutputNameValidationChange}
        invalid={outputName.invalid}
      />
      {outputName.errors}
    </FieldItem>
  );

  if (layout === "row") {
    return (
      <div className={className ?? "service-card-row"}>
        <div className="service-card-row-item">{pathField}</div>
        <div className="service-card-row-item">{nameField}</div>
      </div>
    );
  }

  return (
    <div className={className ?? "flex flex-col space-y-4"}>
      {pathField}
      {nameField}
    </div>
  );
}
