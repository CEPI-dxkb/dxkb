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
import type { Library } from "@/types/services";

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

export interface ServiceRuntime<TForm> {
  isSubmitting: boolean;
  jobParamsDialogProps: JobParamsDialogProps;
  previewOrSubmit(params: Record<string, unknown>): Promise<void>;
  submitFormData(data: TForm): Promise<void>;
}

function mergeServiceRerunConfig<TForm, TRerun extends Record<string, unknown>>(
  definitionRerun: ServiceRerunConfig<TForm, TRerun> | undefined,
  overrideRerun: ServiceRerunConfig<TForm, TRerun> | undefined,
): ServiceRerunConfig<TForm, TRerun> {
  const fields = overrideRerun?.fields ?? definitionRerun?.fields;
  const definitionOnApply = definitionRerun?.onApply;
  const overrideOnApply = overrideRerun?.onApply;
  const onApply =
    definitionOnApply && overrideOnApply
      ? (
          rerunData: TRerun,
          form: ServiceFormApi<TForm>,
          libraries: Library[],
        ) => {
          definitionOnApply(rerunData, form, libraries);
          overrideOnApply(rerunData, form, libraries);
        }
      : (overrideOnApply ?? definitionOnApply);
  const hasDefaultOutputPath =
    (overrideRerun && "defaultOutputPath" in overrideRerun) ||
    (definitionRerun && "defaultOutputPath" in definitionRerun);

  const base = {
    ...(fields ? { fields } : {}),
    ...(onApply ? { onApply } : {}),
    ...(hasDefaultOutputPath ? { defaultOutputPath: null } : {}),
  };

  // Library-family fields travel as a bundle — the discriminated
  // `ServiceRerunConfig` union requires `libraries` to be present alongside
  // its siblings, so keep the two branches explicit.
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
}: UseServiceRuntimeOptions<TForm, TRerun, TFormApi>): ServiceRuntime<TForm> {
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

  useRerunForm<TRerun, TForm>({
    ...mergedRerun,
    form: form as unknown as ServiceFormApi<TForm>,
  });

  const previewOrSubmit = useCallback(
    async (params: Record<string, unknown>) => {
      await previewOrPassthrough(params, submit);
    },
    [previewOrPassthrough, submit],
  );

  const submitFormData = useCallback(
    async (data: TForm) => {
      await previewOrSubmit(definition.transformParams(data));
    },
    [definition, previewOrSubmit],
  );

  return {
    isSubmitting,
    jobParamsDialogProps: dialogProps,
    previewOrSubmit,
    submitFormData,
  };
}
