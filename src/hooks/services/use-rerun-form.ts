"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  buildPairedLibraries,
  buildSingleLibraries,
  buildSraLibraries,
} from "@/lib/rerun-utility";
import { apiFetch } from "@/lib/auth";
import type { UserProfile } from "@/lib/auth/types";
import type { Library } from "@/types/services";

type LibraryKind = "paired" | "single" | "sra";

interface TanstackFormLike {
  getFieldValue(field: string): unknown;
  setFieldValue(field: string, value: never): void;
}

interface UseRerunFormOptions<T extends Record<string, unknown>> {
  form: TanstackFormLike;
  fields?: readonly (keyof T & string)[];
  libraries?: readonly LibraryKind[];
  getLibraryExtra?: (
    lib: Record<string, string>,
    kind: LibraryKind,
  ) => Partial<Library>;
  syncLibraries?: (libs: Library[]) => void;
  onApply?: (
    rerunData: T,
    form: TanstackFormLike,
    libraries: Library[],
  ) => void;
  defaultOutputPath?: null;
}

/**
 * Read rerun_key from the URL and pull the matching JSON blob from sessionStorage.
 * Private primitive — use useRerunForm instead.
 */
function useRerunData<T extends Record<string, unknown>>(): T | null {
  const [rerunData] = useState<T | null>(() => {
    if (typeof window === "undefined") return null;
    const key = new URLSearchParams(window.location.search).get("rerun_key");
    if (!key) return null;
    const stored = sessionStorage.getItem(key);
    if (!stored) return null;
    sessionStorage.removeItem(key);
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
  LibraryKind,
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
 *
 * Constraint: if `libraries` is declared, `syncLibraries` must also be provided.
 */
export function useRerunForm<T extends Record<string, unknown>>(
  options: UseRerunFormOptions<T>,
): { rerunData: T | null } {
  const {
    form,
    fields,
    libraries,
    getLibraryExtra,
    syncLibraries,
    onApply,
    defaultOutputPath,
  } = options;

  if (libraries && libraries.length > 0 && !syncLibraries) {
    throw new Error(
      "useRerunForm: `syncLibraries` is required when `libraries` is declared",
    );
  }

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
        // `as never` matches tanstack-form's setFieldValue typing, which expects
        // a value whose type is derived from the field path. The field is declared in T.
        if (value !== undefined) form.setFieldValue(field, value as never);
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
      if (builtLibs.length > 0) syncLibraries?.(builtLibs);
    }

    onApply?.(rerunData, form, builtLibs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rerunData]);

  useEffect(() => {
    if (defaultOutputPath === null) return;
    if (defaultPathApplied.current) return;
    if (!defaultJobFolder) return;
    if (rerunData) return;

    const currentValue = form.getFieldValue("output_path") ?? "";
    if (currentValue !== "") return;

    defaultPathApplied.current = true;
    // `as never` — see comment in the rerun effect above.
    form.setFieldValue("output_path", defaultJobFolder as never);
  }, [defaultJobFolder, rerunData, form, defaultOutputPath]);

  return { rerunData };
}
