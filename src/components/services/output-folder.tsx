"use client";

import React from "react";

import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import { useOutputNameValidation } from "@/hooks/services/use-output-name-validation";
import { ServiceInput } from "@/components/services/form-ui/service-input";
import { ServiceLabel } from "@/components/services/form-ui/service-label";

import { HelpCircle } from "lucide-react";

const nameTakenMessage =
  "An object with this name already exists in the selected folder.";
const validationErrorMessage =
  "Unable to validate this name. Please try again.";

interface OutputFolderProps {
  title?: boolean;
  required?: boolean;
  tooltipContent?: boolean;
  placeholder?: string;
  buttonIcon?: React.ReactNode;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  variant?: "default" | "name";
  outputFolderPath?: string;
  onValidationChange?: (valid: boolean) => void;
}

function isSelectableOutputFolder(object: {
  name: string;
  path: string;
}): boolean {
  const hasHiddenPathSegment = object.path
    .split("/")
    .some((segment) => segment.startsWith("."));
  return !object.name.startsWith(".") && !hasHiddenPathSegment;
}

const OutputFolder = ({
  title = true,
  required = false,
  tooltipContent = true,
  placeholder,
  value = "",
  onChange,
  disabled = false,
  variant = "default",
  outputFolderPath = "",
  onValidationChange,
}: OutputFolderProps) => {
  const needsValidation =
    variant === "name" && !!outputFolderPath.trim() && !!value.trim();
  const validation = useOutputNameValidation({
    enabled: needsValidation,
    outputFolderPath,
    outputName: value,
    onValidationChange,
  });

  const resolvedTitle = variant === "default" ? "Output Folder" : "Output Name";

  const resolvedPlaceholder =
    placeholder ??
    (variant === "default"
      ? "Select Output Folder..."
      : "Select Output Name...");

  const resolvedTooltipText =
    variant === "default"
      ? "The workspace folder where results will be placed."
      : "The name of the output file. This will appear in the specified output folder when the annotation job is complete.";

  return (
    <div className="space-y-0">
      {title && (
        <div className="flex flex-row items-center gap-2">
          <ServiceLabel>{resolvedTitle}</ServiceLabel>
          {tooltipContent && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  aria-label={`${resolvedTitle} help`}
                  render={
                    <HelpCircle className="service-card-tooltip-icon mb-2" />
                  }
                />
                <TooltipContent className="max-w-sm font-normal text-white">
                  {resolvedTooltipText}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {required && <span className="text-red-500">*</span>}
        </div>
      )}
      <div className="flex flex-col gap-1">
        <div className="flex gap-2">
          {variant === "default" && (
            <WorkspaceObjectSelector
              preset="folder"
              placeholder="Search for folders..."
              value={value}
              filter={isSelectableOutputFolder}
              onObjectSelect={(object) => {
                onChange?.(object.path || "");
              }}
            />
          )}
          {variant === "name" && (
            <div className="flex flex-1 items-center gap-2">
              <ServiceInput
                placeholder={resolvedPlaceholder}
                value={value}
                onChange={(e) => onChange?.(e.target.value)}
                disabled={disabled}
                aria-invalid={validation.isInvalid}
                aria-label={resolvedTitle}
              />
            </div>
          )}
        </div>
        {variant === "name" &&
          (validation.status === "taken" || validation.status === "error") && (
            <p className="text-sm text-destructive" role="alert">
              {validation.status === "error"
                ? validationErrorMessage
                : nameTakenMessage}
            </p>
          )}
      </div>
    </div>
  );
};

export default OutputFolder;
