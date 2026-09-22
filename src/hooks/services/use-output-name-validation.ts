"use client";

import { useEffect, useEffectEvent, useState } from "react";

import { checkWorkspaceObjectExists } from "@/lib/services/workspace/validation";

const debounceMs = 350;

export type OutputNameValidationStatus =
  "idle" | "checking" | "available" | "taken" | "error";

interface UseOutputNameValidationOptions {
  enabled: boolean;
  outputFolderPath: string;
  outputName: string;
  onValidationChange?: (valid: boolean) => void;
}

interface ValidationState {
  key: string;
  status: OutputNameValidationStatus;
}

function buildFullPath(outputFolderPath: string, outputName: string): string {
  const base = outputFolderPath.replace(/\/$/, "");
  const trimmed = outputName.trim();
  return trimmed ? `${base}/${trimmed}` : "";
}

export function useOutputNameValidation({
  enabled,
  outputFolderPath,
  outputName,
  onValidationChange,
}: UseOutputNameValidationOptions) {
  const fullPath = enabled ? buildFullPath(outputFolderPath, outputName) : "";
  const validationKey = fullPath ? `${outputFolderPath}\0${outputName}` : "";
  const [validation, setValidation] = useState<ValidationState>({
    key: "",
    status: "idle",
  });
  const [previousValidationKey, setPreviousValidationKey] =
    useState(validationKey);
  if (previousValidationKey !== validationKey) {
    setPreviousValidationKey(validationKey);
    setValidation({ key: "", status: "idle" });
  }

  const notifyValidation = useEffectEvent((valid: boolean) => {
    onValidationChange?.(valid);
  });

  useEffect(() => {
    if (!fullPath) {
      notifyValidation(true);
      return;
    }

    const controller = new AbortController();
    notifyValidation(false);

    const timeoutId = setTimeout(() => {
      setValidation({ key: validationKey, status: "checking" });
      void checkWorkspaceObjectExists(fullPath, {
        signal: controller.signal,
      }).then(
        (exists) => {
          if (controller.signal.aborted) return;
          setValidation({
            key: validationKey,
            status: exists ? "taken" : "available",
          });
          notifyValidation(!exists);
        },
        () => {
          if (controller.signal.aborted) return;
          setValidation({ key: validationKey, status: "error" });
          notifyValidation(false);
        },
      );
    }, debounceMs);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [fullPath, validationKey]);

  const status = validation.key === validationKey ? validation.status : "idle";
  const isPending = !!fullPath && validation.key !== validationKey;

  return {
    status,
    isChecking: status === "checking",
    isPending,
    isInvalid:
      isPending ||
      status === "checking" ||
      status === "taken" ||
      status === "error",
  };
}
