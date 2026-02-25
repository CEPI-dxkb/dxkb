import { workspaceApi } from "./client";

const FAVORITES_FILE = "favorites.json";
const PREFERENCES_DIR = ".preferences";

/**
 * Path to the favorites JSON file for a user (e.g. /user@bvbrc/home/.preferences/favorites.json).
 */
export function getFavoritesFilePath(userId: string): string {
  const normalized = userId.startsWith("/") ? userId.slice(1) : userId;
  return `/${normalized}/home/${PREFERENCES_DIR}/${FAVORITES_FILE}`;
}

/**
 * Path to the .preferences directory for a user (e.g. /user@bvbrc/home/.preferences).
 */
export function getPreferencesDirPath(userId: string): string {
  const normalized = userId.startsWith("/") ? userId.slice(1) : userId;
  return `/${normalized}/home/${PREFERENCES_DIR}`;
}

/**
 * Workspace.get result for one object: result[0][0] = [metadata, content] when not metadata_only.
 */
function parseGetFileContent(result: unknown): string | null {
  if (!Array.isArray(result) || result.length === 0) return null;
  const first = result[0];
  if (!Array.isArray(first) || first.length === 0) return null;
  const pair = first[0];
  if (!Array.isArray(pair) || pair.length < 2) return null;
  const content = pair[1];
  return typeof content === "string" ? content : null;
}

/**
 * Load favorite folder paths from the user's favorites.json. Returns [] if file is missing or invalid.
 */
export async function loadFavorites(userId: string): Promise<string[]> {
  if (!userId) return [];
  const filePath = getFavoritesFilePath(userId);
  try {
    const result = await workspaceApi.makeRequest<unknown>("Workspace.get", [
      { objects: [filePath] },
    ]);
    const content = parseGetFileContent(result);
    if (!content) return [];
    const data = JSON.parse(content) as { folders?: string[] };
    return Array.isArray(data.folders) ? data.folders : [];
  } catch {
    return [];
  }
}

/**
 * Ensure the .preferences directory exists. If Workspace.get(metadata_only) fails, create the folder.
 */
async function ensurePreferencesDir(userId: string): Promise<void> {
  const dirPath = getPreferencesDirPath(userId);
  try {
    await workspaceApi.makeRequest<unknown>("Workspace.get", [
      { objects: [dirPath], metadata_only: true },
    ]);
    return;
  } catch {
    // Directory does not exist; create it (path-based create for folder).
    await workspaceApi.makeRequest<unknown>("Workspace.create", [
      { objects: [[dirPath, "folder", {}]] },
    ]);
  }
}

/**
 * Toggle a folder in favorites. Returns the new state: true = favorited, false = removed.
 */
export async function toggleFavorite(
  userId: string,
  folderPath: string,
): Promise<boolean> {
  if (!userId || !folderPath) {
    throw new Error("User and folder path are required.");
  }
  const folders = await loadFavorites(userId);
  const idx = folders.indexOf(folderPath);
  const isAdding = idx === -1;
  const newFolders = isAdding
    ? [...folders, folderPath]
    : folders.filter((p) => p !== folderPath);

  await ensurePreferencesDir(userId);
  const filePath = getFavoritesFilePath(userId);
  const content = JSON.stringify({ folders: newFolders }, null, 2);

  await workspaceApi.makeRequest<unknown>("Workspace.create", [
    {
      objects: [[filePath, "json", {}, content]],
      overwrite: 1,
    },
  ]);

  return isAdding;
}
