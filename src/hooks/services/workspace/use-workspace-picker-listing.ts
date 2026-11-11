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
  items: WorkspaceItem[];
  isLoading: boolean;
  error: Error | null;
}

/** Rows for one picker location; favorite and recent rows outside the user's own workspaces take their permissions from the `/` listing. */
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
  const readsFavorites = source.kind === "favorites" && !!username;
  const favoritesQuery = useQuery({
    queryKey: workspaceQueryKeys.favorites(username),
    queryFn: () => loadFavorites(username),
    enabled: readsFavorites,
    staleTime: 2 * 60 * 1000,
  });
  const recentFolders = useRecentWorkspaceFolders(username || undefined);
  const stubPaths =
    source.kind === "favorites"
      ? (favoritesQuery.data ?? [])
      : source.kind === "recent"
        ? recentFolders.map((folder) => folder.path)
        : [];
  const readsWorkspaces =
    !!username && stubsNeedWorkspaces(stubPaths, username);
  const workspacesQuery = useQuery({
    queryKey: workspaceQueryKeys.miniBrowser("/"),
    queryFn: () => repository.listDirectory({ path: "/" }),
    enabled: readsWorkspaces,
    staleTime: 60 * 1000,
  });
  // A disabled query still reports its shared cache entry, so only the reads this listing depends on may make it load or fail.
  const favorites = readsFavorites ? favoritesQuery : null;
  const workspaces = readsWorkspaces ? workspacesQuery : null;

  switch (source.kind) {
    case "favorites":
    case "recent":
      return {
        items: folderStubItems(stubPaths, workspacesQuery.data),
        isLoading: !!favorites?.isLoading || !!workspaces?.isLoading,
        error: favorites?.error ?? workspaces?.error ?? null,
      };
    default:
      return {
        items: directoryQuery.data ?? [],
        isLoading: directoryQuery.isLoading,
        error: directoryQuery.error,
      };
  }
}
