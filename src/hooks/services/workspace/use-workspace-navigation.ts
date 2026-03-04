"use client";

import { useCallback } from "react";
import type { WorkspaceBrowserItem, WorkspaceViewMode } from "@/types/workspace-browser";
import { isFolderType } from "@/lib/services/workspace/utils";
import { encodeWorkspaceSegment, sanitizePathSegment } from "@/lib/utils";

export interface UseWorkspaceNavigationOptions {
  mode: WorkspaceViewMode;
  username: string;
  path: string;
  router: { push: (url: string) => void };
  clearSelection: () => void;
}

export function useWorkspaceNavigation({
  mode,
  username,
  path,
  router,
  clearSelection,
}: UseWorkspaceNavigationOptions) {
  const isHome = mode === "home";

  const navigateToItem = useCallback(
    (item: WorkspaceBrowserItem) => {
      if (isHome) {
        const segments = path
          ? path.split("/").map(sanitizePathSegment).filter(Boolean)
          : [];
        segments.push(sanitizePathSegment(item.name));
        const encoded = segments.map(encodeWorkspaceSegment).join("/");
        const homeBase = `/workspace/${encodeWorkspaceSegment(username)}/home`;
        router.push(`${homeBase}/${encoded}`);
      } else {
        const segments = item.path
          .replace(/^\//, "")
          .split("/")
          .map(sanitizePathSegment)
          .filter(Boolean);
        const encoded = segments.map(encodeWorkspaceSegment).join("/");
        router.push(`/workspace/${encoded}`);
      }
      clearSelection();
    },
    [isHome, path, username, router, clearSelection],
  );

  const handleItemDoubleClick = useCallback(
    (item: WorkspaceBrowserItem) => {
      if (item.type === "job_result") {
        navigateToItem(item);
        return;
      }
      if (!isFolderType(item.type)) return;
      navigateToItem(item);
    },
    [navigateToItem],
  );

  return {
    navigateToItem,
    handleItemDoubleClick,
  };
}
