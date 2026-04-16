"use client";

import { useState } from "react";

import { useServiceDebugging } from "@/contexts/service-debugging-context";

interface UseDebugParamsPreviewOptions {
  serviceName: string;
}

export function useDebugParamsPreview(options: UseDebugParamsPreviewOptions): {
  previewOrPassthrough: (
    params: Record<string, unknown>,
    submit: (merged: Record<string, unknown>) => Promise<void>,
  ) => Promise<void>;
  dialogProps: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    params: Record<string, unknown>;
    serviceName: string;
  };
} {
  const { serviceName } = options;
  const { isDebugMode, containerBuildId } = useServiceDebugging();
  const [showParamsDialog, setShowParamsDialog] = useState(false);
  const [currentParams, setCurrentParams] = useState<Record<string, unknown>>({});

  const previewOrPassthrough = async (
    params: Record<string, unknown>,
    submit: (merged: Record<string, unknown>) => Promise<void>,
  ) => {
    const merged = {
      ...params,
      ...(containerBuildId && containerBuildId !== "latest version"
        ? { container_build_id: containerBuildId }
        : {}),
    };

    if (isDebugMode) {
      setCurrentParams(merged);
      setShowParamsDialog(true);
      return;
    }

    await submit(merged);
  };

  return {
    previewOrPassthrough,
    dialogProps: {
      open: showParamsDialog,
      onOpenChange: setShowParamsDialog,
      params: currentParams,
      serviceName,
    },
  };
}
