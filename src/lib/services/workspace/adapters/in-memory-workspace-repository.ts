/**
 * In-memory implementation of `WorkspaceRepository` for tests and stories.
 * Stores a mutable map of path -> children and tracks calls so specs can
 * assert on behavior without an HTTP transport.
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
import { WorkspaceApiError, toWorkspaceItem } from "../domain";
import type { WorkspaceBrowserItem } from "@/types/workspace-browser";
import type {
  ArchiveRequest,
  ArchiveResult,
  UploadNodeRequest,
  UploadNodeResult,
  WorkspaceRepository,
} from "../workspace-repository";

type CallRecord =
  | { method: "listDirectory"; input: ListDirectoryInput }
  | { method: "getMetadata"; paths: string[]; options?: WorkspaceReadOptions }
  | { method: "listPermissions"; paths: string[] }
  | { method: "createFolder"; path: string }
  | { method: "createUploadNode"; input: UploadNodeRequest }
  | { method: "saveObject"; path: string; type: string; overwrite?: boolean }
  | { method: "delete"; paths: string[]; options?: DeleteOptions }
  | { method: "copy"; input: CopyInput }
  | { method: "updateObjectType"; path: string; newType: string }
  | { method: "updateAutoMetadata"; paths: string[] }
  | { method: "getDownloadUrls"; paths: string[] }
  | { method: "getArchiveUrl"; input: ArchiveRequest }
  | { method: "searchObjects"; input: SearchWorkspaceObjectsInput }
  | { method: "diskUsage"; paths: string[]; recursive: boolean };

export interface InMemoryFixtureItem {
  name: string;
  type: string;
  size?: number;
  ownerId?: string;
  createdAt?: string;
  timestamp?: number;
  userPermission?: string;
  globalPermission?: string;
}

export interface InMemoryFixtures {
  /**
   * Map of directory path -> listing. Paths are stored as canonical
   * (leading slash, no trailing slash). The repository normalizes lookups.
   */
  directories?: Record<string, InMemoryFixtureItem[]>;
  permissions?: ListPermissionsResult;
  downloadUrls?: Record<string, string[]>;
  diskUsage?: Record<string, [number, number, number, string]>;
  /** If set, thrown from the matching method on first invocation. */
  errors?: Partial<Record<CallRecord["method"], Error>>;
}

function normalize(path: string): string {
  if (!path) return "/";
  return path.replace(/\/+$/, "").replace(/\/+/g, "/") || "/";
}

function toBrowserItem(
  parent: string,
  fixture: InMemoryFixtureItem,
  index: number,
): WorkspaceBrowserItem {
  const parentNormalized = normalize(parent);
  const fullPath = parentNormalized === "/"
    ? `/${fixture.name}`
    : `${parentNormalized}/${fixture.name}`;
  const createdAt = fixture.createdAt ?? "2026-01-01T00:00:00Z";
  return {
    id: `${fullPath}#${index}`,
    name: fixture.name,
    path: fullPath,
    type: fixture.type,
    creation_time: createdAt,
    link_reference: "",
    owner_id: fixture.ownerId ?? "test-user@bvbrc",
    size: fixture.size ?? 0,
    userMeta: {},
    autoMeta: {},
    user_permission: fixture.userPermission ?? "o",
    global_permission: fixture.globalPermission ?? "n",
    timestamp: fixture.timestamp ?? Date.parse(createdAt),
  };
}

export class InMemoryWorkspaceRepository implements WorkspaceRepository {
  readonly calls: CallRecord[] = [];
  private directories: Record<string, InMemoryFixtureItem[]> = {};
  private permissions: ListPermissionsResult = {};
  private downloadUrls: Record<string, string[]> = {};
  private diskUsageMap: Record<string, [number, number, number, string]> = {};
  private errors: Partial<Record<CallRecord["method"], Error>> = {};

  constructor(fixtures: InMemoryFixtures = {}) {
    this.load(fixtures);
  }

  load(fixtures: InMemoryFixtures): void {
    this.directories = Object.fromEntries(
      Object.entries(fixtures.directories ?? {}).map(([path, items]) => [
        normalize(path),
        items,
      ]),
    );
    this.permissions = fixtures.permissions ?? {};
    this.downloadUrls = fixtures.downloadUrls ?? {};
    this.diskUsageMap = fixtures.diskUsage ?? {};
    this.errors = fixtures.errors ?? {};
  }

  reset(): void {
    this.calls.length = 0;
    this.directories = {};
    this.permissions = {};
    this.downloadUrls = {};
    this.diskUsageMap = {};
    this.errors = {};
  }

  private throwIfConfigured(method: CallRecord["method"]): void {
    const err = this.errors[method];
    if (err) throw err;
  }

  async listDirectory(input: ListDirectoryInput): Promise<WorkspaceItem[]> {
    this.calls.push({ method: "listDirectory", input });
    this.throwIfConfigured("listDirectory");
    const items = this.directories[normalize(input.path)] ?? [];
    const mapped = items.map((f, i) => toWorkspaceItem(toBrowserItem(input.path, f, i)));
    if (input.query?.type && input.query.type.length > 0) {
      const allowed = new Set(input.query.type);
      return mapped.filter((item) => allowed.has(item.type));
    }
    if (input.query?.name) {
      const term = input.query.name.toLowerCase();
      return mapped.filter((item) => item.name.toLowerCase().includes(term));
    }
    return mapped;
  }

  async getMetadata(
    paths: string[],
    options?: WorkspaceReadOptions,
  ): Promise<WorkspaceMetadata[]> {
    this.calls.push({ method: "getMetadata", paths, options });
    this.throwIfConfigured("getMetadata");
    return paths.map((path) => {
      const normalized = normalize(path);
      const parent = normalize(path.slice(0, path.lastIndexOf("/")) || "/");
      const siblings = this.directories[parent] ?? [];
      const name = normalized.split("/").filter(Boolean).pop() ?? "";
      const fixture = siblings.find((f) => f.name === name);
      const object = fixture
        ? toWorkspaceItem(toBrowserItem(parent, fixture, siblings.indexOf(fixture)))
        : null;
      return { path: normalized, object, raw: object?.raw ?? null };
    });
  }

  async getRaw(paths: string[]): Promise<unknown> {
    this.calls.push({ method: "getMetadata", paths });
    return this.getMetadata(paths).then((metas) => metas.map((m) => m.raw));
  }

  async listPermissions(paths: string[]): Promise<ListPermissionsResult> {
    this.calls.push({ method: "listPermissions", paths });
    this.throwIfConfigured("listPermissions");
    const result: ListPermissionsResult = {};
    for (const path of paths) {
      const normalized = normalize(path);
      result[normalized] = this.permissions[normalized] ?? [];
    }
    return result;
  }

  async createFolder(path: string): Promise<void> {
    this.calls.push({ method: "createFolder", path });
    this.throwIfConfigured("createFolder");
    const normalized = normalize(path);
    const parent = normalize(
      normalized.slice(0, normalized.lastIndexOf("/")) || "/",
    );
    const name = normalized.split("/").filter(Boolean).pop() ?? "";
    const children = this.directories[parent] ?? [];
    if (!children.find((c) => c.name === name)) {
      children.push({ name, type: "folder" });
      this.directories[parent] = children;
    }
    if (!this.directories[normalized]) this.directories[normalized] = [];
  }

  async createUploadNode(input: UploadNodeRequest): Promise<UploadNodeResult> {
    this.calls.push({ method: "createUploadNode", input });
    this.throwIfConfigured("createUploadNode");
    return { linkReference: `https://shock.test/node/${input.filename}` };
  }

  async saveObject(input: {
    path: string;
    type: string;
    content: string;
    overwrite?: boolean;
  }): Promise<void> {
    this.calls.push({
      method: "saveObject",
      path: input.path,
      type: input.type,
      overwrite: input.overwrite,
    });
    this.throwIfConfigured("saveObject" as CallRecord["method"]);
    const normalized = normalize(input.path);
    const parent = normalize(
      normalized.slice(0, normalized.lastIndexOf("/")) || "/",
    );
    const name = normalized.split("/").filter(Boolean).pop() ?? "";
    const children = this.directories[parent] ?? [];
    const existing = children.findIndex((c) => c.name === name);
    if (existing >= 0 && !input.overwrite) {
      throw new WorkspaceApiError(
        `Cannot overwrite ${normalized}`,
        "Workspace.create",
        { error: { code: -32603 } },
      );
    }
    if (existing >= 0) {
      children[existing] = { name, type: input.type };
    } else {
      children.push({ name, type: input.type });
    }
    this.directories[parent] = children;
  }

  async delete(paths: string[], options?: DeleteOptions): Promise<void> {
    this.calls.push({ method: "delete", paths, options });
    this.throwIfConfigured("delete");
    for (const path of paths) {
      const normalized = normalize(path);
      const parent = normalize(
        normalized.slice(0, normalized.lastIndexOf("/")) || "/",
      );
      const name = normalized.split("/").filter(Boolean).pop() ?? "";
      const children = this.directories[parent];
      if (children) {
        this.directories[parent] = children.filter((c) => c.name !== name);
      }
      this.directories = Object.fromEntries(
        Object.entries(this.directories).filter(([key]) => key !== normalized),
      );
    }
  }

  async copy(input: CopyInput): Promise<void> {
    this.calls.push({ method: "copy", input });
    this.throwIfConfigured("copy");
    for (const [src, dest] of input.pairs) {
      const srcNormalized = normalize(src);
      const destNormalized = normalize(dest);
      const destParent = normalize(
        destNormalized.slice(0, destNormalized.lastIndexOf("/")) || "/",
      );
      const destName = destNormalized.split("/").filter(Boolean).pop() ?? "";
      const destSiblings = this.directories[destParent] ?? [];
      if (destSiblings.some((c) => c.name === destName)) {
        throw new WorkspaceApiError(
          `Cannot overwrite ${destNormalized}`,
          "Workspace.copy",
          { error: { code: -32603 } },
        );
      }
      const srcParent = normalize(
        srcNormalized.slice(0, srcNormalized.lastIndexOf("/")) || "/",
      );
      const srcName = srcNormalized.split("/").filter(Boolean).pop() ?? "";
      const srcSiblings = this.directories[srcParent] ?? [];
      const source = srcSiblings.find((c) => c.name === srcName);
      if (!source) continue;
      destSiblings.push({ ...source, name: destName });
      this.directories[destParent] = destSiblings;
      if (input.move) {
        this.directories[srcParent] = srcSiblings.filter((c) => c.name !== srcName);
      }
    }
  }

  async updateObjectType(path: string, newType: string): Promise<void> {
    this.calls.push({ method: "updateObjectType", path, newType });
    this.throwIfConfigured("updateObjectType");
    const normalized = normalize(path);
    const parent = normalize(
      normalized.slice(0, normalized.lastIndexOf("/")) || "/",
    );
    const name = normalized.split("/").filter(Boolean).pop() ?? "";
    const children = this.directories[parent] ?? [];
    const idx = children.findIndex((c) => c.name === name);
    if (idx >= 0) {
      children[idx] = { ...children[idx], type: newType };
      this.directories[parent] = children;
    }
  }

  async updateAutoMetadata(paths: string[]): Promise<void> {
    this.calls.push({ method: "updateAutoMetadata", paths });
    this.throwIfConfigured("updateAutoMetadata");
  }

  async getDownloadUrls(paths: string[]): Promise<string[][]> {
    this.calls.push({ method: "getDownloadUrls", paths });
    this.throwIfConfigured("getDownloadUrls");
    return paths.map((path) => this.downloadUrls[normalize(path)] ?? [`https://shock.test/dl/${normalize(path)}`]);
  }

  async getArchiveUrl(input: ArchiveRequest): Promise<ArchiveResult> {
    this.calls.push({ method: "getArchiveUrl", input });
    this.throwIfConfigured("getArchiveUrl");
    return [`https://shock.test/archive/${input.archiveName}`, input.paths.length, 0];
  }

  async searchObjects(
    input: SearchWorkspaceObjectsInput,
  ): Promise<WorkspaceItem[]> {
    this.calls.push({ method: "searchObjects", input });
    this.throwIfConfigured("searchObjects");
    const path = input.path ?? "/home/";
    const userSegment = input.username.includes("@")
      ? input.username
      : `${input.username}@bvbrc`;
    const rootPath = normalize(`/${userSegment}${path}`);

    const results: WorkspaceItem[] = [];
    const seen = new Set<string>();
    const visit = (dir: string) => {
      if (seen.has(dir)) return;
      seen.add(dir);
      const children = this.directories[dir] ?? [];
      children.forEach((f, i) => {
        const item = toWorkspaceItem(toBrowserItem(dir, f, i));
        const isFolderLike = /folder|job_result|modelfolder|group/.test(item.type);
        const typeMatches = !input.types || input.types.includes(item.type);
        const nameMatches =
          !input.name || item.name.toLowerCase().includes(input.name.toLowerCase());
        if (typeMatches && nameMatches) results.push(item);
        if (isFolderLike) visit(item.path);
      });
    };
    visit(rootPath);
    return results;
  }

  async diskUsage(
    paths: string[],
    recursive = true,
  ): Promise<[string, number, number, number, string][]> {
    this.calls.push({ method: "diskUsage", paths, recursive });
    this.throwIfConfigured("diskUsage");
    return paths.map((path) => {
      const entry = this.diskUsageMap[normalize(path)];
      if (entry) return [path, ...entry] as [string, number, number, number, string];
      return [path, 0, 0, 0, ""];
    });
  }
}
