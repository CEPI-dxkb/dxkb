import { workspaceApi } from "./client";
import {
  isWorkspaceObjectMissing,
  workspaceErrorMessage,
} from "./workspace-errors";

const favoritesFile = "favorites.json";
const preferencesDir = ".preferences";

export function getFavoritesFilePath(userId: string): string {
  const normalized = userId.startsWith("/") ? userId.slice(1) : userId;
  return `/${normalized}/home/${preferencesDir}/${favoritesFile}`;
}

export function getPreferencesDirPath(userId: string): string {
  const normalized = userId.startsWith("/") ? userId.slice(1) : userId;
  return `/${normalized}/home/${preferencesDir}`;
}

/**
 * Workspace.get result for one object: result[0][0] = [metadata, content] when
 * not metadata_only.
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
    return [];
  }
}

/**
 * Loads favorite folder paths; returns [] when the file does not exist yet. Any
 * other failure is thrown, since `toggleFavorite` writes the whole file back
 * from what this returns.
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
 * Creates the .preferences directory if the Workspace says it does not exist;
 * any other failure of the check is thrown rather than answered with a write.
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
 * Toggles a folder in favorites; returns true when favorited. The whole file is
 * rewritten from the list just read, so a failed read aborts before any write.
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
