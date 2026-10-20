"use client";

import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { EnsureUserWorkspaceResult } from "@/lib/services/workspace/setup";
import { isWorkspaceHomeMissing } from "@/lib/services/workspace/workspace-errors";
import { workspaceQueryKeys } from "@/lib/services/workspace/workspace-query-keys";

export interface UseEnsureUserWorkspaceOptions {
  /** True only when the user is looking at their own home (path C target). */
  enabled: boolean;
  /** The user whose home this is; the once-per-session guard is per user. */
  userKey: string;
  /** Error from the directory query — used to detect "User lacks permission". */
  listError: Error | null;
  /** True when the home listing loaded without error and has no items. */
  homeAppearsEmpty: boolean;
}

export interface UseEnsureUserWorkspaceResult {
  /**
   * Run this user's setup again if its last attempt failed and the home
   * still looks missing. For the listing's Retry: remounts never re-run it.
   */
  retrySetup: () => void;
}

/**
 * Users whose setup already ran in this page session, successful or not.
 * Module-level rather than a ref: the browser remounts on every visit to
 * home, and a per-mount flag re-sent the request (a ~30 s chain of writes)
 * on each one during an outage.
 */
const attemptedUsers = new Set<string>();
/** Of those, the users whose last attempt failed: only Retry runs it again. */
const failedUsers = new Set<string>();

function shouldFire(
  listError: Error | null,
  homeAppearsEmpty: boolean,
): boolean {
  if (listError) return isWorkspaceHomeMissing(listError);
  return homeAppearsEmpty;
}

/**
 * Reactive workspace setup. When the workspace browser sees that a user's
 * home is missing ("User lacks permission") or loaded empty, POST
 * `/api/auth/ensure-workspace` at most once per user per page session (a
 * failed one runs again only through `retrySetup`), and refetch workspace
 * queries only when folders were actually created. Any other listing failure (an
 * outage) never triggers it. Silent: no toast; a failure leaves the
 * listing's own error in place.
 */
export function useEnsureUserWorkspace(
  options: UseEnsureUserWorkspaceOptions,
): UseEnsureUserWorkspaceResult {
  const { enabled, userKey, listError, homeAppearsEmpty } = options;
  const queryClient = useQueryClient();

  // A no-op (everything already existed) changes nothing to refetch.
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
        // An incomplete setup (a 502) can still have created the home: the
        // listing's "missing home" error is stale either way.
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

  // Called directly: the effect's inputs may not change on a Retry. During
  // an outage `shouldFire` is false, so a Retry sends no writes.
  const retrySetup = () => {
    if (!failedUsers.has(userKey)) return;
    if (!enabled || !shouldFire(listError, homeAppearsEmpty)) return;
    failedUsers.delete(userKey);
    mutate(userKey);
  };

  return { retrySetup };
}
