import React from "react";
import { Button } from "../ui/button";
import { FolderSearch, HelpCircle } from "lucide-react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";

interface OutputFolderProps {
  title?: boolean;
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
  tooltipContent = true,
  placeholder,
  buttonIcon = <FolderSearch size={16} />,
  value = "",
  onChange,
  disabled = false,
  variant = "default",
}: OutputFolderProps) => {
  const resolvedTitle =
    variant === "default" ? "Output Folder" : "Output Name";

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
              <TooltipContent className="max-w-sm text-white font-normal">
                {resolvedTooltipText}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          className="service-card-input"
          placeholder={resolvedPlaceholder}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
        />
        {variant === "default" && (
          <Button size="icon" variant="outline">
            {buttonIcon}
          </Button>
        )}
      </div>
    </div>
  );
};

export default OutputFolder;
