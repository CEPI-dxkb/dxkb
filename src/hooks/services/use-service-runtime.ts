"use client";

import { useCallback } from "react";

import { useDebugParamsPreview } from "@/hooks/services/use-debug-params-preview";
import { useRerunForm } from "@/hooks/services/use-rerun-form";
import { useServiceFormSubmission } from "@/hooks/services/use-service-form-submission";
import type { JobParamsDialogProps } from "@/components/services/job-params-dialog";
import type {
  ServiceDefinition,
  ServiceFormApi,
  ServiceRerunConfig,
} from "@/lib/services/service-definition";

interface UseServiceRuntimeOptions<
  TForm,
  TRerun extends Record<string, unknown>,
  TFormApi extends ServiceFormApi<TForm>,
> {
  definition: ServiceDefinition<TForm, TRerun>;
  form: TFormApi;
  onSuccess?: () => void;
  rerun?: Partial<ServiceRerunConfig<TForm, TRerun>>;
}

export interface ServiceRuntime<
  TForm,
  TRerun extends Record<string, unknown>,
  TFormApi extends ServiceFormApi<TForm>,
> {
  form: TFormApi;
  serviceName: string;
  displayName: string;
  isSubmitting: boolean;
  rerunData: TRerun | null;
  jobParamsDialogProps: JobParamsDialogProps;
  transformParams(data: TForm): Record<string, unknown>;
  submitParams(params: Record<string, unknown>): Promise<void>;
  previewOrSubmit(params: Record<string, unknown>): Promise<void>;
  submitFormData(data: TForm): Promise<void>;
}

export function useServiceRuntime<
  TForm,
  TRerun extends Record<string, unknown> = Record<string, unknown>,
  TFormApi extends ServiceFormApi<TForm> = ServiceFormApi<TForm>,
>({
  definition,
  form,
  onSuccess,
  rerun,
}: UseServiceRuntimeOptions<TForm, TRerun, TFormApi>): ServiceRuntime<
  TForm,
  TRerun,
  TFormApi
> {
  const { submit, isSubmitting } = useServiceFormSubmission({
    serviceName: definition.serviceName,
    displayName: definition.displayName,
    onSuccess,
  });
  const { previewOrPassthrough, dialogProps } = useDebugParamsPreview({
    serviceName: definition.serviceName,
  });

  const mergedRerun = {
    ...(definition.rerun ?? {}),
    ...(rerun ?? {}),
    defaultOutputPath:
      rerun?.defaultOutputPath ??
      definition.rerun?.defaultOutputPath ??
      definition.defaultOutputPath,
  };

  const { rerunData } = useRerunForm<TRerun>({
    ...mergedRerun,
    form,
  });

  const transformParams = useCallback(
    (data: TForm) => definition.transformParams(data),
    [definition],
  );

  const submitParams = useCallback(
    async (params: Record<string, unknown>) => {
      await submit(params);
    },
    [submit],
  );

  const previewOrSubmit = useCallback(
    async (params: Record<string, unknown>) => {
      await previewOrPassthrough(params, submit);
    },
    [previewOrPassthrough, submit],
  );

  const submitFormData = useCallback(
    async (data: TForm) => {
      await previewOrSubmit(transformParams(data));
    },
    [previewOrSubmit, transformParams],
  );

  return {
    form,
    serviceName: definition.serviceName,
    displayName: definition.displayName,
    isSubmitting,
    rerunData,
    jobParamsDialogProps: dialogProps,
    transformParams,
    submitParams,
    previewOrSubmit,
    submitFormData,
  };
}
