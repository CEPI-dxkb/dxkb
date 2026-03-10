"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
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
}

export function useServiceFormSubmission<T = Record<string, unknown>>(
  options: UseServiceFormSubmissionOptions<T>,
) {
  const { serviceName, displayName, transformParams, onSuccess } = options;
  const router = useRouter();
  const { isDebugMode, containerBuildId } = useServiceDebugging();
  const [showParamsDialog, setShowParamsDialog] = useState(false);
  const [currentParams, setCurrentParams] = useState<Record<string, unknown>>({});

  // Format display name from service name (e.g., "MetagenomeBinning" -> "Metagenomic Binning")
  const formattedDisplayName =
    displayName ?? serviceName.replace(/([A-Z])/g, " $1").trim();

  const submitMutation = useMutation({
    mutationFn: async (finalParams: Record<string, unknown>) => {
      const result = await submitServiceJob(serviceName, finalParams);
      if (!result.success) {
        throw new Error(result.error || "Failed to submit job");
      }
      return result;
    },
    onSuccess: (result) => {
      const jobId = result.job?.[0]?.id;
      toast.success(`${formattedDisplayName} job submitted successfully!`, {
        description: jobId
          ? `Job ID: ${jobId}`
          : "Job submitted successfully",
        closeButton: true,
        ...(jobId && {
          action: {
            label: "View Job",
            onClick: () => router.push(`/jobs`),
          },
        }),
      });
      onSuccess?.();
    },
    onError: (error) => {
      console.error(`Failed to submit ${formattedDisplayName} job:`, error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to submit job";
      toast.error("Submission failed", {
        description: errorMessage,
        closeButton: true,
      });
    },
  });

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

    if (isDebugMode) {
      // Show the params dialog instead of submitting
      setCurrentParams(finalParams);
      setShowParamsDialog(true);
      return;
    }

    // Standard job submission path — mutateAsync so TanStack Form's
    // isSubmitting tracks the real request. Errors are already handled
    // by the mutation's onError callback, so we swallow the re-throw.
    await submitMutation.mutateAsync(finalParams).catch(() => { /* handled by mutation onError */ });
  };

  return {
    handleSubmit,
    showParamsDialog,
    setShowParamsDialog,
    currentParams,
    isDebugMode,
    isSubmitting: submitMutation.isPending,
    serviceName,
  };
}
