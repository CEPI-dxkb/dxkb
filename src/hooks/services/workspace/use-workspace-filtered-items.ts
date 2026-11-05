"use client";

import { useMemo } from "react";
import { sortItems } from "@/lib/services/workspace/helpers";
import type { WorkspaceItem } from "@/lib/services/workspace/domain";
import type { WorkspaceSortConfig } from "@/types/workspace-browser";

export function useWorkspaceFilteredItems(
  items: WorkspaceItem[],
  options: {
    showHiddenFiles: boolean;
    typeFilter: string;
    searchQuery: string;
    sort: WorkspaceSortConfig;
  },
): WorkspaceItem[] {
  const { showHiddenFiles, typeFilter, searchQuery, sort } = options;
  const { field: sortField, direction: sortDirection } = sort;

  // Explicit memo: without a hook call the compiler skips this hook, and sortItems returns a new array each render.
  return useMemo(() => {
    let filtered = items;

    if (!showHiddenFiles) {
      filtered = filtered.filter((item) => {
        const name = item.name;
        const lastSegment = item.path.split("/").filter(Boolean).pop() ?? "";
        return !name.startsWith(".") && !lastSegment.startsWith(".");
      });
    }

    if (typeFilter !== "all") {
      filtered = filtered.filter((item) => item.type === typeFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((item) =>
        item.name.toLowerCase().includes(query),
      );
    }

    return sortItems(filtered, { field: sortField, direction: sortDirection });
  }, [
    items,
    showHiddenFiles,
    typeFilter,
    searchQuery,
    sortField,
    sortDirection,
  ]);
}
