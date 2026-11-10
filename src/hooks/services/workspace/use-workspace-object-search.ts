"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  toWorkspaceObject,
  type WorkspaceItem,
} from "@/lib/services/workspace/domain";
import type { WorkspaceObject } from "@/lib/services/workspace/types";
import { useWorkspaceRepository } from "@/contexts/workspace-repository-context";
import { workspaceQueryKeys } from "@/lib/services/workspace/workspace-query-keys";

export interface UseWorkspaceObjectSearchOptions {
  username: string;
  path?: string;
  /** Sent as the listing's type filter; each distinct type set is its own query. */
  types?: string[];
  autoLoad?: boolean;
}

export interface UseWorkspaceObjectSearchReturn {
  items: WorkspaceItem[];
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

const emptyItems: WorkspaceItem[] = [];

export function assertUniqueWorkspaceObjectPaths(
  items: WorkspaceItem[],
): WorkspaceItem[] {
  const paths = new Set<string>();
  for (const item of items) {
    if (!item.path) {
      throw new Error(
        `Workspace search returned an object without a path: ${item.id}`,
      );
    }
    if (paths.has(item.path)) {
      throw new Error(
        `Workspace search returned duplicate object path: ${item.path}`,
      );
    }
    paths.add(item.path);
  }
  return items;
}

export function useWorkspaceObjectSearch({
  username,
  path = "/home/",
  types,
  autoLoad = true,
}: UseWorkspaceObjectSearchOptions): UseWorkspaceObjectSearchReturn {
  const repository = useWorkspaceRepository("authenticated");
  const [searchQuery, setSearchQuery] = useState("");

  // No types or an empty list share the untyped query, so the request must send no filter.
  const typeFilter = types?.length ? types : undefined;
  const typesKey = typeFilter ? JSON.stringify([...typeFilter].sort()) : "";

  const query = useQuery<WorkspaceItem[]>({
    queryKey: workspaceQueryKeys.search(username, path, typesKey),
    queryFn: async () =>
      assertUniqueWorkspaceObjectPaths(
        await repository.searchObjects({ username, path, types: typeFilter }),
      ),
    enabled: autoLoad && !!username,
    staleTime: 5 * 60 * 1000,
  });

  const items = query.data ?? emptyItems;
  const objects = items.map(toWorkspaceObject);
  const term = searchQuery.trim().toLowerCase();
  const filteredItems = term
    ? items.filter((item) => item.name.toLowerCase().includes(term))
    : items;
  const filteredObjects = filteredItems.map(toWorkspaceObject);

  const search = (q: string) => {
    setSearchQuery(q);
  };
  const clearSearch = () => {
    setSearchQuery("");
  };
  const refresh = async () => {
    await query.refetch();
  };

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
