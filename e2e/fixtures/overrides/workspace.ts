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
  /**
   * When true, `Workspace.create` echoes back the filename it was asked to create AND any
   * subsequent `Workspace.ls` for the create's parent directory includes the new tuple. Lets
   * upload specs assert that the listing actually refreshes with the uploaded file.
   */
  reflectUploads?: boolean;
  /**
   * When true, append a permissive `{ result: [[]] }` fallback for any `Workspace.*` RPC
   * the explicit overrides above don't match. Lets older specs avoid declaring every RPC
   * the page might fire. Default: `false` — matches the strict-mock spirit of journey
   * overrides so new RPC traffic surfaces as a strict-mode failure rather than being
   * silently swallowed.
   */
  permissiveCatchall?: boolean;
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
 * Resolve a workspace path against a pathItems map. A path matches when:
 *   1. It is a child file/folder listed under one of the directory keys (parent + "/" + name).
 *   2. It is a directory key itself — synthesizes a folder tuple so directory existence checks
 *      (Workspace.get on a folder path) return metadata instead of 404.
 * Returns null when no match is found so callers can fall back to a 500 "not found" response.
 */
function findKnownItem(
  pathItems: Record<string, TupleItem[]>,
  fullPath: string,
): TupleItem | null {
  for (const [parent, items] of Object.entries(pathItems)) {
    const parentNoTrailing = parent.replace(/\/+$/, "");
    for (const item of items) {
      if (`${parentNoTrailing}/${item.name}` === fullPath) return item;
    }
  }
  if (pathItems[fullPath]) {
    const lastSlash = fullPath.lastIndexOf("/");
    const name = lastSlash >= 0 ? fullPath.slice(lastSlash + 1) : fullPath;
    const parentPath = lastSlash > 0 ? fullPath.slice(0, lastSlash) : "/";
    return { name, type: "folder", parentPath };
  }
  return null;
}

/**
 * Build a workspace override set backed by tuple-encoded RPC responses. Covers the three RPC
 * methods the browser hits on load (`ls`, `list_permissions`, `get` for favorites) plus the
 * preview/view proxy endpoints. Designed so specs can compose scenarios without re-specifying
 * the full RPC plumbing.
 */
export function buildWorkspaceOverrides(
  options: BuildWorkspaceOverridesOptions = {},
): JsonOverride[] {
  const pathItems = { ...(options.pathItems ?? { [e2eHomePath]: defaultHomeItems }) };
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
    // Function body lets reflectUploads mutate `pathItems` between calls (Workspace.create
    // appends the new tuple, then the next Workspace.ls picks it up).
    body: () => ({ result: mockWorkspaceLsResult({ pathItems }) }),
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
    body: ({ parsedBody }) => {
      // Use the requested path as the map key so parseLsResult — which does an exact lookup
      // by `requestedPath` — always finds the items, regardless of how the caller built the
      // path (`@bvbrc` vs `@patricbrc.org`, trailing slash, etc.).
      const params = (parsedBody as { params?: unknown[] } | null)?.params?.[0] as
        | { paths?: string[] }
        | undefined;
      const requestedPath = params?.paths?.[0] ?? `/${e2eUsername}/home/`;
      return {
        result: [
          {
            [requestedPath]: searchItems.map(workspaceTuple),
          },
        ],
      };
    },
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

  // Mirror back whatever filename the request asked to create. With reflectUploads on, we also
  // append the new tuple to `pathItems` so the next Workspace.ls picks it up — the listing
  // refresh that the upload dialog triggers is what surfaces the row in the UI.
  const createOverride: JsonOverride = {
    url: /\/api\/services\/workspace(?:$|\?)/,
    method: "POST",
    matchBody: (parsed) =>
      (parsed as { method?: string } | null)?.method === "Workspace.create",
    body: ({ parsedBody }) => {
      const params = (parsedBody as { params?: unknown[] } | null)?.params?.[0] as
        | { objects?: unknown[][] }
        | undefined;
      const firstObject = params?.objects?.[0];
      const fullPath = Array.isArray(firstObject) ? String(firstObject[0]) : "";
      const type = Array.isArray(firstObject) ? String(firstObject[1] ?? "unspecified") : "unspecified";
      const lastSlash = fullPath.lastIndexOf("/");
      const name = lastSlash >= 0 ? fullPath.slice(lastSlash + 1) : fullPath || "uploaded";
      const parentPath = lastSlash > 0 ? fullPath.slice(0, lastSlash) : e2eHomePath;
      if (options.reflectUploads) {
        const existing = pathItems[parentPath] ?? [];
        if (!existing.some((it) => it.name === name)) {
          pathItems[parentPath] = [
            ...existing,
            { name, type, parentPath, creationTime: "2026-04-20T00:00:00Z", size: 0 },
          ];
        }
      }
      return {
        result: [
          [
            [
              name,
              type,
              `${parentPath}/`,
              "2026-04-20T00:00:00Z",
              `id-${name}`,
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
      };
    },
  };

  const updateMetaOverride = workspaceRpcOverride(
    "Workspace.update_auto_meta",
    { result: [[]] },
  );

  // Workspace.du fires whenever a folder is selected in the browser (the details panel
  // calls it for disk-usage). Returning an empty tuple-array is enough — the panel just
  // renders zero size when no entry matches. Pinning it here keeps the strict-mock
  // contract intact without forcing every spec that selects a folder to opt in.
  const duOverride = workspaceRpcOverride(
    "Workspace.du",
    { result: [[]] },
  );

  // Workspace.get serves two distinct UI flows:
  //   1. Path resolution (`useWorkspacePathResolve`) — must succeed with metadata for any path
  //      that actually exists in `pathItems`, otherwise the workspace browser shows the "Folder
  //      not found" dialog when navigating into a real subfolder.
  //   2. Output-name availability (`checkWorkspaceObjectExists`) — must return non-200 for paths
  //      that don't exist, otherwise the form's submit button stays disabled.
  // We resolve known paths against the assembled `pathItems` map. Unknown paths fall through to
  // a 500 so the availability check treats them as available.
  const getKnownOverride: JsonOverride = {
    url: /\/api\/services\/workspace(?:$|\?)/,
    method: "POST",
    matchBody: (parsed) => {
      const body = parsed as { method?: string; params?: unknown[] } | null;
      if (body?.method !== "Workspace.get") return false;
      const objects = (body.params?.[0] as { objects?: string[] } | undefined)?.objects ?? [];
      return objects.some((p) => findKnownItem(pathItems, p) !== null);
    },
    body: ({ parsedBody }) => {
      const objects =
        ((parsedBody as { params?: unknown[] } | null)?.params?.[0] as
          | { objects?: string[] }
          | undefined)?.objects ?? [];
      const perPath = objects.map((p) => {
        const item = findKnownItem(pathItems, p);
        return item ? [workspaceTuple(item)] : [];
      });
      return { result: [perPath] };
    },
  };

  const getNotFoundOverride: JsonOverride = {
    url: /\/api\/services\/workspace(?:$|\?)/,
    method: "POST",
    matchBody: (parsed) =>
      (parsed as { method?: string } | null)?.method === "Workspace.get",
    status: 500,
    body: { error: { code: -32000, message: "Object not found" } },
  };

  // Fallback for any Workspace.* methods we haven't explicitly mocked. Off by default —
  // turning this on weakens strict-mode by silently swallowing unknown RPCs. Specs that
  // rely on it should opt in via `permissiveCatchall: true`.
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
    duOverride,
    ...(options.extraRpc ?? []),
    getKnownOverride,
    getNotFoundOverride,
    ...(options.permissiveCatchall ? [workspaceCatchall] : []),
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
