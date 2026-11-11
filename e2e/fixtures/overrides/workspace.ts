import {
  buildBrowserRpcError,
  buildBrowserRpcSuccess,
} from "@/lib/e2e-fixtures/envelopes";
import type { JsonOverride } from "../../mocks/backends";

export const e2eUsername = "e2e-test-user@patricbrc.org";
export const e2eHomePath = `/${e2eUsername}/home`;

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
 * Tuple shape parsed by `parseTupleToRawObject` in
 * src/lib/services/workspace/adapters/parsers.ts.
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
  pathItems: Record<string, TupleItem[]>;
}

export function mockWorkspaceLsResult(options: MockLsOptions): unknown {
  const map: Record<string, unknown[][]> = {};
  for (const [path, items] of Object.entries(options.pathItems)) {
    map[path] = items.map(workspaceTuple);
  }
  return [map];
}

export function mockListPermissionsResult(paths: string[]): unknown {
  const map: Record<string, [string, string][]> = {};
  for (const path of paths) {
    map[path] = [[e2eUsername, "o"]];
  }
  return [map];
}

export function mockWorkspaceGetContent(content: string): unknown {
  return [[[{ name: "favorites.json", type: "json" }, content]]];
}

export function workspaceRpcOverride(
  rpcMethod: string,
  body: string | object,
): JsonOverride {
  return {
    url: /\/api\/services\/workspace(?:$|\?)/,
    method: "POST",
    matchBody: (parsed) => (parsed as { method?: string } | null)?.method === rpcMethod,
    body,
  };
}

/**
 * List before `buildWorkspaceOverrides(...)`: its `Workspace.get` entries
 * answer every path and the first match wins.
 */
export function workspaceObjectContentOverride(
  item: TupleItem,
  content: string,
): JsonOverride {
  const path = `${item.parentPath.replace(/\/+$/, "")}/${item.name}`;
  return {
    url: /\/api\/services\/workspace(?:$|\?)/,
    method: "POST",
    matchBody: (parsed) => {
      const body = parsed as {
        method?: string;
        params?: [{ objects?: string[]; metadata_only?: boolean }];
      } | null;
      return (
        body?.method === "Workspace.get" &&
        body.params?.[0].metadata_only === false &&
        body.params[0].objects?.length === 1 &&
        body.params[0].objects[0] === path
      );
    },
    body: buildBrowserRpcSuccess([[[workspaceTuple(item), content]]]),
  };
}

interface BuildWorkspaceOverridesOptions {
  pathItems?: Record<string, TupleItem[]>;
  favorites?: string[];
  searchItems?: TupleItem[];
  extraRpc?: JsonOverride[];
  /**
   * Appends file `Workspace.create` tuples to `pathItems` so the next ls
   * shows the upload.
   */
  reflectUploads?: boolean;
  /**
   * Appends folder `Workspace.create` tuples to `pathItems`; independent of
   * `reflectUploads`.
   */
  reflectFolderCreates?: boolean;
  /**
   * Answers unmatched `Workspace.*` RPCs with `{ result: [[]] }`; off by
   * default so unknown traffic fails strict mode.
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

function findKnownItem(
  pathItems: Partial<Record<string, TupleItem[]>>,
  fullPath: string,
): TupleItem | null {
  for (const [parent, items] of Object.entries(pathItems)) {
    if (!items) continue;
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
      return params?.recursive !== true;
    },
    // The function body lets the reflect flags mutate `pathItems` between
    // calls.
    body: () => buildBrowserRpcSuccess(mockWorkspaceLsResult({ pathItems })),
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
      // Keyed by requested path so parseLsResult's exact lookup always hits,
      // whatever the realm or trailing slash.
      const params = (parsedBody as { params?: unknown[] } | null)?.params?.[0] as
        | { paths?: string[] }
        | undefined;
      const requestedPath = params?.paths?.[0] ?? `/${e2eUsername}/home/`;
      return buildBrowserRpcSuccess([
        {
          [requestedPath]: searchItems.map(workspaceTuple),
        },
      ]);
    },
  };

  const listPermsOverride = workspaceRpcOverride(
    "Workspace.list_permissions",
    buildBrowserRpcSuccess(mockListPermissionsResult(Object.keys(pathItems))),
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
    body: buildBrowserRpcSuccess(
      mockWorkspaceGetContent(JSON.stringify({ folders: favorites })),
    ),
  };

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
      const fullPath = Array.isArray(firstObject) ? String(firstObject[0] as string | number | undefined ?? "") : "";
      const type = Array.isArray(firstObject) ? ((firstObject[1] as string | undefined) ?? "unspecified") : "unspecified";
      const lastSlash = fullPath.lastIndexOf("/");
      const name = lastSlash >= 0 ? fullPath.slice(lastSlash + 1) : fullPath || "uploaded";
      const parentPath = lastSlash > 0 ? fullPath.slice(0, lastSlash) : e2eHomePath;
      const isDirectory = type === "Directory";
      const shouldReflect = isDirectory
        ? options.reflectFolderCreates === true
        : options.reflectUploads === true;
      if (shouldReflect) {
        const existing = pathItems[parentPath] ?? [];
        if (!existing.some((it) => it.name === name)) {
          pathItems[parentPath] = [
            ...existing,
            { name, type, parentPath, creationTime: "2026-04-20T00:00:00Z", size: 0 },
          ];
        }
      }
      return buildBrowserRpcSuccess([
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
      ]);
    },
  };

  const updateMetaOverride = workspaceRpcOverride(
    "Workspace.update_auto_meta",
    buildBrowserRpcSuccess([[]]),
  );

  const duOverride = workspaceRpcOverride(
    "Workspace.du",
    buildBrowserRpcSuccess([[]]),
  );

  // Known paths resolve against `pathItems` (path resolution needs them);
  // unknown ones get a 500 so the output-name availability check treats them
  // as free.
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
      return buildBrowserRpcSuccess([perPath]);
    },
  };

  const getNotFoundOverride: JsonOverride = {
    url: /\/api\/services\/workspace(?:$|\?)/,
    method: "POST",
    matchBody: (parsed) =>
      (parsed as { method?: string } | null)?.method === "Workspace.get",
    status: 500,
    // The proxy answers a missing object with an HTTP 500 carrying its
    // message in `apiResponse` (see `sanitizeUpstreamError`), which
    // `workspace-errors.ts` reads.
    body: {
      error: "BV-BRC API error: 500 Internal Server Error",
      apiResponse: { code: -32603, message: "_ERROR_Object not found!_" },
    },
  };

  const workspaceCatchall: JsonOverride = {
    url: /\/api\/services\/workspace(?:$|\?)/,
    method: "POST",
    body: buildBrowserRpcSuccess([[]]),
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

export const workspaceOverrides: JsonOverride[] = [
  {
    url: /\/services\/Workspace/,
    method: "POST",
    body: buildBrowserRpcSuccess([mockWorkspaceItems]),
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

export const workspacePopulatedOverrides = buildWorkspaceOverrides();

export const workspaceEmptyOverrides = buildWorkspaceOverrides({
  pathItems: { [e2eHomePath]: [] },
});

export const workspaceErrorOverrides: JsonOverride[] = [
  {
    url: /\/api\/services\/workspace(?:$|\?)/,
    method: "POST",
    matchBody: (parsed) =>
      (parsed as { method?: string } | null)?.method === "Workspace.ls",
    body: buildBrowserRpcError(-32000, "Simulated workspace failure"),
  },
  workspaceRpcOverride(
    "Workspace.list_permissions",
    buildBrowserRpcSuccess(mockListPermissionsResult([e2eHomePath])),
  ),
  {
    url: /\/api\/services\/workspace(?:$|\?)/,
    method: "POST",
    body: buildBrowserRpcSuccess([[]]),
  },
];
