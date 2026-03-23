import { workspaceApi } from "./client";
import type { WorkspaceBrowserItem } from "@/types/workspace-browser";

/** Permission entry: [user, perm] where perm is 'r' | 'w' | 'n' | 'a' | 'o' etc. */
export type PermissionEntry = [string, string];

/** Map of path -> list of [user, permission] */
export type ListPermissionsResult = Record<string, PermissionEntry[]>;

/**
 * List workspaces/folders shared with the current user (not owner-only, not public).
 * Uses Workspace.ls with path "/" and filters by global_permission and user_permission.
 */
export async function listSharedWithUser(): Promise<WorkspaceBrowserItem[]> {
  const raw = await workspaceApi.makeRequest<WorkspaceBrowserItem[]>("Workspace.ls", [
    {
      paths: ["/"],
      includeSubDirs: false,
      recursive: false,
    },
  ]);

  const shared = raw.filter((r) => {
    const g = String(r.global_permission ?? "");
    const u = String(r.user_permission ?? "");
    if (g !== "n") return false;
    if (u === "o" && g === "n") return false;
    return true;
  });

  return shared;
}

/**
 * List workspaces/folders created by the user (top-level under /{username}@bvbrc).
 * Uses Workspace.ls with path "/{username}@bvbrc".
 */
export async function listUserWorkspaces(
  username: string,
): Promise<WorkspaceBrowserItem[]> {
  if (!username) return [];
  const decoded = decodeURIComponent(username);
  const path = `/${decoded}@bvbrc`;
  return workspaceApi.makeRequest<WorkspaceBrowserItem[]>("Workspace.ls", [
    {
      paths: [path],
      includeSubDirs: false,
      recursive: false,
    },
  ]);
}

/**
 * List directory contents at an arbitrary full path (e.g. "/owner@bvbrc/folderName").
 * Used when drilling into a shared folder.
 * Path is decoded so @ is sent literally (not %40) to the API.
 */
export async function listByFullPath(
  fullPath: string,
): Promise<WorkspaceBrowserItem[]> {
  const decoded = decodeURIComponent(fullPath);
  const normalized = decoded.startsWith("/") ? decoded : `/${decoded}`;
  return workspaceApi.makeRequest<WorkspaceBrowserItem[]>("Workspace.ls", [
    {
      paths: [normalized],
      includeSubDirs: false,
      recursive: false,
    },
  ]);
}

/**
 * List permissions for the given paths. Returns a map path -> [user, perm][].
 * Paths are decoded so @ is sent literally (not %40) to the API.
 */
export async function listPermissions(
  paths: string[],
): Promise<ListPermissionsResult> {
  if (paths.length === 0) return {};
  const decodedPaths = paths.map((p) => decodeURIComponent(p));
  return workspaceApi.makeRequest<ListPermissionsResult>(
    "Workspace.list_permissions",
    [{ objects: decodedPaths }],
  );
}

/** Raw Workspace.get result (nested arrays of object metadata). */
export type WorkspaceGetResult = unknown[];

/**
 * Fetch workspace object metadata (e.g. when opening a shared folder).
 * Uses Workspace.get with metadata_only: true.
 * Paths are decoded so @ is sent literally (not %40) to the API.
 */
export async function getWorkspaceMetadata(
  objectPaths: string[],
  options?: { silent?: boolean },
): Promise<WorkspaceGetResult> {
  if (objectPaths.length === 0) return [];
  const decodedPaths = objectPaths.map((p) => decodeURIComponent(p));
  return workspaceApi.makeRequest<WorkspaceGetResult>("Workspace.get", [
    { objects: decodedPaths, metadata_only: true },
  ], options);
}
