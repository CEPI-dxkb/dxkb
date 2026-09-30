import { readStorageItem, writeStorageItem } from "./browser-storage";

export interface RecentFolder {
  path: string;
  visitedAt: number;
}

export const recentWorkspaceFoldersStorageKey =
  "dxkb-recent-workspace-folders:v1";
const defaultMaxItems = 5;

/**
 * Extract the last segment of a workspace path for display.
 * e.g. "/user@bvbrc/home/Experiments" → "Experiments"
 */
export function getWorkspaceFolderDisplayName(path: string): string {
  const trimmed = path.replace(/\/+$/, "");
  const lastSlash = trimmed.lastIndexOf("/");
  return lastSlash === -1 ? trimmed : trimmed.slice(lastSlash + 1);
}

/** Parse the stored list, optionally keeping one user's entries. Pure: safe in render. */
export function parseRecentFolders(
  raw: string | null,
  userPrefix?: string,
): RecentFolder[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const folders = (parsed as (RecentFolder | null | undefined)[]).filter(
    (f): f is RecentFolder =>
      f != null && typeof f.path === "string" && typeof f.visitedAt === "number",
  );
  if (!userPrefix) return folders;
  const prefix = userPrefix.startsWith("/") ? userPrefix : `/${userPrefix}`;
  return folders.filter((f) => f.path.startsWith(`${prefix}/`));
}

/** Read outside render (event handlers, effects). Components use useRecentWorkspaceFolders. */
export function getRecentFolders(userPrefix?: string): RecentFolder[] {
  return parseRecentFolders(
    readStorageItem(recentWorkspaceFoldersStorageKey),
    userPrefix,
  );
}

/**
 * Add a folder to the recently visited list. Deduplicates and trims to maxItems
 * per user, preserving other users' entries on shared browsers.
 */
export function addRecentFolder(
  path: string,
  userPrefix: string,
  maxItems: number = defaultMaxItems,
): void {
  const existing = getRecentFolders();
  const prefix = userPrefix.startsWith("/") ? userPrefix : `/${userPrefix}`;

  const otherEntries = existing.filter(
    (f) => !f.path.startsWith(`${prefix}/`),
  );
  const userEntries = existing.filter((f) => f.path.startsWith(`${prefix}/`));

  const deduped = userEntries.filter((f) => f.path !== path);
  const updatedUser = [{ path, visitedAt: Date.now() }, ...deduped].slice(
    0,
    maxItems,
  );

  writeStorageItem(
    recentWorkspaceFoldersStorageKey,
    JSON.stringify([...updatedUser, ...otherEntries]),
  );
}

/**
 * Clear all recently visited folders.
 */
export function clearRecentFolders(): void {
  writeStorageItem(recentWorkspaceFoldersStorageKey, null);
}
