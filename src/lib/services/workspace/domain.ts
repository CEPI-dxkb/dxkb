/**
 * Canonical workspace domain types.
 *
 * This module defines `WorkspaceItem` as the single shared model used by the
 * workspace browser, selector, and service pages. The existing
 * `WorkspaceBrowserItem` and `WorkspaceObject` types are kept as compatibility
 * shims and can be derived from / converted to `WorkspaceItem` via the helpers
 * below.
 */

import type { WorkspaceBrowserItem } from "@/types/workspace-browser";
import type { WorkspaceObject } from "./types";
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
  raw?: unknown;
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
  /** Raw `Workspace.get` tuple. */
  raw: unknown;
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

  constructor(message: string, method: string, apiResponse: unknown) {
    super(message);
    this.name = "WorkspaceApiError";
    this.method = method;
    this.apiResponse = apiResponse;
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

export function isWorkspaceFolderLike(item: Pick<WorkspaceItem, "type">): boolean {
  return isFolderType(item.type);
}

export function normalizeWorkspaceType(type: string): string {
  return normalizeWorkspaceObjectType(type);
}

// --------------------
// Conversions
// --------------------

/** Convert a `WorkspaceBrowserItem` (raw ls tuple) into a canonical `WorkspaceItem`. */
export function toWorkspaceItem(item: WorkspaceBrowserItem): WorkspaceItem {
  return {
    id: String(item.id ?? ""),
    name: String(item.name ?? ""),
    path: String(item.path ?? ""),
    type: String(item.type ?? ""),
    size: Number(item.size ?? 0),
    ownerId: item.owner_id ? String(item.owner_id) : undefined,
    createdAt: item.creation_time ? String(item.creation_time) : undefined,
    timestamp: typeof item.timestamp === "number" ? item.timestamp : undefined,
    permissions: {
      user: item.user_permission ? String(item.user_permission) : undefined,
      global: item.global_permission ? String(item.global_permission) : undefined,
    },
    userMeta: item.userMeta,
    autoMeta: item.autoMeta,
    linkReference: item.link_reference ? String(item.link_reference) : undefined,
    raw: item,
  };
}

/**
 * Convert a canonical `WorkspaceItem` back into the transport-shaped
 * `WorkspaceBrowserItem`. Used during migration while some components still
 * consume the old model.
 */
export function toWorkspaceBrowserItem(item: WorkspaceItem): WorkspaceBrowserItem {
  if (item.raw && typeof item.raw === "object") {
    return item.raw as WorkspaceBrowserItem;
  }
  return {
    id: item.id,
    path: item.path,
    name: item.name,
    type: item.type,
    creation_time: item.createdAt ?? "",
    link_reference: item.linkReference ?? "",
    owner_id: item.ownerId ?? "",
    size: item.size,
    userMeta: item.userMeta ?? {},
    autoMeta: item.autoMeta ?? {},
    user_permission: item.permissions?.user ?? "",
    global_permission: item.permissions?.global ?? "",
    timestamp: item.timestamp ?? 0,
  };
}

/**
 * Convert a canonical `WorkspaceItem` into the legacy `WorkspaceObject` shape.
 * Unlike the previous definition the `type` field here is the raw string from
 * the API, not the artificially narrowed `"file" | "folder" | "job"` union.
 */
export function toWorkspaceObject(item: WorkspaceItem): WorkspaceObject {
  return {
    id: item.id,
    name: item.name,
    type: item.type as WorkspaceObject["type"],
    size: item.size,
    modified: item.createdAt,
    path: item.path,
    isDirectory: isFolderType(item.type),
    permissions: item.permissions?.user,
    owner: item.ownerId,
  };
}
