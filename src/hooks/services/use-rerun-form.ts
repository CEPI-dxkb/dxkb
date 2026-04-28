"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  buildPairedLibraries,
  buildSingleLibraries,
  buildSraLibraries,
} from "@/lib/rerun-utility";
import { apiFetch } from "@/lib/auth/fetch";
import type { UserProfile } from "@/lib/auth/types";
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

/**
 * Read rerun_key from the URL and pull the matching JSON blob from sessionStorage.
 * Private primitive — use useRerunForm instead.
 *
 * The read is idempotent: the sessionStorage entry is left in place rather
 * than consumed at read time. `<AuthBoundary>` wraps every page in a Suspense
 * whose fallback is the same children, so the form can mount twice during
 * client hydration when `useSearchParams` suspends — once under the fallback,
 * once under the resolved tree. A consume-on-read here would empty
 * sessionStorage on the first mount and leave the second mount staring at
 * `null`, dropping every pre-fill. `useRerunForm`'s `rerunApplied` ref handles
 * one-shot application within a single mount; cross-mount idempotence is
 * fine because `setFieldValue` with the same value is a no-op for TanStack
 * Form. Stranded entries are scoped to the tab's sessionStorage and keyed by
 * a fresh 8-char UUID per rerun, so they don't collide and they evaporate on
 * tab close.
 */
function useRerunData<T extends Record<string, unknown>>(): T | null {
  const [rerunData] = useState<T | null>(() => {
    if (typeof window === "undefined") return null;
    const key = new URLSearchParams(window.location.search).get("rerun_key");
    if (!key) return null;
    const stored = sessionStorage.getItem(key);
    if (!stored) return null;
    try {
      return JSON.parse(stored) as T;
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

/**
 * Declarative form pre-fill hook.
 *
 * On mount, reads `?rerun_key=` from the URL, fetches the matching sessionStorage blob, and:
 *   1. Copies declared `fields` from rerunData onto the form (via setFieldValue, when defined)
 *   2. Reconstructs declared `libraries` via the shared builders (passes `getLibraryExtra(lib, kind)`)
 *   3. Calls `syncLibraries(libs)` with the aggregated array if libraries are declared
 *   4. Invokes `onApply(rerunData, form, libs)` for custom logic (taxonomy fetches, branching flows)
 *
 * When no rerun data is present, pre-fills `output_path` from the user's `default_job_folder` profile
 * setting. Pass `defaultOutputPath: null` to opt out.
 */
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

  const rerunData = useRerunData<T>();
  const rerunApplied = useRef(false);
  const defaultPathApplied = useRef(false);

  const { data: profile } = useQuery<UserProfile>({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const res = await apiFetch("/api/auth/profile");
      if (!res.ok) throw new Error("Failed to load profile");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    enabled: defaultOutputPath !== null && !rerunData,
  });
  const defaultJobFolder = profile?.settings?.default_job_folder;

  // The `rerunApplied` ref enforces one-shot execution, so only `rerunData`
  // matters as a trigger. Callers pass inline arrays/callbacks (fields, libraries,
  // getLibraryExtra, syncLibraries, onApply) that change identity every render —
  // including them as deps would re-schedule this effect on every parent render
  // for no benefit. The closure captures the latest values when the effect fires.
  useEffect(() => {
    if (!rerunData || rerunApplied.current) return;
    rerunApplied.current = true;

    if (fields) {
      for (const field of fields) {
        const value = rerunData[field];
        if (value !== undefined) {
          const formField = field as ServiceFormField<TForm>;
          form.setFieldValue(formField, value as TForm[typeof formField]);
        }
      }
    }

    let builtLibs: Library[] = [];
    if (libraries && libraries.length > 0) {
      builtLibs = libraries.flatMap((kind) =>
        libraryBuilders[kind](
          rerunData,
          getLibraryExtra ? (lib) => getLibraryExtra(lib, kind) : undefined,
        ),
      );
      if (builtLibs.length > 0) {
        if (syncLibraries) {
          syncLibraries(builtLibs);
        } else {
          console.warn(
            "[useRerunForm] libraries were configured but syncLibraries is missing; built libraries were not applied.",
          );
        }
      }
    }

    onApply?.(rerunData, form, builtLibs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
