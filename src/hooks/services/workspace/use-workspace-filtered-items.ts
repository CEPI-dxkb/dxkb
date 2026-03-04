"use client";

import { useMemo } from "react";
import { sortItems } from "@/lib/services/workspace/helpers";
import type { WorkspaceBrowserItem, WorkspaceBrowserSort } from "@/types/workspace-browser";

export function useWorkspaceFilteredItems(
  items: WorkspaceBrowserItem[],
  options: {
    showHiddenFiles: boolean;
    typeFilter: string;
    searchQuery: string;
    sort: WorkspaceBrowserSort;
  },
): WorkspaceBrowserItem[] {
  const { showHiddenFiles, typeFilter, searchQuery, sort } = options;

  return useMemo(() => {
    let filtered = items;

    if (!showHiddenFiles) {
      filtered = filtered.filter((item) => {
        const name = item.name ?? "";
        const lastSegment = item.path?.split("/").filter(Boolean).pop() ?? "";
        return !name.startsWith(".") && !lastSegment.startsWith(".");
      });
    }

    if (typeFilter !== "all") {
      filtered = filtered.filter((item) => item.type === typeFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((item) =>
        item.name?.toLowerCase().includes(query),
      );
    }

    return sortItems(filtered, sort);
  }, [items, showHiddenFiles, typeFilter, searchQuery, sort]);
}
