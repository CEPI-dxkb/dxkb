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
  /** Workspace owner (e.g. "alice" or "alice@bvbrc"). */
  username: string;
  /** Subpath under the workspace root (default "/home/"). */
  path?: string;
  /**
   * Restrict search to these types. Sent to the server as the listing's type
   * filter (an unfiltered recursive listing would return every job output
   * file), so each distinct type set is its own query; fields with the same
   * set share one.
   */
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

/**
 * Workspace object search hook used by `WorkspaceObjectSelector`. Hits the
 * repository so tests and stories can supply fixtures via
 * `WorkspaceRepositoryProvider`.
 */
export function useWorkspaceObjectSearch({
  username,
  path = "/home/",
  types,
  autoLoad = true,
}: UseWorkspaceObjectSearchOptions): UseWorkspaceObjectSearchReturn {
  const repository = useWorkspaceRepository("authenticated");
  const [searchQuery, setSearchQuery] = useState("");

  // No types, or an empty list, means every type, so both share the untyped
  // query and send no filter: whichever field fetches fills the cache for
  // the other, so the request must be the one the key names.
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
