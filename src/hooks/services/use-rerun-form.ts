"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

import {
  buildPairedLibraries,
  buildSingleLibraries,
  buildSraLibraries,
} from "@/lib/rerun-utility";
import { useAuth } from "@/lib/auth/provider";
import type {
  ServiceFormApi,
  ServiceFormField,
  ServiceLibraryKind,
  ServiceRerunConfig,
} from "@/lib/services/service-definition";
import type { Library } from "@/types/services";

type UseRerunFormOptions<
  TForm,
  T extends Record<string, unknown>,
> = ServiceRerunConfig<TForm, T> & {
  form: ServiceFormApi<TForm>;
};

/** Reads `rerun_key` from the URL and the matching sessionStorage blob. The entry stays in place: `<AuthBoundary>`'s Suspense fallback can mount the form twice during hydration, and a consuming read would empty the second mount. */
function useRerunData(): Record<string, unknown> | null {
  const [rerunData] = useState<Record<string, unknown> | null>(() => {
    if (typeof window === "undefined") return null;
    const key = new URLSearchParams(window.location.search).get("rerun_key");
    if (!key) return null;
    const stored = sessionStorage.getItem(key);
    if (!stored) return null;
    try {
      return JSON.parse(stored) as Record<string, unknown>;
    } catch {
      console.error(
        "[useRerunForm] Failed to parse rerun data from sessionStorage",
      );
      return null;
    }
  });
  return rerunData;
}

const libraryBuilders: Record<
  ServiceLibraryKind,
  (
    data: Record<string, unknown>,
    getExtra?: (lib: Record<string, string>) => Partial<Library>,
  ) => Library[]
> = {
  paired: buildPairedLibraries,
  single: buildSingleLibraries,
  sra: buildSraLibraries,
};

/** Declarative form pre-fill from `?rerun_key=`; with no rerun data, pre-fills `output_path` from `default_job_folder` (`defaultOutputPath: null` opts out). */
export function useRerunForm<
  T extends Record<string, unknown>,
  TForm = unknown,
>(options: UseRerunFormOptions<TForm, T>): { rerunData: T | null } {
  const {
    form,
    fields,
    libraries,
    getLibraryExtra,
    syncLibraries,
    onApply,
    defaultOutputPath,
  } = options;

  const rerunData = useRerunData() as T | null;
  const rerunApplied = useRef(false);
  const defaultPathApplied = useRef(false);

  const { user } = useAuth();
  const defaultJobFolder = user?.defaultJobFolder;

  // `rerunApplied` makes this one-shot, so only `rerunData` triggers it; callers' inline options change identity every render and are read through `optionsRef`.
  const optionsRef = useRef({
    fields,
    libraries,
    getLibraryExtra,
    syncLibraries,
    onApply,
    form,
  });
  useEffect(() => {
    optionsRef.current = {
      fields,
      libraries,
      getLibraryExtra,
      syncLibraries,
      onApply,
      form,
    };
  });

  const applyRerunData = useEffectEvent((data: T) => {
    const {
      fields: rerunFields,
      libraries: rerunLibs,
      getLibraryExtra: getExtra,
      syncLibraries: sync,
      onApply: applyHandler,
      form: formApi,
    } = optionsRef.current;

    if (rerunFields) {
      for (const field of rerunFields) {
        const value = data[field];
        if (value !== undefined) {
          const formField = field as ServiceFormField<TForm>;
          formApi.setFieldValue(formField, value as TForm[typeof formField]);
        }
      }
    }

    let builtLibs: Library[] = [];
    if (rerunLibs && rerunLibs.length > 0) {
      builtLibs = rerunLibs.flatMap((kind) =>
        libraryBuilders[kind](
          data,
          getExtra ? (lib) => getExtra(lib, kind) : undefined,
        ),
      );
      if (!sync) {
        console.warn(
          "[useRerunForm] libraries were configured but syncLibraries is missing; built libraries were not applied.",
        );
      } else if (builtLibs.length > 0) {
        sync(builtLibs);
      }
    }

    applyHandler?.(data, formApi, builtLibs);
  });

  useEffect(() => {
    if (!rerunData || rerunApplied.current) return;
    rerunApplied.current = true;
    applyRerunData(rerunData);
  }, [rerunData]);

  useEffect(() => {
    if (defaultOutputPath === null) return;
    if (defaultPathApplied.current) return;
    if (!defaultJobFolder) return;
    if (rerunData) return;

    const outputPathField = "output_path" as ServiceFormField<TForm>;
    const currentValue = form.getFieldValue(outputPathField) ?? "";
    if (currentValue !== "") return;

    defaultPathApplied.current = true;
    form.setFieldValue(
      outputPathField,
      defaultJobFolder as TForm[typeof outputPathField],
    );
  }, [defaultJobFolder, rerunData, form, defaultOutputPath]);

  return { rerunData };
}
