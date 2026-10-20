/**
 * Canonical workspace domain types.
 *
 * This module defines `WorkspaceItem` as the single shared model used by the
 * workspace browser, selector, and service pages. The existing
 * `WorkspaceBrowserItem` and `WorkspaceObject` types are kept as compatibility
 * shims and can be derived from / converted to `WorkspaceItem` via the helpers
 * below.
 */

import type { ResolvedPathObject, WorkspaceObject } from "./types";
import { isFolder, isFolderType, normalizeWorkspaceObjectType } from "./utils";

/**
 * Canonical workspace object type. Kept as a string because the backend
 * returns arbitrary types (file upload type IDs, "job_result", "folder",
 * "genome_group", etc.) and the rules for which are folder-like are owned
 * by `isFolderType` / `isFolder` in `./utils`.
 */
export type WorkspaceObjectType = string;

export interface WorkspaceItemPermissions {
  /** Permission granted to the current user on this object (e.g. "o", "a", "w", "r", "n"). */
  user?: string;
  /** Global (public) permission on this object. */
  global?: string;
}

export type WorkspaceItemRaw = ResolvedPathObject | Record<string, unknown>;
export type WorkspaceMetadataRaw = unknown[] | null;

/**
 * Canonical item used across the workspace browser, selector, and service pages.
 * Produced by the repository regardless of transport.
 */
export interface WorkspaceItem {
  id: string;
  name: string;
  /** Full workspace path, e.g. /user@bvbrc/home/folder/file.fa. */
  path: string;
  /** Raw object type string (folder, job_result, reads, etc.). */
  type: WorkspaceObjectType;
  size: number;
  ownerId?: string;
  /** ISO timestamp string as returned by the API. */
  createdAt?: string;
  /** Parsed epoch ms, used for sorting. */
  timestamp?: number;
  permissions?: WorkspaceItemPermissions;
  userMeta?: Record<string, unknown>;
  autoMeta?: Record<string, unknown>;
  linkReference?: string;
  /**
   * The raw transport-shaped item (e.g. `WorkspaceBrowserItem` parsed from
   * `Workspace.ls`). Kept so callers migrating off the old model can still
   * reach legacy fields without a second fetch.
   */
  raw?: WorkspaceItemRaw;
}

export interface WorkspaceSearchQuery {
  type?: string[];
  name?: string;
  owner?: string;
}

export interface ListDirectoryInput {
  path: string;
  recursive?: boolean;
  excludeDirectories?: boolean;
  excludeObjects?: boolean;
  query?: WorkspaceSearchQuery;
  limit?: number;
  offset?: number;
  /** When true, do not log API errors (e.g. for optional lookups). */
  silent?: boolean;
}

export interface SearchWorkspaceObjectsInput {
  /** The workspace root username (e.g. "user" or "user@bvbrc"). */
  username: string;
  /** Path under the user workspace to search (default "/home/"). */
  path?: string;
  /** Optional type filter. */
  types?: string[];
  /** Optional name filter. */
  name?: string;
}

export interface WorkspaceReadOptions {
  metadataOnly?: boolean;
  silent?: boolean;
}

export interface WorkspaceMetadata {
  /** Full path that was requested. */
  path: string;
  /** Parsed metadata for the object at this path, if any. */
  object: WorkspaceItem | null;
  /** Raw `Workspace.get` path-result slice for this requested path. */
  raw: WorkspaceMetadataRaw;
}

export interface DeleteOptions {
  force?: boolean;
  deleteDirectories?: boolean;
}

export interface CopyInput {
  /** [sourcePath, destinationPath] pairs. */
  pairs: [string, string][];
  recursive?: boolean;
  move?: boolean;
}

/** Map of path -> list of [user, permission] entries from Workspace.list_permissions. */
export type ListPermissionsResult = Record<string, [string, string][]>;

/**
 * Typed error thrown by repository methods so callers can branch on API error codes
 * without `as`-casting the `apiResponse` field.
 */
export class WorkspaceApiError extends Error {
  readonly method: string;
  readonly apiResponse: unknown;
  /** HTTP status of the proxy's answer, when the failure was one (502/503/504 = upstream outage). */
  readonly status?: number;

  constructor(
    message: string,
    method: string,
    apiResponse: unknown,
    status?: number,
  ) {
    super(message);
    this.name = "WorkspaceApiError";
    this.method = method;
    this.apiResponse = apiResponse;
    this.status = status;
  }

  /**
   * Attempts to extract a JSON-RPC error code from `apiResponse`. Returns
   * `undefined` when no code can be found.
   */
  get code(): number | undefined {
    const resp = this.apiResponse;
    if (resp == null) return undefined;
    if (typeof resp === "object" && "error" in resp) {
      const err = (resp as { error?: { code?: number } }).error;
      if (err && typeof err.code === "number") return err.code;
    }
    if (typeof resp === "object" && "code" in resp) {
      const code = (resp as { code?: number }).code;
      if (typeof code === "number") return code;
    }
    return undefined;
  }
}

// --------------------
// Type helpers
// --------------------

export function isWorkspaceFolder(item: Pick<WorkspaceItem, "type">): boolean {
  return isFolder(item.type);
}

export function isWorkspaceFolderLike(
  item: Pick<WorkspaceItem, "type">,
): boolean {
  return isFolderType(item.type);
}

export function normalizeWorkspaceType(type: string): string {
  return normalizeWorkspaceObjectType(type);
}

// --------------------
// Conversions
// --------------------

/**
 * Convert a canonical `WorkspaceItem` into the legacy `WorkspaceObject` shape.
 * Unlike the previous definition the `type` field here is the raw string from
 * the API, not the artificially narrowed `"file" | "folder" | "job"` union.
 */
export function toWorkspaceObject(item: WorkspaceItem): WorkspaceObject {
  return {
    id: item.id,
    name: item.name,
    type: item.type,
    size: item.size,
    modified: item.createdAt,
    path: item.path,
    isDirectory: isFolderType(item.type),
    permissions: item.permissions?.user,
    owner: item.ownerId,
  };
}
