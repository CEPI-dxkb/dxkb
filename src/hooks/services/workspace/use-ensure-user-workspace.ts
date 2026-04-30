"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { workspaceQueryKeys } from "@/lib/services/workspace/workspace-query-keys";

export interface UseEnsureUserWorkspaceOptions {
  /** True only when the user is looking at their own home (path C target). */
  enabled: boolean;
  /** Error from the directory query — used to detect "User lacks permission". */
  listError: Error | null;
  /** True when path is empty, items are empty, and not still loading. */
  homeAppearsEmpty: boolean;
}

const permissionErrorPattern = /user lacks permission/i;

function shouldFire(
  listError: Error | null,
  homeAppearsEmpty: boolean,
): boolean {
  if (listError && permissionErrorPattern.test(listError.message)) return true;
  return homeAppearsEmpty;
}

/**
 * Reactive workspace setup. When the workspace browser detects that a user's
 * home is missing or empty, POST `/api/auth/ensure-workspace` once per
 * session and invalidate the directory cache so the now-populated workspace
 * is fetched again. Silent: no toast, no UI affordance — the existing
 * skeleton/loading state covers the recovery window.
 */
export function useEnsureUserWorkspace(
  options: UseEnsureUserWorkspaceOptions,
): void {
  const { enabled, listError, homeAppearsEmpty } = options;
  const queryClient = useQueryClient();
  const firedRef = useRef(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/auth/ensure-workspace", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(
          body.message || `ensure-workspace failed (${response.status})`,
        );
      }
      return response.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.all });
    },
  });

  useEffect(() => {
    if (!enabled || firedRef.current) return;
    if (!shouldFire(listError, homeAppearsEmpty)) return;
    firedRef.current = true;
    mutation.mutate();
  }, [enabled, listError, homeAppearsEmpty, mutation]);
}
