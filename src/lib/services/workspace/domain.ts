/**
 * Canonical workspace domain types; `WorkspaceItem` is the single shared model
 * for the browser, selector, and service pages.
 */

import type { ResolvedPathObject, WorkspaceObject } from "./types";
import { isFolder, isFolderType, normalizeWorkspaceObjectType } from "./utils";

/**
 * Canonical object type; a string because the backend returns arbitrary types,
 * with folder-likeness owned by `isFolderType` / `isFolder` in `./utils`.
 */
export type WorkspaceObjectType = string;

export interface WorkspaceItemPermissions {
  user?: string;
  global?: string;
}

export type WorkspaceItemRaw = ResolvedPathObject | Record<string, unknown>;
export type WorkspaceMetadataRaw = unknown[] | null;

/**
 * Canonical item shared by the workspace browser, selector, and service pages.
 */
export interface WorkspaceItem {
  id: string;
  name: string;
  path: string;
  type: WorkspaceObjectType;
  size: number;
  ownerId?: string;
  createdAt?: string;
  timestamp?: number;
  permissions?: WorkspaceItemPermissions;
  userMeta?: Record<string, unknown>;
  autoMeta?: Record<string, unknown>;
  linkReference?: string;
  /** The raw transport-shaped item, for callers migrating off the old model. */
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
  silent?: boolean;
}

export interface SearchWorkspaceObjectsInput {
  username: string;
  path?: string;
  types?: string[];
  name?: string;
}

export interface WorkspaceReadOptions {
  metadataOnly?: boolean;
  silent?: boolean;
}

export interface WorkspaceMetadata {
  path: string;
  object: WorkspaceItem | null;
  raw: WorkspaceMetadataRaw;
}

export interface DeleteOptions {
  force?: boolean;
  deleteDirectories?: boolean;
}

export interface CopyInput {
  pairs: [string, string][];
  recursive?: boolean;
  move?: boolean;
}

export type ListPermissionsResult = Record<string, [string, string][]>;

/**
 * Typed error thrown by repository methods so callers can branch on API error
 * codes.
 */
export class WorkspaceApiError extends Error {
  readonly method: string;
  readonly apiResponse: unknown;
  /**
   * HTTP status of the proxy's answer, when the failure was one (502/503/504 =
   * upstream outage).
   */
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

/**
 * Converts a canonical `WorkspaceItem` into the legacy `WorkspaceObject` shape;
 * `type` stays the raw API string.
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
