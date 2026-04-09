"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

import { useAuthenticatedFetch } from "@/hooks/use-authenticated-fetch-client";
import type { UserProfile } from "@/lib/auth/types";

interface FormLike {
  getFieldValue(field: "output_path"): string | undefined;
  setFieldValue(field: "output_path", value: never): void;
}

/**
 * Pre-populates the `output_path` form field with the user's
 * `default_job_folder` profile setting.
 *
 * Skips when rerun data is present (rerun values take priority)
 * or when the field has already been set by the user.
 */
export function useDefaultOutputPath(
  form: FormLike,
  rerunData: Record<string, unknown> | null,
): void {
  const authenticatedFetch = useAuthenticatedFetch();
  const applied = useRef(false);

  const { data: profile } = useQuery<UserProfile>({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const res = await authenticatedFetch("/api/auth/profile");
      if (!res.ok) throw new Error("Failed to load profile");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const defaultJobFolder = profile?.settings?.default_job_folder;

  useEffect(() => {
    if (applied.current) return;
    if (!defaultJobFolder) return;
    if (rerunData) return;

    const currentValue = form.getFieldValue("output_path") ?? "";
    if (currentValue !== "") return;

    applied.current = true;
    form.setFieldValue("output_path", defaultJobFolder as never);
  }, [defaultJobFolder, rerunData, form]);
}
