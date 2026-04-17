/**
 * Workspace repository interface.
 *
 * The repository is the single boundary between workspace consumers (hooks,
 * components, service pages) and the underlying transport (HTTP JSON-RPC in
 * production, in-memory fixtures in tests). All methods work in terms of the
 * canonical `WorkspaceItem` from `./domain.ts` — transport-specific parsing
 * happens inside each adapter.
 */

import type {
  CopyInput,
  DeleteOptions,
  ListDirectoryInput,
  ListPermissionsResult,
  SearchWorkspaceObjectsInput,
  WorkspaceItem,
  WorkspaceMetadata,
  WorkspaceReadOptions,
} from "./domain";

export interface ArchiveRequest {
  paths: string[];
  recursive: boolean;
  archiveName: string;
  archiveType: string;
}

export type ArchiveResult = [string, number, number];

export interface UploadNodeRequest {
  directoryPath: string;
  filename: string;
  type: string;
}

export interface UploadNodeResult {
  linkReference: string;
}

export interface WorkspaceRepository {
  /** List objects under a directory path. */
  listDirectory(input: ListDirectoryInput): Promise<WorkspaceItem[]>;

  /** Fetch metadata for one or more object paths. */
  getMetadata(
    paths: string[],
    options?: WorkspaceReadOptions,
  ): Promise<WorkspaceMetadata[]>;

  /** Fetch raw Workspace.get payload (rarely needed — prefer getMetadata). */
  getRaw(paths: string[], options?: WorkspaceReadOptions): Promise<unknown>;

  /** Permissions for a set of paths. */
  listPermissions(paths: string[]): Promise<ListPermissionsResult>;

  /** Create a folder by full path (or list of paths). */
  createFolder(path: string): Promise<void>;

  /** Create an upload node for a file (returns Shock URL). */
  createUploadNode(input: UploadNodeRequest): Promise<UploadNodeResult>;

  /** Save raw content into a workspace object (e.g. JSON preferences). */
  saveObject(input: {
    path: string;
    type: string;
    content: string;
    overwrite?: boolean;
    meta?: Record<string, unknown>;
  }): Promise<void>;

  /** Delete one or more full paths. */
  delete(paths: string[], options?: DeleteOptions): Promise<void>;

  /** Copy or move. When `move` is true, the source is deleted. */
  copy(input: CopyInput): Promise<void>;

  /** Change the `type` metadata of an object. */
  updateObjectType(path: string, newType: string): Promise<void>;

  /** Trigger auto metadata inspection (e.g. after Shock upload). */
  updateAutoMetadata(paths: string[]): Promise<void>;

  /** One-time download URLs for a batch of paths. */
  getDownloadUrls(paths: string[]): Promise<string[][]>;

  /** One-time archive URL for multi-path downloads. */
  getArchiveUrl(input: ArchiveRequest): Promise<ArchiveResult>;

  /** Search objects by type/name for the object selector. */
  searchObjects(input: SearchWorkspaceObjectsInput): Promise<WorkspaceItem[]>;

  /** Disk usage for a set of paths (path, sizeBytes, fileCount, dirCount, error). */
  diskUsage(paths: string[], recursive?: boolean): Promise<[string, number, number, number, string][]>;
}

/**
 * Opaque repository handle; `WorkspaceRepository` is exposed as an interface so
 * tests can substitute their own adapter via React context / hook injection.
 */
export type { WorkspaceRepository as IWorkspaceRepository };
