"use client";

import { useMemo } from "react";
import {
  toWorkspaceBrowserItem,
  toWorkspaceItem,
  type ListPermissionsResult,
  type WorkspaceItem,
} from "@/lib/services/workspace/domain";
import type { WorkspaceBrowserItem, WorkspaceViewMode } from "@/types/workspace-browser";
import {
  useWorkspaceDirectory,
  type WorkspaceDirectoryMode,
} from "./use-workspace-directory";

export interface UseWorkspaceBrowserDirectoryOptions {
  /** Browser view mode (maps to directory mode kinds). */
  mode: WorkspaceViewMode;
  /** Username from the URL segment. */
  username: string;
  /** Relative path under the workspace root. */
  path: string;
  /** Full path for shared/public modes (leading slash + path). */
  fullPath: string;
  /** Current user's login name. */
  currentUser: string;
  /** Whether the URL resolved to a job_result. */
  isJobResultView: boolean;
  /** Whether we're on the shared root (no path). */
  isAtSharedRoot: boolean;
  /** Whether we're viewing public workspaces. */
  isPublic: boolean;
  /** Public-mode inner level (root/user/path). */
  publicLevel: "root" | "user" | "path";
  /** Job-result dot-folder path when `isJobResultView` is true. */
  jobDotPath?: string;
  /** Path resolve already failed — skip the query. */
  pathResolveFailed?: boolean;
  /** Initial data from SSR / route prefetch. */
  initialSharedItems?: WorkspaceBrowserItem[];
  initialPathItems?: WorkspaceBrowserItem[];
  initialPermissions?: ListPermissionsResult;
}

export interface UseWorkspaceBrowserDirectoryReturn {
  items: WorkspaceBrowserItem[];
  canonicalItems: WorkspaceItem[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => void;
  memberCountByPath: Record<string, number> | undefined;
  currentDirPermissions: ListPermissionsResult | undefined;
}

function pickDirectoryMode(
  options: UseWorkspaceBrowserDirectoryOptions,
): WorkspaceDirectoryMode | null {
  const {
    mode,
    username,
    path,
    fullPath,
    currentUser,
    isJobResultView,
    isAtSharedRoot,
    isPublic,
    publicLevel,
    jobDotPath,
  } = options;

  if (isJobResultView) {
    if (!jobDotPath) return null;
    const dotPathNormalized = jobDotPath.startsWith("/") ? jobDotPath : `/${jobDotPath}`;
    return { kind: "jobResult", fullPath: dotPathNormalized, visiblePath: path };
  }
  if (isPublic) {
    if (publicLevel === "root" || !username) return { kind: "publicRoot" };
    if (publicLevel === "user") return { kind: "publicUser", username };
    return { kind: "publicPath", fullPath };
  }
  if (mode === "home") {
    if (!currentUser) return null;
    return { kind: "home", username, path };
  }
  // shared mode
  if (isAtSharedRoot) {
    if (!currentUser) return null;
    return { kind: "sharedRoot", currentUser };
  }
  if (!fullPath) return null;
  return { kind: "sharedPath", fullPath };
}

/**
 * Bridge hook that produces the legacy `WorkspaceBrowserItem[]` shape for the
 * existing `WorkspaceBrowser` + downstream table while internally using the
 * canonical `useWorkspaceDirectory` hook and repository.
 *
 * Remove once all consumers (table, selection, details panel) migrate off
 * `WorkspaceBrowserItem`.
 */
export function useWorkspaceBrowserDirectory(
  options: UseWorkspaceBrowserDirectoryOptions,
): UseWorkspaceBrowserDirectoryReturn {
  const directoryMode = pickDirectoryMode(options);
  const enabled = !!directoryMode && !options.pathResolveFailed;

  const initialItems = useMemo<WorkspaceItem[] | undefined>(() => {
    if (!directoryMode) return undefined;
    if (directoryMode.kind === "sharedRoot" && options.initialSharedItems) {
      return options.initialSharedItems.map(toWorkspaceItem);
    }
    if (directoryMode.kind === "sharedPath" && options.initialPathItems) {
      return options.initialPathItems.map(toWorkspaceItem);
    }
    return undefined;
  }, [directoryMode, options.initialSharedItems, options.initialPathItems]);

  const result = useWorkspaceDirectory(
    directoryMode ?? { kind: "publicRoot" },
    {
      enabled,
      initialItems,
      initialPermissions: options.initialPermissions,
    },
  );

  const items = useMemo(
    () => result.items.map(toWorkspaceBrowserItem),
    [result.items],
  );

  return {
    items,
    canonicalItems: result.items,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    error: result.error,
    refetch: result.refetch,
    memberCountByPath: result.memberCountByPath,
    currentDirPermissions: result.permissions,
  };
}
