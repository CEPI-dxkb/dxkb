/**
 * Pure item-derivation policy for the workspace mini-browser: root/path merge,
 * write-access filtering, folders-only mode, hidden-item filtering and
 * ordering.
 */

import type { WorkspaceItem } from "./domain";
import { hasWriteAccess } from "./helpers";
import { isFolder, isFolderType } from "./utils";

export type MiniBrowserMode = "folders-only" | "all";

export interface BuildMiniBrowserItemsInput {
  isAtRoot: boolean;
  userWorkspaces: WorkspaceItem[];
  shared: WorkspaceItem[];
  pathItems: WorkspaceItem[];
  mode: MiniBrowserMode;
  showHidden: boolean;
}

const nameCollator = new Intl.Collator(undefined, { sensitivity: "base" });

export function normalizePath(path: string | null | undefined): string {
  if (!path) return "/";
  const trimmed = path.replace(/\/+$/, "");
  return trimmed || "/";
}

/**
 * "/alice@bvbrc" -> "alice@bvbrc"; the realm is kept because it varies per
 * account.
 */
export function usernameFromWorkspaceRoot(workspaceRoot: string): string {
  return workspaceRoot.replace(/^\/+|\/+$/g, "").split("/")[0] ?? "";
}

/**
 * Deliberate asymmetry: `folders-only` filters with `isFolder` while the
 * folders-first sort uses the wider `isFolderType`, which keeps groups and job
 * results at the top in `mode: "all"`.
 */
export function buildMiniBrowserItems({
  isAtRoot,
  userWorkspaces,
  shared,
  pathItems,
  mode,
  showHidden,
}: BuildMiniBrowserItemsInput): WorkspaceItem[] {
  let items: WorkspaceItem[];
  if (isAtRoot) {
    const byPath = new Map<string, WorkspaceItem>();
    const sharedWithWriteAccess = shared.filter(hasWriteAccess);
    // First occurrence wins, so a user workspace shadows a shared entry at the
    // same path.
    for (const item of [...userWorkspaces, ...sharedWithWriteAccess]) {
      if (!byPath.has(item.path)) byPath.set(item.path, item);
    }
    items = Array.from(byPath.values());
  } else {
    items = pathItems;
  }

  if (mode === "folders-only") {
    items = items.filter((item) => isFolder(item.type));
  }
  if (!showHidden) {
    items = items.filter((item) => !item.name.startsWith("."));
  }

  return [...items].sort((a, b) => {
    const aFolder = isFolderType(a.type);
    const bFolder = isFolderType(b.type);
    if (aFolder !== bFolder) return aFolder ? -1 : 1;
    return nameCollator.compare(a.name, b.name);
  });
}
