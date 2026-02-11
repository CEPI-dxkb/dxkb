"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useServiceDebugging } from "@/contexts/service-debugging-context";
import { submitServiceJob } from "@/lib/services/service-utils";

interface UseServiceFormSubmissionOptions<T> {
  /** Service name for job submission (e.g., "MetagenomeBinning") */
  serviceName: string;
  /** Display name for toasts (defaults to serviceName with spaces) */
  displayName?: string;
  /** Transform form data to API parameters */
  transformParams: (data: T) => Record<string, unknown>;
  /** Callback after successful job submission */
  onSuccess?: () => void;
  /**
   * @deprecated Use transformParams + onSuccess instead. This callback receives raw
   * form data and is only called when not in debug mode, bypassing the hook's job
   * submission handling.
   */
  onSubmit?: (data: T) => void | Promise<void>;
}

export function useServiceFormSubmission<T = Record<string, unknown>>(
  options: UseServiceFormSubmissionOptions<T>,
) {
  const { serviceName, displayName, transformParams, onSuccess, onSubmit } = options;
  const { isDebugMode, containerBuildId } = useServiceDebugging();
  const [showParamsDialog, setShowParamsDialog] = useState(false);
  const [currentParams, setCurrentParams] = useState<Record<string, unknown>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Format display name from service name (e.g., "MetagenomeBinning" -> "Metagenomic Binning")
  const formattedDisplayName =
    displayName ?? serviceName.replace(/([A-Z])/g, " $1").trim();

  const handleSubmit = async (data: T) => {
    // Transform the form data into submission params
    const params = transformParams(data);

    // Add container build ID if specified
    const finalParams = {
      ...params,
      ...(containerBuildId && containerBuildId !== "latest version"
        ? { container_build_id: containerBuildId }
        : {}),
    };

    // Log params to console
    console.log(`${serviceName} Submission Params:`, finalParams);

    if (isDebugMode) {
      // Show the params dialog instead of submitting
      setCurrentParams(finalParams);
      setShowParamsDialog(true);
      return;
    }

    // Legacy callback path - for backward compatibility during migration
    if (onSubmit) {
      await onSubmit(data);
      return;
    }

    // Standard job submission path
    try {
      setIsSubmitting(true);
      const result = await submitServiceJob(serviceName, finalParams);

      if (result.success) {
        toast.success(`${formattedDisplayName} job submitted successfully!`, {
          description: result.job?.[0]?.id
            ? `Job ID: ${result.job[0].id}`
            : "Job submitted successfully",
          closeButton: true,
        });
        onSuccess?.();
      } else {
        throw new Error(result.error || "Failed to submit job");
      }
    } catch (error) {
      console.error(`Failed to submit ${formattedDisplayName} job:`, error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to submit job";
      toast.error("Submission failed", {
        description: errorMessage,
        closeButton: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    handleSubmit,
    showParamsDialog,
    setShowParamsDialog,
    currentParams,
    isDebugMode,
    isSubmitting,
    serviceName,
  };
}

