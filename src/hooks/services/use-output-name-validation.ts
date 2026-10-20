"use client";

import { useEffect, useEffectEvent, useState } from "react";

import { checkWorkspaceObjectExists } from "@/lib/services/workspace/validation";
import { workspaceErrorMessage } from "@/lib/services/workspace/workspace-errors";

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
  /** Why the check could not run, condensed; set with status "error". */
  error?: string;
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
  // Bumped by `retry`, so the effect runs the check again for the same name.
  const [attempt, setAttempt] = useState(0);
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
        (error: unknown) => {
          if (controller.signal.aborted) return;
          setValidation({
            key: validationKey,
            status: "error",
            error: workspaceErrorMessage(error, "the workspace did not answer"),
          });
          notifyValidation(false);
        },
      );
    }, debounceMs);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [fullPath, validationKey, attempt]);

  const status = validation.key === validationKey ? validation.status : "idle";
  const errorMessage =
    status === "error" ? (validation.error ?? null) : null;
  const isPending = !!fullPath && validation.key !== validationKey;

  return {
    status,
    // Pending covers the debounce window; checking covers the lookup itself.
    // Neither is a verdict, so they block submission (via onValidationChange)
    // without marking the field invalid.
    isValidating: isPending || status === "checking",
    isInvalid: status === "taken" || status === "error",
    /** The check's own failure, for "Unable to validate this name: …". */
    errorMessage,
    /**
     * Runs the check again after a failure (a workspace outage), which is
     * otherwise rerun only by editing the name. Submit stays blocked until
     * the new check answers.
     */
    retry: () => {
      setValidation({ key: "", status: "idle" });
      setAttempt((current) => current + 1);
    },
  };
}
