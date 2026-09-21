"use client";

import type { ReactNode } from "react";
import OutputFolder from "@/components/services/output-folder";
import { FieldItem } from "@/components/ui/tanstack-form";

export interface ServiceOutputFieldBinding {
  value: string;
  onChange: (value: string) => void;
  errors?: ReactNode;
}

interface ServiceOutputFieldsProps {
  outputPath: ServiceOutputFieldBinding;
  outputName: ServiceOutputFieldBinding;
  onOutputNameValidationChange: (valid: boolean) => void;
  required?: boolean;
  className?: string;
}

export function ServiceOutputFields({
  outputPath,
  outputName,
  onOutputNameValidationChange,
  required = true,
  className = "flex flex-col space-y-4",
}: ServiceOutputFieldsProps) {
  return (
    <div className={className}>
      <FieldItem>
        <OutputFolder
          required={required}
          value={outputPath.value}
          onChange={outputPath.onChange}
        />
        {outputPath.errors}
      </FieldItem>
      <FieldItem>
        <OutputFolder
          variant="name"
          required={required}
          value={outputName.value}
          onChange={outputName.onChange}
          outputFolderPath={outputPath.value}
          onValidationChange={onOutputNameValidationChange}
        />
        {outputName.errors}
      </FieldItem>
    </div>
  );
}
