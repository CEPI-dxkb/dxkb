"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceRepository } from "@/contexts/workspace-repository-context";
import { useRecentWorkspaceFolders } from "@/hooks/use-recent-workspace-folders";
import type { WorkspaceItem } from "@/lib/services/workspace/domain";
import { loadFavorites } from "@/lib/services/workspace/favorites";
import {
  folderStubItems,
  listingSourceFor,
  stubsNeedWorkspaces,
  type PickerLocation,
} from "@/lib/services/workspace/picker-views";
import { workspaceQueryKeys } from "@/lib/services/workspace/workspace-query-keys";

export interface WorkspacePickerListing {
  /** Unfiltered rows for the location; the picker filters and sorts them. */
  items: WorkspaceItem[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Rows for one picker location. Directories (and the `/` root behind Shared
 * and Public) share the mini browser's cache keys; favorites share the
 * navbar's; recent folders come from browser storage. Favorite and recent
 * rows outside the user's own workspaces take their permissions from the `/`
 * listing, so a writable shared folder can be chosen from them.
 */
export function useWorkspacePickerListing({
  location,
  username,
}: {
  location: PickerLocation;
  username: string;
}): WorkspacePickerListing {
  const repository = useWorkspaceRepository("authenticated");
  const source = listingSourceFor(location, username);
  const directoryPath =
    source.kind === "directory"
      ? source.path
      : source.kind === "root"
        ? "/"
        : null;

  const directoryQuery = useQuery({
    queryKey: workspaceQueryKeys.miniBrowser(directoryPath ?? ""),
    queryFn: () => repository.listDirectory({ path: directoryPath ?? "/" }),
    enabled: directoryPath !== null && !!username,
    staleTime: 60 * 1000,
  });
  const favoritesQuery = useQuery({
    queryKey: workspaceQueryKeys.favorites(username),
    queryFn: () => loadFavorites(username),
    enabled: source.kind === "favorites" && !!username,
    staleTime: 2 * 60 * 1000,
  });
  const recentFolders = useRecentWorkspaceFolders(username || undefined);
  const stubPaths =
    source.kind === "favorites"
      ? (favoritesQuery.data ?? [])
      : source.kind === "recent"
        ? recentFolders.map((folder) => folder.path)
        : [];
  const workspacesQuery = useQuery({
    queryKey: workspaceQueryKeys.miniBrowser("/"),
    queryFn: () => repository.listDirectory({ path: "/" }),
    enabled: !!username && stubsNeedWorkspaces(stubPaths, username),
    staleTime: 60 * 1000,
  });

  switch (source.kind) {
    case "favorites":
    case "recent":
      return {
        items: folderStubItems(stubPaths, workspacesQuery.data),
        // Rows wait for their permissions rather than flash as read-only.
        isLoading: favoritesQuery.isLoading || workspacesQuery.isLoading,
        error: favoritesQuery.error ?? workspacesQuery.error,
      };
    default:
      return {
        items: directoryQuery.data ?? [],
        isLoading: directoryQuery.isLoading,
        error: directoryQuery.error,
      };
  }
}
