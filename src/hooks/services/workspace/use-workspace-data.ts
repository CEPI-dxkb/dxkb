"use client";

import { useMemo } from "react";
import { useWorkspaceBrowser } from "@/hooks/services/workspace/use-workspace-browser";
import {
  useSharedWithUser,
  useUserWorkspaces,
  useWorkspaceListByPath,
  useWorkspaceGet,
  useWorkspacePermissions,
} from "@/hooks/services/workspace/use-shared-with-user";
import type { ListPermissionsResult } from "@/lib/services/workspace/shared";
import type { WorkspaceBrowserItem, WorkspaceViewMode } from "@/types/workspace-browser";

export interface UseWorkspaceDataOptions {
  mode: WorkspaceViewMode;
  username: string;
  path: string;
  fullPath: string;
  currentUser: string;
  isJobResultView: boolean;
  isAtSharedRoot: boolean;
  initialSharedItems?: WorkspaceBrowserItem[];
  initialPathItems?: WorkspaceBrowserItem[];
  initialPermissions?: ListPermissionsResult;
}

export interface UseWorkspaceDataReturn {
  items: WorkspaceBrowserItem[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => void;
  memberCountByPath: Record<string, number> | undefined;
  currentDirPermissions: ListPermissionsResult | undefined;
}

export function useWorkspaceData({
  mode,
  username,
  path,
  fullPath,
  currentUser,
  isJobResultView,
  isAtSharedRoot,
  initialSharedItems,
  initialPathItems,
  initialPermissions,
}: UseWorkspaceDataOptions): UseWorkspaceDataReturn {
  const isHome = mode === "home";

  const homeQuery = useWorkspaceBrowser({
    username,
    path,
    enabled: isHome && !!currentUser && !isJobResultView,
  });

  const sharedQuery = useSharedWithUser({
    username: currentUser,
    enabled: !isHome && isAtSharedRoot && !!currentUser,
    initialData: !isHome && isAtSharedRoot ? initialSharedItems : undefined,
  });

  const userWorkspacesQuery = useUserWorkspaces({
    username: currentUser,
    enabled: !isHome && isAtSharedRoot && !!currentUser,
  });

  const pathQuery = useWorkspaceListByPath({
    fullPath,
    enabled: !isHome && !isAtSharedRoot && !!fullPath && !isJobResultView,
    initialData: !isHome && !isAtSharedRoot ? initialPathItems : undefined,
  });

  useWorkspaceGet({
    objectPaths: !isHome && !isAtSharedRoot && fullPath ? [fullPath] : [],
    enabled: !isHome && !isAtSharedRoot && !!fullPath,
  });

  const currentDirPermsQuery = useWorkspacePermissions({
    paths: !isHome && !isAtSharedRoot && fullPath ? [fullPath] : [],
    enabled: !isHome && !isAtSharedRoot && !!fullPath,
  });

  const rootItems = useMemo(() => {
    if (isHome || !isAtSharedRoot) return [];
    const shared = sharedQuery.data ?? [];
    const userData = userWorkspacesQuery.data ?? [];
    const byPath = new Map<string, WorkspaceBrowserItem>();
    for (const item of [...userData, ...shared]) {
      if (!byPath.has(item.path)) byPath.set(item.path, item);
    }
    return Array.from(byPath.values());
  }, [isHome, isAtSharedRoot, sharedQuery.data, userWorkspacesQuery.data]);

  const items = useMemo(
    () =>
      isHome
        ? (homeQuery.data ?? [])
        : isAtSharedRoot
          ? rootItems
          : (pathQuery.data ?? []),
    [isHome, isAtSharedRoot, homeQuery.data, rootItems, pathQuery.data],
  );

  const itemPaths = useMemo(() => items.map((i) => i.path), [items]);

  const permissionsQuery = useWorkspacePermissions({
    paths: itemPaths,
    enabled: !isHome && itemPaths.length > 0,
    initialData: !isHome ? initialPermissions : undefined,
  });

  const memberCountByPath = useMemo(() => {
    if (isHome) return undefined;
    const perms = permissionsQuery.data;
    if (!perms) return undefined;
    const out: Record<string, number> = {};
    for (const pathEntry of itemPaths) {
      const list = perms[pathEntry];
      out[pathEntry] = Array.isArray(list) ? list.length : 0;
    }
    return out;
  }, [isHome, permissionsQuery.data, itemPaths]);

  const isLoading = isHome
    ? homeQuery.isLoading
    : isAtSharedRoot
      ? sharedQuery.isLoading || userWorkspacesQuery.isLoading
      : pathQuery.isLoading;

  const error = isHome
    ? homeQuery.error
    : isAtSharedRoot
      ? (sharedQuery.error ?? userWorkspacesQuery.error)
      : pathQuery.error;

  const refetch = isHome
    ? homeQuery.refetch
    : isAtSharedRoot
      ? () => {
          void sharedQuery.refetch();
          void userWorkspacesQuery.refetch();
        }
      : pathQuery.refetch;

  const isFetching = isHome
    ? homeQuery.isFetching
    : isAtSharedRoot
      ? sharedQuery.isFetching || userWorkspacesQuery.isFetching
      : pathQuery.isFetching;

  return {
    items,
    isLoading,
    isFetching,
    error,
    refetch,
    memberCountByPath,
    currentDirPermissions: currentDirPermsQuery.data,
  };
}
