"use client";

import { useCallback, useMemo } from "react";

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
  TFormApi,
> {
  definition: ServiceDefinition<TForm, TRerun>;
  form: TFormApi;
  onSuccess?: () => void;
  rerun?: ServiceRerunConfig<TForm, TRerun>;
}

export interface ServiceRuntime<
  TForm,
  TRerun extends Record<string, unknown>,
  TFormApi,
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

function mergeServiceRerunConfig<
  TForm,
  TRerun extends Record<string, unknown>,
>(
  definitionRerun: ServiceRerunConfig<TForm, TRerun> | undefined,
  overrideRerun: ServiceRerunConfig<TForm, TRerun> | undefined,
): ServiceRerunConfig<TForm, TRerun> {
  const fields = overrideRerun?.fields ?? definitionRerun?.fields;
  const onApply = overrideRerun?.onApply ?? definitionRerun?.onApply;
  const hasDefaultOutputPath =
    (overrideRerun && "defaultOutputPath" in overrideRerun) ||
    (definitionRerun && "defaultOutputPath" in definitionRerun);

  const base = {
    ...(fields ? { fields } : {}),
    ...(onApply ? { onApply } : {}),
    ...(hasDefaultOutputPath ? { defaultOutputPath: null } : {}),
  };

  if (overrideRerun?.libraries) {
    return {
      ...base,
      libraries: overrideRerun.libraries,
      getLibraryExtra: overrideRerun.getLibraryExtra,
      syncLibraries: overrideRerun.syncLibraries,
    };
  }

  if (definitionRerun?.libraries) {
    return {
      ...base,
      libraries: definitionRerun.libraries,
      getLibraryExtra: definitionRerun.getLibraryExtra,
      syncLibraries: definitionRerun.syncLibraries,
    };
  }

  return base;
}

export function useServiceRuntime<
  TForm,
  TRerun extends Record<string, unknown> = Record<string, unknown>,
  TFormApi = ServiceFormApi<TForm>,
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

  const mergedRerun = useMemo(
    () => mergeServiceRerunConfig(definition.rerun, rerun),
    [definition.rerun, rerun],
  );

  const { rerunData } = useRerunForm<TRerun, TForm>({
    ...mergedRerun,
    form: form as unknown as ServiceFormApi<TForm>,
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
