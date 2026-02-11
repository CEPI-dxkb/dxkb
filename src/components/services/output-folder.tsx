"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { HelpCircle } from "lucide-react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { WorkspaceObjectSelector } from "../workspace/workspace-object-selector";
import { checkWorkspaceObjectExists } from "@/lib/services/workspace/validation";

const DEBOUNCE_MS = 350;
const NAME_TAKEN_MESSAGE =
  "An object with this name already exists in the selected folder.";

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

function buildFullPath(outputFolderPath: string, name: string): string {
  const base = outputFolderPath.replace(/\/$/, "");
  const trimmed = name.trim();
  return trimmed ? `${base}/${trimmed}` : "";
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
  const [isChecking, setIsChecking] = useState(false);
  const [nameTaken, setNameTaken] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const runCheck = useCallback(
    async (folderPath: string, name: string) => {
      const fullPath = buildFullPath(folderPath, name);
      if (!fullPath) {
        setNameTaken(false);
        onValidationChange?.(true);
        return;
      }

      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      setIsChecking(true);
      setNameTaken(false);

      const exists = await checkWorkspaceObjectExists(fullPath, {
        signal: controller.signal,
      });

      if (controller.signal.aborted) {
        return;
      }

      setIsChecking(false);
      setNameTaken(exists);
      onValidationChange?.(!exists);
    },
    [onValidationChange],
  );

  useEffect(() => {
    if (variant !== "name" || !outputFolderPath?.trim() || !value?.trim()) {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      setIsChecking(false);
      setNameTaken(false);
      onValidationChange?.(true);
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      runCheck(outputFolderPath, value);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      abortControllerRef.current?.abort();
    };
  }, [variant, outputFolderPath, value, runCheck, onValidationChange]);

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
              <TooltipContent className="max-w-sm font-normal text-white">
                {resolvedTooltipText}
              </TooltipContent>
            </Tooltip>
          )}
          {required && <span className="text-red-500">*</span>}
        </div>
      )}
      <div className="flex flex-col gap-1">
        <div className="flex gap-2">
          {variant === "default" && (
            <WorkspaceObjectSelector
              types={["folder"]}
              placeholder="Search for folders..."
              value={value}
              onObjectSelect={(object) => {
                onChange?.(object.path || "");
              }}
            />
          )}
          {variant === "name" && (
            <div className="flex flex-1 items-center gap-2">
              <Input
                className="service-card-input"
                placeholder={resolvedPlaceholder}
                value={value}
                onChange={(e) => onChange?.(e.target.value)}
                disabled={disabled}
                aria-invalid={nameTaken}
              />
            </div>
          )}
        </div>
        {variant === "name" && !isChecking && nameTaken && (
          <p className="text-sm text-destructive" role="alert">
            {NAME_TAKEN_MESSAGE}
          </p>
        )}
      </div>
    </div>
  );
};

export default OutputFolder;
