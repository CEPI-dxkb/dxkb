/**
 * Domain helpers for workspace path construction and write-access checks.
 * Extracted from `WorkspaceBrowser` so they can be tested without rendering
 * the whole component tree.
 */

import type { ListPermissionsResult, WorkspaceItem } from "./domain";
import { safeDecode } from "@/lib/url";

export interface WorkspacePathsInput {
  mode: "home" | "shared" | "public";
  username: string;
  /** Relative path under the workspace root (from the URL segment). */
  path: string;
  /** Current user's workspace root (e.g. "alice@bvbrc"). */
  myWorkspaceRoot: string;
}

export interface WorkspacePaths {
  /** `/` + mode-prefixed full path (e.g. /alice@bvbrc/home/folder). */
  currentDirectoryPath: string;
  /** `/{myWorkspaceRoot}` — used for top-level navigation and root checks. */
  currentUserWorkspaceRoot: string;
  /** Full path as used by the Workspace API for shared/public modes. */
  fullPath: string;
}

export function buildHomePath(username: string, relativePath: string): string {
  const userSegment = username.includes("@") ? username : `${username}@bvbrc`;
  const trimmed = relativePath.replace(/^\/+|\/+$/g, "");
  return trimmed ? `/${userSegment}/home/${trimmed}` : `/${userSegment}/home`;
}

export function computeWorkspacePaths({
  mode,
  username,
  path,
  myWorkspaceRoot,
}: WorkspacePathsInput): WorkspacePaths {
  const fullPath = path ? `/${path}` : "";
  const currentUserWorkspaceRoot = myWorkspaceRoot
    ? `/${myWorkspaceRoot}`
    : `/${username}`;
  const currentDirectoryPath =
    mode === "home"
      ? `${currentUserWorkspaceRoot}/home${fullPath ? fullPath : ""}`
      : fullPath;
  return { currentDirectoryPath, currentUserWorkspaceRoot, fullPath };
}

export interface CanWriteInput {
  mode: "home" | "shared" | "public";
  fullPath: string;
  currentUser: string;
  fullWorkspaceUsername: string;
  myWorkspaceRoot: string;
  currentDirPermissions: ListPermissionsResult | undefined;
}

/**
 * Decide whether the current user can write to `fullPath`. Mirrors the
 * browser's previous behavior: always-false for public; always-true for
 * owned paths; otherwise checked against `currentDirPermissions`.
 */
export function canWriteToCurrentDir({
  mode,
  fullPath,
  currentUser,
  fullWorkspaceUsername,
  myWorkspaceRoot,
  currentDirPermissions,
}: CanWriteInput): boolean {
  if (mode === "public") return false;
  if (!fullPath) return false;
  const decodedFullPath = safeDecode(fullPath);
  const isOwnedPath =
    decodedFullPath.startsWith(`/${myWorkspaceRoot}/`) ||
    decodedFullPath.startsWith(`/${currentUser}/`);
  if (isOwnedPath) return true;
  if (!currentDirPermissions) return false;
  const perms =
    currentDirPermissions[decodedFullPath] ?? currentDirPermissions[fullPath];
  if (!perms) return false;
  const writePerms = new Set(["w", "a", "o"]);
  return perms.some(
    ([user, perm]) =>
      (user === currentUser || user === fullWorkspaceUsername) &&
      writePerms.has(perm),
  );
}

export function hasWorkspaceWritePermission(
  userPermission: string | undefined,
  globalPermission: string | undefined,
): boolean {
  const user = String(userPermission ?? "");
  const global = String(globalPermission ?? "");
  return ["o", "a", "w"].some(
    (permission) =>
      user === permission ||
      user.includes(permission) ||
      global === permission ||
      global.includes(permission),
  );
}

/**
 * Decide whether a `WorkspaceItem` grants the current user write access using
 * its own permissions tuple. Used when listing children to decide per-item
 * write actions without an extra round-trip.
 */
export function itemHasWriteAccess(item: WorkspaceItem): boolean {
  return hasWorkspaceWritePermission(
    item.permissions?.user,
    item.permissions?.global,
  );
}
