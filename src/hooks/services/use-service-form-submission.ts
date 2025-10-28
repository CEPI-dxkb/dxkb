"use client";

import { useState } from "react";
import { useServiceDebugging } from "@/contexts/service-debugging-context";

interface UseServiceFormSubmissionOptions<T> {
  serviceName?: string;
  onSubmit?: (data: T) => void | Promise<void>;
  transformParams?: (data: T) => Record<string, any>;
}

export function useServiceFormSubmission<T = Record<string, any>>(
  options: UseServiceFormSubmissionOptions<T> = {},
) {
  const { serviceName = "Job", onSubmit, transformParams } = options;
  const { isDebugMode, containerBuildId } = useServiceDebugging();
  const [showParamsDialog, setShowParamsDialog] = useState(false);
  const [currentParams, setCurrentParams] = useState<Record<string, any>>({});

  const handleSubmit = async (data: T) => {
    // Transform the form data into submission params
    const params = transformParams ? transformParams(data) : (data as Record<string, any>);

    // Add container build ID if specified
    const finalParams = {
      ...params,
      ...(containerBuildId && containerBuildId !== "latest version" ? { container_build_id: containerBuildId } : {}),
    };

    // Log params to console
    console.log(`${serviceName} Submission Params:`, finalParams);

    if (isDebugMode) {
      // Show the params dialog instead of submitting
      setCurrentParams(finalParams);
      setShowParamsDialog(true);
    } else {
      // Actually submit the job
      if (onSubmit) {
        await onSubmit(data);
      }
    }
  };

  return {
    handleSubmit,
    showParamsDialog,
    setShowParamsDialog,
    currentParams,
    isDebugMode,
    serviceName,
  };
}

