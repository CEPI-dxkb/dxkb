import type { JsonOverride } from "../../mocks/backends";

export const e2eUsername = "e2e-test-user@patricbrc.org";
export const e2eHomePath = `/${e2eUsername}/home`;

/**
 * Legacy object-shaped items kept for the earlier smoke specs that still read them directly.
 * New specs should use `workspaceTuple(...)` + `mockWorkspaceLs(...)` to build realistic
 * tuple-encoded JSON-RPC responses instead.
 */
export const mockWorkspaceItems = [
  {
    name: "home",
    path: e2eHomePath,
    type: "folder",
    size: 0,
    created: "2026-01-01T00:00:00Z",
    updated: "2026-04-01T00:00:00Z",
  },
  {
    name: "sample.fastq",
    path: `${e2eHomePath}/sample.fastq`,
    type: "reads",
    size: 1048576,
    created: "2026-03-01T00:00:00Z",
    updated: "2026-03-01T00:00:00Z",
  },
  {
    name: "favorites.json",
    path: `${e2eHomePath}/favorites.json`,
    type: "json",
    size: 2,
    created: "2026-01-01T00:00:00Z",
    updated: "2026-01-01T00:00:00Z",
  },
];

/**
 * Matches the tuple shape parsed by `metaListToObj` in
 * src/lib/services/workspace/helpers.ts: [name, type, parent, creation_time, id, owner_id, size,
 * userMeta, autoMeta, user_perm, global_perm, link_reference].
 */
export interface TupleItem {
  name: string;
  type: string;
  parentPath: string;
  creationTime?: string;
  id?: string;
  ownerId?: string;
  size?: number;
  userMeta?: Record<string, unknown>;
  autoMeta?: Record<string, unknown>;
  userPermission?: string;
  globalPermission?: string;
  linkReference?: string;
}

export function workspaceTuple(item: TupleItem): unknown[] {
  const parentWithSlash = item.parentPath.endsWith("/") ? item.parentPath : `${item.parentPath}/`;
  return [
    item.name,
    item.type,
    parentWithSlash,
    item.creationTime ?? "2026-04-01T00:00:00Z",
    item.id ?? `id-${item.name}`,
    item.ownerId ?? e2eUsername,
    item.size ?? 0,
    item.userMeta ?? {},
    item.autoMeta ?? {},
    item.userPermission ?? "o",
    item.globalPermission ?? "n",
    item.linkReference ?? "",
  ];
}

interface MockLsOptions {
  /** Keyed by the requested parent path (no trailing slash) → items returned for that path. */
  pathItems: Record<string, TupleItem[]>;
}

/** Build the `result` payload for a `Workspace.ls` RPC call covering one or more paths. */
export function mockWorkspaceLsResult(options: MockLsOptions): unknown {
  const map: Record<string, unknown[][]> = {};
  for (const [path, items] of Object.entries(options.pathItems)) {
    map[path] = items.map(workspaceTuple);
  }
  return [map];
}

/**
 * `Workspace.list_permissions` result. Each item's entries are `[user, permission]` pairs. We
 * give `o` (owner) on every path by default so the UI treats the current user as the writer.
 */
export function mockListPermissionsResult(paths: string[]): unknown {
  const map: Record<string, [string, string][]> = {};
  for (const path of paths) {
    map[path] = [[e2eUsername, "o"]];
  }
  return [map];
}

/**
 * `Workspace.get` result for a single file containing string content at position [0][0][1].
 */
export function mockWorkspaceGetContent(content: string): unknown {
  return [[[{ name: "favorites.json", type: "json" }, content]]];
}

/**
 * Workspace RPC override routed by method name. Lets multiple overrides share the
 * `/api/services/workspace` endpoint by matching on the parsed body's `method` field.
 */
export function workspaceRpcOverride(
  rpcMethod: string,
  body: unknown,
): JsonOverride {
  return {
    url: /\/api\/services\/workspace(?:$|\?)/,
    method: "POST",
    matchBody: (parsed) => (parsed as { method?: string } | null)?.method === rpcMethod,
    body,
  };
}

interface BuildWorkspaceOverridesOptions {
  /** Directory path → tuples returned by Workspace.ls. Default: home populated with 3 items. */
  pathItems?: Record<string, TupleItem[]>;
  /** Favorites.json folder list returned by Workspace.get. Default: empty. */
  favorites?: string[];
  /** Items returned by the object-selector search (Workspace.ls with recursive=true). */
  searchItems?: TupleItem[];
  /** Optional extra RPC method overrides to append. */
  extraRpc?: JsonOverride[];
}

const defaultHomeItems: TupleItem[] = [
  {
    name: "Datasets",
    type: "folder",
    parentPath: e2eHomePath,
    creationTime: "2026-02-01T00:00:00Z",
    size: 0,
  },
  {
    name: "Analysis",
    type: "folder",
    parentPath: e2eHomePath,
    creationTime: "2026-02-15T00:00:00Z",
    size: 0,
  },
  {
    name: "sample.fastq",
    type: "reads",
    parentPath: e2eHomePath,
    creationTime: "2026-03-01T00:00:00Z",
    size: 1048576,
  },
  {
    name: "notes.json",
    type: "json",
    parentPath: e2eHomePath,
    creationTime: "2026-03-10T00:00:00Z",
    size: 64,
  },
  {
    name: "logo.png",
    type: "png",
    parentPath: e2eHomePath,
    creationTime: "2026-03-12T00:00:00Z",
    size: 2048,
  },
];

const favoritesPath = `/${e2eUsername}/home/.preferences/favorites.json`;

/**
 * Build a workspace override set backed by tuple-encoded RPC responses. Covers the three RPC
 * methods the browser hits on load (`ls`, `list_permissions`, `get` for favorites) plus the
 * preview/view proxy endpoints. Designed so specs can compose scenarios without re-specifying
 * the full RPC plumbing.
 */
export function buildWorkspaceOverrides(
  options: BuildWorkspaceOverridesOptions = {},
): JsonOverride[] {
  const pathItems = options.pathItems ?? { [e2eHomePath]: defaultHomeItems };
  const favorites = options.favorites ?? [];
  const searchItems = options.searchItems ?? defaultHomeItems;

  const lsOverride: JsonOverride = {
    url: /\/api\/services\/workspace(?:$|\?)/,
    method: "POST",
    matchBody: (parsed) => {
      const body = parsed as { method?: string; params?: unknown[] } | null;
      if (body?.method !== "Workspace.ls") return false;
      const params = body.params?.[0] as { paths?: string[]; recursive?: boolean } | undefined;
      // Recursive ls calls hit a different branch (object selector search).
      return params?.recursive !== true;
    },
    body: { result: mockWorkspaceLsResult({ pathItems }) },
  };

  const searchOverride: JsonOverride = {
    url: /\/api\/services\/workspace(?:$|\?)/,
    method: "POST",
    matchBody: (parsed) => {
      const body = parsed as { method?: string; params?: unknown[] } | null;
      if (body?.method !== "Workspace.ls") return false;
      const params = body.params?.[0] as { paths?: string[]; recursive?: boolean } | undefined;
      return params?.recursive === true;
    },
    body: (() => {
      // Use the first requested path as the map key so parseLsResult finds the items.
      return {
        result: [
          {
            [`/${e2eUsername}/home/`]: searchItems.map(workspaceTuple),
          },
        ],
      };
    })(),
  };

  const listPermsOverride = workspaceRpcOverride(
    "Workspace.list_permissions",
    { result: mockListPermissionsResult(Object.keys(pathItems)) },
  );

  const getOverride: JsonOverride = {
    url: /\/api\/services\/workspace(?:$|\?)/,
    method: "POST",
    matchBody: (parsed) => {
      const body = parsed as { method?: string; params?: unknown[] } | null;
      if (body?.method !== "Workspace.get") return false;
      const params = body.params?.[0] as { objects?: string[] } | undefined;
      return params?.objects?.includes(favoritesPath) ?? false;
    },
    body: {
      result: mockWorkspaceGetContent(JSON.stringify({ folders: favorites })),
    },
  };

  const createOverride = workspaceRpcOverride(
    "Workspace.create",
    {
      result: [
        [
          [
            "uploaded.txt",
            "unspecified",
            `${e2eHomePath}/`,
            "2026-04-20T00:00:00Z",
            "id-uploaded",
            e2eUsername,
            0,
            {},
            {},
            "o",
            "n",
            "http://127.0.0.1/shock/upload/stub",
          ],
        ],
      ],
    },
  );

  const updateMetaOverride = workspaceRpcOverride(
    "Workspace.update_auto_meta",
    { result: [[]] },
  );

  // Fallback for any Workspace.* methods we haven't explicitly mocked. Keeps strict happy.
  const workspaceCatchall: JsonOverride = {
    url: /\/api\/services\/workspace(?:$|\?)/,
    method: "POST",
    body: { result: [[]] },
  };

  return [
    lsOverride,
    searchOverride,
    listPermsOverride,
    getOverride,
    createOverride,
    updateMetaOverride,
    ...(options.extraRpc ?? []),
    workspaceCatchall,
    // Proxy / preview endpoints the file viewer calls.
    {
      url: /\/api\/workspace\/view\//,
      method: "GET",
      body: '{"hello":"world"}',
      headers: { "Content-Type": "text/plain" },
    },
    {
      url: /\/api\/workspace\/preview\//,
      method: "GET",
      body: { preview: "{}", contentType: "application/json" },
    },
    {
      url: /\/api\/services\/workspace\/upload/,
      method: "POST",
      body: { success: true, id: "upload-1" },
    },
  ];
}

/**
 * Legacy smoke-test override kept so the original `workspace.spec.ts` / `jobs.spec.ts` specs
 * continue to pass without modification. New specs should call `buildWorkspaceOverrides`.
 */
export const workspaceOverrides: JsonOverride[] = [
  {
    url: /\/services\/Workspace/,
    method: "POST",
    body: { result: [mockWorkspaceItems] },
  },
  {
    url: /\/api\/workspace\/view/,
    method: "GET",
    body: { items: mockWorkspaceItems },
  },
  {
    url: /\/api\/workspace\/preview/,
    method: "GET",
    body: { preview: "{}", contentType: "application/json" },
  },
];

/** Populated home workspace with a mix of folders, reads, JSON, and PNG. */
export const workspacePopulatedOverrides = buildWorkspaceOverrides();

/** Empty home workspace — `Workspace.ls` returns no items. */
export const workspaceEmptyOverrides = buildWorkspaceOverrides({
  pathItems: { [e2eHomePath]: [] },
});

/** `Workspace.ls` fails with a JSON-RPC error so the browser renders the error alert. */
export const workspaceErrorOverrides: JsonOverride[] = [
  {
    url: /\/api\/services\/workspace(?:$|\?)/,
    method: "POST",
    matchBody: (parsed) =>
      (parsed as { method?: string } | null)?.method === "Workspace.ls",
    body: {
      error: { code: -32000, message: "Simulated workspace failure" },
    },
  },
  workspaceRpcOverride("Workspace.list_permissions", {
    result: mockListPermissionsResult([e2eHomePath]),
  }),
  {
    url: /\/api\/services\/workspace(?:$|\?)/,
    method: "POST",
    body: { result: [[]] },
  },
];
