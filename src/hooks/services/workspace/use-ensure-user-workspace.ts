"use client";

import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { EnsureUserWorkspaceResult } from "@/lib/services/workspace/setup";
import { isWorkspaceHomeMissing } from "@/lib/services/workspace/workspace-errors";
import { workspaceQueryKeys } from "@/lib/services/workspace/workspace-query-keys";

export interface UseEnsureUserWorkspaceOptions {
  enabled: boolean;
  userKey: string;
  listError: Error | null;
  homeAppearsEmpty: boolean;
}

export interface UseEnsureUserWorkspaceResult {
  /** Runs setup again if its last attempt failed; remounts never re-run it. */
  retrySetup: () => void;
}

// Module-level so remounts do not re-send the setup request.
const attemptedUsers = new Set<string>();
const failedUsers = new Set<string>();

function shouldFire(
  listError: Error | null,
  homeAppearsEmpty: boolean,
): boolean {
  if (listError) return isWorkspaceHomeMissing(listError);
  return homeAppearsEmpty;
}

/** Creates a missing home at most once per user per page session; a failed attempt runs again only through `retrySetup`. Silent. */
export function useEnsureUserWorkspace(
  options: UseEnsureUserWorkspaceOptions,
): UseEnsureUserWorkspaceResult {
  const { enabled, userKey, listError, homeAppearsEmpty } = options;
  const queryClient = useQueryClient();

  const refetchIfCreated = (created: unknown) => {
    if (!Array.isArray(created) || created.length === 0) return;
    void queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.all });
  };

  const { mutate } = useMutation({
    mutationFn: async (_user: string): Promise<EnsureUserWorkspaceResult> => {
      const response = await fetch("/api/auth/ensure-workspace", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
          created?: unknown;
        };
        // An incomplete setup (502) can still have created the home.
        refetchIfCreated(body.created);
        throw new Error(
          body.error ??
            body.message ??
            `ensure-workspace failed (${String(response.status)})`,
        );
      }
      return response.json() as Promise<EnsureUserWorkspaceResult>;
    },
    onSuccess: (result) => {
      refetchIfCreated(result.created);
    },
    onError: (_error, user) => {
      failedUsers.add(user);
    },
  });

  useEffect(() => {
    if (!enabled || !userKey || attemptedUsers.has(userKey)) return;
    if (!shouldFire(listError, homeAppearsEmpty)) return;
    attemptedUsers.add(userKey);
    mutate(userKey);
  }, [enabled, userKey, listError, homeAppearsEmpty, mutate]);

  // Called directly: the effect's inputs may not change on a Retry.
  const retrySetup = () => {
    if (!failedUsers.has(userKey)) return;
    if (!enabled || !shouldFire(listError, homeAppearsEmpty)) return;
    failedUsers.delete(userKey);
    mutate(userKey);
  };

  return { retrySetup };
}
