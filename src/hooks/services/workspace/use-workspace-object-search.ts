"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  toWorkspaceObject,
  type WorkspaceItem,
} from "@/lib/services/workspace/domain";
import type { WorkspaceObject } from "@/lib/services/workspace/types";
import { useWorkspaceRepository } from "@/contexts/workspace-repository-context";
import { workspaceQueryKeys } from "@/lib/services/workspace/workspace-query-keys";

export interface UseWorkspaceObjectSearchOptions {
  /** Workspace owner (e.g. "alice" or "alice@bvbrc"). */
  username: string;
  /** Subpath under the workspace root (default "/home/"). */
  path?: string;
  /** Restrict search to these types. */
  types?: string[];
  /** Whether the query should run. Defaults to true. */
  autoLoad?: boolean;
}

export interface UseWorkspaceObjectSearchReturn {
  items: WorkspaceItem[];
  /** Legacy shape for migration. Will be removed with the old selector. */
  objects: WorkspaceObject[];
  filteredItems: WorkspaceItem[];
  filteredObjects: WorkspaceObject[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  search: (query: string) => void;
  clearSearch: () => void;
  refresh: () => Promise<void>;
}

/**
 * Workspace object search hook used by `WorkspaceObjectSelector`. Hits the
 * repository (not the old singleton `WorkspaceApi` class) so tests and stories
 * can supply fixtures via `WorkspaceRepositoryProvider`.
 */
export function useWorkspaceObjectSearch({
  username,
  path = "/home/",
  types,
  autoLoad = true,
}: UseWorkspaceObjectSearchOptions): UseWorkspaceObjectSearchReturn {
  const repository = useWorkspaceRepository("authenticated");
  const [searchQuery, setSearchQuery] = useState("");

  const typesKey = types ? JSON.stringify([...types].sort()) : "";

  const query = useQuery<WorkspaceItem[], Error>({
    queryKey: workspaceQueryKeys.search(username, path, typesKey),
    queryFn: () => repository.searchObjects({ username, path, types }),
    enabled: autoLoad && !!username,
    staleTime: 5 * 60 * 1000,
  });

  const items = useMemo(() => query.data ?? [], [query.data]);
  const objects = useMemo(() => items.map(toWorkspaceObject), [items]);

  const filteredItems = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => item.name.toLowerCase().includes(term));
  }, [items, searchQuery]);

  const filteredObjects = useMemo(
    () => filteredItems.map(toWorkspaceObject),
    [filteredItems],
  );

  const search = useCallback((q: string) => setSearchQuery(q), []);
  const clearSearch = useCallback(() => setSearchQuery(""), []);
  const refresh = useCallback(async () => {
    await query.refetch();
  }, [query]);

  return {
    items,
    objects,
    filteredItems,
    filteredObjects,
    loading: query.isLoading || query.isRefetching,
    error: query.error?.message ?? null,
    searchQuery,
    setSearchQuery,
    search,
    clearSearch,
    refresh,
  };
}
