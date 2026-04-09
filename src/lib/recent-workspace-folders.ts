export interface RecentFolder {
  path: string;
  visitedAt: number;
}

const storageKey = "dxkb-recent-workspace-folders";
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

/**
 * Read recently visited folders from localStorage.
 * Optionally filter by a user prefix (e.g. "/user@bvbrc/") to avoid showing other users' entries.
 */
export function getRecentFolders(userPrefix?: string): RecentFolder[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentFolder[];
    if (!Array.isArray(parsed)) return [];
    const folders = parsed.filter(
      (f) => f && typeof f.path === "string" && typeof f.visitedAt === "number",
    );
    if (!userPrefix) return folders;
    const prefix = userPrefix.startsWith("/") ? userPrefix : `/${userPrefix}`;
    return folders.filter((f) => f.path.startsWith(`${prefix}/`));
  } catch {
    return [];
  }
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
  try {
    const existing = getRecentFolders();
    const prefix = userPrefix.startsWith("/") ? userPrefix : `/${userPrefix}`;

    const otherEntries = existing.filter(
      (f) => !f.path.startsWith(`${prefix}/`),
    );
    const userEntries = existing.filter((f) =>
      f.path.startsWith(`${prefix}/`),
    );

    const deduped = userEntries.filter((f) => f.path !== path);
    const updatedUser = [{ path, visitedAt: Date.now() }, ...deduped].slice(
      0,
      maxItems,
    );

    localStorage.setItem(
      storageKey,
      JSON.stringify([...updatedUser, ...otherEntries]),
    );
  } catch {
    // localStorage unavailable — silently ignore
  }
}

/**
 * Clear all recently visited folders.
 */
export function clearRecentFolders(): void {
  try {
    localStorage.removeItem(storageKey);
  } catch {
    // localStorage unavailable — silently ignore
  }
}
