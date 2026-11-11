/**
 * The single boundary between workspace consumers and the transport (HTTP
 * JSON-RPC in production, in-memory fixtures in tests); methods use the
 * canonical `WorkspaceItem`.
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

export type CreateIdGroupInput = {
  path: string;
  name: string;
  ids: string[];
} & (
  | { type: "genome_group"; idField: "genome_id" }
  | { type: "feature_group"; idField: "feature_id" }
);

export interface AppendToIdGroupInput {
  path: string;
  idField: "genome_id" | "feature_id";
  ids: string[];
}

/**
 * The start of a file's text, cut at its last line end; when none fits, the
 * bytes as read, ending mid-line.
 */
export interface WorkspaceTextStart {
  text: string;
  truncated: boolean;
}

export interface WorkspaceRepository {
  listDirectory(input: ListDirectoryInput): Promise<WorkspaceItem[]>;

  getMetadata(
    paths: string[],
    options?: WorkspaceReadOptions,
  ): Promise<WorkspaceMetadata[]>;

  /** Fetch raw Workspace.get payload (rarely needed; prefer getMetadata). */
  getRaw(paths: string[], options?: WorkspaceReadOptions): Promise<unknown>;

  listPermissions(paths: string[]): Promise<ListPermissionsResult>;

  createFolder(path: string): Promise<void>;

  createUploadNode(input: UploadNodeRequest): Promise<UploadNodeResult>;

  saveObject(input: {
    path: string;
    type: string;
    content: string;
    overwrite?: boolean;
    meta?: Record<string, unknown>;
  }): Promise<void>;

  createIdGroup(input: CreateIdGroupInput): Promise<void>;

  appendToIdGroup(input: AppendToIdGroupInput): Promise<void>;

  delete(paths: string[], options?: DeleteOptions): Promise<void>;

  /** Copy or move. When `move` is true, the source is deleted. */
  copy(input: CopyInput): Promise<void>;

  updateObjectType(path: string, newType: string): Promise<void>;

  updateAutoMetadata(paths: string[]): Promise<void>;

  getDownloadUrls(paths: string[]): Promise<string[][]>;

  getArchiveUrl(input: ArchiveRequest): Promise<ArchiveResult>;

  /**
   * The first `maxBytes` of a file's contents, cut at the last line end (or
   * ending mid-line when there is none); through `/api/workspace/preview`,
   * which caps it at 10 MB.
   */
  readTextStart(path: string, maxBytes: number): Promise<WorkspaceTextStart>;

  searchObjects(input: SearchWorkspaceObjectsInput): Promise<WorkspaceItem[]>;

  diskUsage(
    paths: string[],
    recursive?: boolean,
    options?: { silent?: boolean },
  ): Promise<[string, number, number, number, string][]>;
}

/**
 * Opaque repository handle; exposed as an interface so tests can substitute
 * their own adapter.
 */
export type { WorkspaceRepository as IWorkspaceRepository };
