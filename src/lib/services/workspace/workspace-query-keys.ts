/**
 * Centralized TanStack Query key factory for workspace queries.
 *
 * Every workspace query should use these helpers so invalidation is
 * consistent across the app. `workspaceQueryKeys.all` is the common prefix —
 * invalidating it after a mutation refetches the browser, shared listings,
 * path listings, metadata, permissions, etc.
 */

export const workspaceQueryKeys = {
  all: ["workspace"] as const,

  browser: (username: string, base: string, path: string) =>
    [...workspaceQueryKeys.all, "browser", username, base, path] as const,

  directory: (
    mode: string,
    key: Record<string, unknown>,
  ) => [...workspaceQueryKeys.all, "directory", mode, key] as const,

  listPath: (fullPath: string) =>
    [...workspaceQueryKeys.all, "list-path", fullPath] as const,

  sharedRoot: (username: string) =>
    [...workspaceQueryKeys.all, "shared", username] as const,

  userRoot: (username: string) =>
    [...workspaceQueryKeys.all, "user", username] as const,

  publicRoot: () => [...workspaceQueryKeys.all, "public", "root"] as const,
  publicUser: (username: string) =>
    [...workspaceQueryKeys.all, "public", "user", username] as const,
  publicPath: (fullPath: string) =>
    [...workspaceQueryKeys.all, "public", "path", fullPath] as const,

  metadata: (paths: string[]) =>
    [...workspaceQueryKeys.all, "get", paths] as const,

  permissions: (paths: string[]) =>
    [...workspaceQueryKeys.all, "permissions", paths] as const,

  pathResolve: (fullPath: string) =>
    [...workspaceQueryKeys.all, "path-resolve", fullPath] as const,

  jobResult: (dotPath: string) =>
    [...workspaceQueryKeys.all, "job-result", dotPath] as const,

  du: (path: string) => [...workspaceQueryKeys.all, "du", path] as const,

  favorites: (userRoot: string) =>
    [...workspaceQueryKeys.all, "favorites", userRoot] as const,

  miniBrowser: (path: string) =>
    [...workspaceQueryKeys.all, "mini-browser", path] as const,

  search: (username: string, path: string, typesKey: string) =>
    [...workspaceQueryKeys.all, "search", username, path, typesKey] as const,
};

/**
 * Invalidate everything under the workspace root. Use after any mutation that
 * changes workspace state so dependent listings refetch. For narrow
 * invalidations pass a more specific key.
 */
export function invalidateWorkspace(queryClient: {
  invalidateQueries: (opts: { queryKey: readonly unknown[] }) => unknown;
}): void {
  void queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.all });
}
