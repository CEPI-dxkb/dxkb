/**
 * Pure item-derivation policy for the workspace mini-browser.
 *
 * Extracted from `useMiniBrowserItems` in
 * `src/components/workspace/workspace-mini-browser.tsx` so the root/path
 * merge, write-access filtering, folders-only mode, hidden-item filtering and
 * ordering rules are directly testable without rendering the component or
 * standing up TanStack Query. The hook keeps repository selection and the
 * three queries; this module owns only what to show and in what order.
 */

import type { WorkspaceItem } from "./domain";
import { hasWriteAccess } from "./helpers";
import { isFolder, isFolderType } from "./utils";

export type MiniBrowserMode = "folders-only" | "all";

export interface BuildMiniBrowserItemsInput {
  /** True when the browser is sitting on the user's workspace root. */
  isAtRoot: boolean;
  /** Root listing of the current user's own workspaces (root mode only). */
  userWorkspaces: WorkspaceItem[];
  /** Root listing of workspaces shared with the user (root mode only). */
  shared: WorkspaceItem[];
  /** Listing of the current directory (non-root mode only). */
  pathItems: WorkspaceItem[];
  mode: MiniBrowserMode;
  showHidden: boolean;
}

/** Trim trailing slashes; empty/nullish paths collapse to "/". */
export function normalizePath(path: string | null | undefined): string {
  if (!path) return "/";
  const trimmed = path.replace(/\/+$/, "");
  return trimmed || "/";
}

/** "/alice@bvbrc" -> "alice". Used to key the root-level workspace queries. */
export function usernameFromWorkspaceRoot(workspaceRoot: string): string {
  return workspaceRoot.replace(/^\//, "").split("@")[0] ?? "";
}

/**
 * Note on the deliberate folder-predicate asymmetry below: `folders-only`
 * filters with `isFolder` (folder/directory/modelfolder), while the
 * folders-first sort uses the wider `isFolderType` (which also counts
 * job_result and the *_group types). This mirrors the pre-extraction hook
 * exactly and is not a bug to be tidied — in `mode: "all"` the wider predicate
 * is what keeps groups and job results grouped with folders at the top.
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
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}
