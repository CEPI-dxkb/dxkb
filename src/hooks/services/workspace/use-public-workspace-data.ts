"use client";

import { useQuery } from "@tanstack/react-query";
import {
  listPublicWorkspaces,
  listUserPublicWorkspaces,
  listPublicWorkspacePath,
} from "@/lib/services/workspace/public-client";
import type { WorkspaceBrowserItem } from "@/types/workspace-browser";

export type PublicWorkspaceLevel = "root" | "user" | "path";

export interface UsePublicWorkspaceDataOptions {
  level: PublicWorkspaceLevel;
  username?: string;
  fullPath?: string;
}

export interface UsePublicWorkspaceDataReturn {
  items: WorkspaceBrowserItem[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => void;
}

const emptyItems: WorkspaceBrowserItem[] = [];

function buildQueryConfig(level: PublicWorkspaceLevel, username?: string, fullPath?: string) {
  switch (level) {
    case "root":
      return { queryKey: ["workspace-public-root"], queryFn: listPublicWorkspaces, enabled: true };
    case "user":
      return { queryKey: ["workspace-public-user", username], queryFn: () => listUserPublicWorkspaces(username ?? ""), enabled: !!username };
    case "path":
      return { queryKey: ["workspace-public-path", fullPath], queryFn: () => listPublicWorkspacePath(fullPath ?? ""), enabled: !!fullPath };
  }
}

export function usePublicWorkspaceData({
  level,
  username,
  fullPath,
}: UsePublicWorkspaceDataOptions): UsePublicWorkspaceDataReturn {
  const config = buildQueryConfig(level, username, fullPath);

  const query = useQuery<WorkspaceBrowserItem[], Error>({
    ...config,
    staleTime: 2 * 60 * 1000,
  });

  return {
    items: query.data ?? emptyItems,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
