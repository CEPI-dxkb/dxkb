import { workspaceApi } from "./client";
import {
  isWorkspaceObjectMissing,
  workspaceErrorMessage,
} from "./workspace-errors";

const favoritesFile = "favorites.json";
const preferencesDir = ".preferences";

/**
 * Path to the favorites JSON file for a user (e.g. /user@bvbrc/home/.preferences/favorites.json).
 */
export function getFavoritesFilePath(userId: string): string {
  const normalized = userId.startsWith("/") ? userId.slice(1) : userId;
  return `/${normalized}/home/${preferencesDir}/${favoritesFile}`;
}

/**
 * Path to the .preferences directory for a user (e.g. /user@bvbrc/home/.preferences).
 */
export function getPreferencesDirPath(userId: string): string {
  const normalized = userId.startsWith("/") ? userId.slice(1) : userId;
  return `/${normalized}/home/${preferencesDir}`;
}

/**
 * Workspace.get result for one object: result[0][0] = [metadata, content] when not metadata_only.
 */
function parseGetFileContent(result: unknown): string | null {
  if (!Array.isArray(result) || result.length === 0) return null;
  const first: unknown = result[0];
  if (!Array.isArray(first) || first.length === 0) return null;
  const pair: unknown = first[0];
  if (!Array.isArray(pair) || pair.length < 2) return null;
  const content: unknown = pair[1];
  return typeof content === "string" ? content : null;
}

function parseFavoriteFolders(content: string): string[] {
  try {
    const data = JSON.parse(content) as { folders?: unknown };
    return Array.isArray(data.folders)
      ? data.folders.filter((path): path is string => typeof path === "string")
      : [];
  } catch {
    // An unreadable file holds nothing the app can show or keep.
    return [];
  }
}

/**
 * Load favorite folder paths from the user's favorites.json. Returns [] when
 * the file does not exist yet (or holds no folder list). Any other failure is
 * thrown: a failed read is not "no favorites", and `toggleFavorite` writes
 * the whole file back from what this returns.
 */
export async function loadFavorites(userId: string): Promise<string[]> {
  if (!userId) return [];
  const filePath = getFavoritesFilePath(userId);
  let result: unknown;
  try {
    result = await workspaceApi.makeRequest(
      "Workspace.get",
      [{ objects: [filePath] }],
      { silent: true },
    );
  } catch (error) {
    if (isWorkspaceObjectMissing(error)) return [];
    throw error;
  }
  const content = parseGetFileContent(result);
  if (!content) return [];
  return parseFavoriteFolders(content);
}

/**
 * Ensure the .preferences directory exists. If the Workspace says it does not
 * exist (get returns empty or a "not found" error), create the folder; any
 * other failure of the check is thrown rather than answered with a write.
 */
async function ensurePreferencesDir(userId: string): Promise<void> {
  const dirPath = getPreferencesDirPath(userId);
  let exists = false;
  try {
    const result = await workspaceApi.makeRequest("Workspace.get", [
      { objects: [dirPath], metadata_only: true },
    ], { silent: true });
    exists =
      Array.isArray(result) &&
      result.length > 0 &&
      Array.isArray(result[0]) &&
      result[0].length > 0;
  } catch (error) {
    if (!isWorkspaceObjectMissing(error)) throw error;
  }
  if (exists) return;
  await workspaceApi.makeRequest("Workspace.create", [
    { objects: [[dirPath, "folder", {}]] },
  ]);
}

/**
 * Toggle a folder in favorites. Returns the new state: true = favorited, false = removed.
 *
 * The whole file is rewritten from the list just read, so a failed read
 * aborts before any write: writing then would replace every saved favorite
 * with the one folder being toggled.
 */
export async function toggleFavorite(
  userId: string,
  folderPath: string,
): Promise<boolean> {
  if (!userId || !folderPath) {
    throw new Error("User and folder path are required.");
  }
  let folders: string[];
  try {
    folders = await loadFavorites(userId);
  } catch (cause) {
    throw new Error(
      `Couldn't update favorites, nothing was changed: ${workspaceErrorMessage(cause, "your saved favorites could not be read.")}`,
      { cause },
    );
  }
  const idx = folders.indexOf(folderPath);
  const isAdding = idx === -1;
  const newFolders = isAdding
    ? [...folders, folderPath]
    : folders.filter((p) => p !== folderPath);

  await ensurePreferencesDir(userId);
  const filePath = getFavoritesFilePath(userId);
  const content = JSON.stringify({ folders: newFolders }, null, 2);

  await workspaceApi.makeRequest("Workspace.create", [
    {
      objects: [[filePath, "json", {}, content]],
      overwrite: 1,
    },
  ]);

  return isAdding;
}
