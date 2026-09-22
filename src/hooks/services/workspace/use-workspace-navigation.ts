"use client";

import type { WorkspaceItem } from "@/lib/services/workspace/domain";
import type { WorkspaceViewMode } from "@/types/workspace-browser";
import { isFolderType } from "@/lib/services/workspace/utils";
import { workspaceItemDestination } from "@/lib/services/workspace/path-utils";

export interface UseWorkspaceNavigationOptions {
  mode: WorkspaceViewMode;
  username: string;
  path: string;
  basePath?: string;
  router: { push: (url: string) => void };
  clearSelection: () => void;
}

export function useWorkspaceNavigation({
  mode,
  username,
  path,
  basePath,
  router,
  clearSelection,
}: UseWorkspaceNavigationOptions) {
  const navigateToItem = (item: WorkspaceItem) => {
    router.push(
      workspaceItemDestination({ mode, username, path, basePath }, item),
    );
    clearSelection();
  };

  const handleItemDoubleClick = (item: WorkspaceItem) => {
    if (item.type === "job_result") {
      navigateToItem(item);
      return;
    }
    if (!isFolderType(item.type)) return;
    navigateToItem(item);
  };

  return {
    navigateToItem,
    handleItemDoubleClick,
  };
}
