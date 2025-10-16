import React from "react";
import { HelpCircle } from "lucide-react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { WorkspaceObjectSelector } from "../workspace/workspace-object-selector";

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
}: OutputFolderProps) => {
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
          <Label className="service-card-label">{resolvedTitle}</Label>
          {tooltipContent && (
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="service-card-tooltip-icon mb-2" />
              </TooltipTrigger>
              {/* TODO: Fix the width of the tooltip conente container */}
              {/* It will go off the screen depending on the inner content size and screen size */}
              <TooltipContent className="max-w-sm font-normal text-white">
                {resolvedTooltipText}
              </TooltipContent>
            </Tooltip>
          )}
          {required && <span className="text-red-500">*</span>}
        </div>
      )}
      <div className="flex gap-2">
        {variant === "default" && (
          <WorkspaceObjectSelector
            types={["folder"]}
            placeholder="Search for folders..."
            onObjectSelect={(object) => {
              onChange?.(object.path || "");
            }}

          />
        )}
        {variant === "name" && (
          <>
            <Input
              className="service-card-input"
              placeholder={resolvedPlaceholder}
              value={value}
              onChange={(e) => onChange?.(e.target.value)}
              disabled={disabled}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default OutputFolder;
