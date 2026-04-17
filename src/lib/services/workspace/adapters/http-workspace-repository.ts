/**
 * HTTP implementation of `WorkspaceRepository`. Thin wrapper around `rpc()`
 * with method-specific parsers in `./parsers.ts`. No JSON-RPC envelope logic
 * or tuple parsing lives in individual methods — it's all delegated.
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
} from "../domain";
import { toWorkspaceItem } from "../domain";
import { parseWorkspaceGetSingle } from "../helpers";
import type { WorkspaceBrowserItem } from "@/types/workspace-browser";
import type {
  ArchiveRequest,
  ArchiveResult,
  UploadNodeRequest,
  UploadNodeResult,
  WorkspaceRepository,
} from "../workspace-repository";
import {
  lsToWorkspaceItems,
  parseDuResult,
  parseListPermissions,
  parseLsResult,
  parseUploadNode,
} from "./parsers";
import { rpc } from "./rpc";

export interface HttpWorkspaceRepositoryOptions {
  /** "/api/services/workspace" (default) or "/api/workspace/public". */
  baseUrl?: string;
}

export class HttpWorkspaceRepository implements WorkspaceRepository {
  private readonly baseUrl: string;

  constructor(options: HttpWorkspaceRepositoryOptions = {}) {
    this.baseUrl = options.baseUrl ?? "/api/services/workspace";
  }

  async listDirectory(input: ListDirectoryInput): Promise<WorkspaceItem[]> {
    const { path, silent, ...rest } = input;
    const rawResult = await rpc<unknown>({
      method: "Workspace.ls",
      params: [{ paths: [path], ...rest }],
      baseUrl: this.baseUrl,
      silent,
    });
    const items = parseLsResult(rawResult, path);
    return lsToWorkspaceItems(items);
  }

  async getMetadata(
    paths: string[],
    options?: WorkspaceReadOptions,
  ): Promise<WorkspaceMetadata[]> {
    if (paths.length === 0) return [];
    const raw = await this.getRaw(paths, options);
    return paths.map((path, index) => {
      const object = parseWorkspaceGetSingle(raw as unknown[], index);
      return {
        path,
        raw,
        object: object
          ? {
              id: object.id,
              name: object.name,
              path: object.path,
              type: object.type,
              size: object.size,
              ownerId: object.owner_id,
              createdAt: object.creation_time,
              userMeta: object.userMeta,
              autoMeta: object.sysMeta,
              raw: object,
            }
          : null,
      };
    });
  }

  async getRaw(paths: string[], options?: WorkspaceReadOptions): Promise<unknown> {
    if (paths.length === 0) return [];
    return rpc<unknown>({
      method: "Workspace.get",
      params: [
        {
          objects: paths,
          metadata_only: options?.metadataOnly ?? true,
        },
      ],
      baseUrl: this.baseUrl,
      silent: options?.silent,
    });
  }

  async listPermissions(paths: string[]): Promise<ListPermissionsResult> {
    if (paths.length === 0) return {};
    const raw = await rpc<unknown>({
      method: "Workspace.list_permissions",
      params: [{ objects: paths }],
      baseUrl: this.baseUrl,
    });
    return parseListPermissions(raw);
  }

  async createFolder(path: string): Promise<void> {
    await rpc<unknown>({
      method: "Workspace.create",
      params: [{ objects: [[path, "Directory"]] }],
      baseUrl: this.baseUrl,
    });
  }

  async createUploadNode(input: UploadNodeRequest): Promise<UploadNodeResult> {
    const dir = input.directoryPath.endsWith("/")
      ? input.directoryPath
      : `${input.directoryPath}/`;
    const fullPath = dir + input.filename;
    const raw = await rpc<unknown>({
      method: "Workspace.create",
      params: [
        {
          objects: [[fullPath, input.type, {}, ""]],
          createUploadNodes: true,
        },
      ],
      baseUrl: this.baseUrl,
    });
    const link = parseUploadNode(raw);
    if (!link) {
      throw new Error(
        "Workspace.create did not return a Shock URL (link_reference)",
      );
    }
    return { linkReference: link };
  }

  async saveObject(input: {
    path: string;
    type: string;
    content: string;
    overwrite?: boolean;
    meta?: Record<string, unknown>;
  }): Promise<void> {
    await rpc<unknown>({
      method: "Workspace.create",
      params: [
        {
          objects: [[input.path, input.type, input.meta ?? {}, input.content]],
          overwrite: input.overwrite ? 1 : 0,
        },
      ],
      baseUrl: this.baseUrl,
    });
  }

  async delete(paths: string[], options?: DeleteOptions): Promise<void> {
    if (paths.length === 0) return;
    await rpc<unknown>({
      method: "Workspace.delete",
      params: [
        {
          objects: paths,
          force: options?.force ?? true,
          deleteDirectories: options?.deleteDirectories ?? true,
        },
      ],
      baseUrl: this.baseUrl,
    });
  }

  async copy(input: CopyInput): Promise<void> {
    if (input.pairs.length === 0) return;
    await rpc<unknown>({
      method: "Workspace.copy",
      params: [
        {
          objects: input.pairs,
          recursive: input.recursive ?? true,
          move: input.move ?? false,
        },
      ],
      baseUrl: this.baseUrl,
      silent: true,
    });
  }

  async updateObjectType(path: string, newType: string): Promise<void> {
    await rpc<unknown>({
      method: "Workspace.update_metadata",
      params: [{ objects: [[path, {}, newType]] }],
      baseUrl: this.baseUrl,
    });
  }

  async updateAutoMetadata(paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    await rpc<unknown>({
      method: "Workspace.update_auto_meta",
      params: [{ objects: paths }],
      baseUrl: this.baseUrl,
    });
  }

  async getDownloadUrls(paths: string[]): Promise<string[][]> {
    if (paths.length === 0) return [];
    return rpc<string[][]>({
      method: "Workspace.get_download_url",
      params: [{ objects: paths }],
      baseUrl: this.baseUrl,
    });
  }

  async getArchiveUrl(input: ArchiveRequest): Promise<ArchiveResult> {
    return rpc<ArchiveResult>({
      method: "Workspace.get_archive_url",
      params: [
        {
          objects: input.paths,
          recursive: input.recursive,
          archive_name: input.archiveName,
          archive_type: input.archiveType,
        },
      ],
      baseUrl: this.baseUrl,
    });
  }

  async searchObjects(
    input: SearchWorkspaceObjectsInput,
  ): Promise<WorkspaceItem[]> {
    const path = input.path ?? "/home/";
    const userSegment = input.username.includes("@")
      ? input.username
      : `${input.username}@bvbrc`;
    const fullPath = `/${userSegment}${path}`;

    const query: Record<string, unknown> = {};
    if (input.types && input.types.length > 0) query.type = input.types;
    if (input.name) query.name = input.name;

    const rawResult = await rpc<unknown>({
      method: "Workspace.ls",
      params: [
        {
          paths: [fullPath],
          excludeDirectories: false,
          excludeObjects: false,
          recursive: true,
          ...(Object.keys(query).length > 0 ? { query } : {}),
        },
      ],
      baseUrl: this.baseUrl,
    });

    let items: WorkspaceBrowserItem[] = parseLsResult(rawResult, fullPath);
    if (input.types && input.types.length > 0) {
      const allowed = new Set(input.types);
      items = items.filter((obj) => allowed.has(obj.type));
    }
    return items.map(toWorkspaceItem);
  }

  async diskUsage(
    paths: string[],
    recursive = true,
  ): Promise<[string, number, number, number, string][]> {
    if (paths.length === 0) return [];
    const raw = await rpc<unknown>({
      method: "Workspace.du",
      params: [{ paths, recursive }],
      baseUrl: this.baseUrl,
    });
    return parseDuResult(raw);
  }
}

/**
 * Default HTTP repository used by production code. Public workspace consumers
 * should pass `{ baseUrl: "/api/workspace/public" }`.
 */
export const httpWorkspaceRepository = new HttpWorkspaceRepository();
export const publicHttpWorkspaceRepository = new HttpWorkspaceRepository({
  baseUrl: "/api/workspace/public",
});
