"use client";

import { useMemo } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { toWorkspaceItem, type WorkspaceItem } from "@/lib/services/workspace/domain";
import type { ListPermissionsResult } from "@/lib/services/workspace/domain";
import { workspaceQueryKeys } from "@/lib/services/workspace/workspace-query-keys";
import type { WorkspaceRepository } from "@/lib/services/workspace/workspace-repository";
import { useWorkspaceRepository } from "@/contexts/workspace-repository-context";
import type { WorkspaceBrowserItem } from "@/types/workspace-browser";

/**
 * Discriminated mode describing what the browser wants to show. Keep these
 * `kind` names stable — they're also used as the TanStack Query mode tag.
 */
export type WorkspaceDirectoryMode =
  | { kind: "home"; username: string; path: string }
  | { kind: "sharedRoot"; currentUser: string }
  | { kind: "sharedPath"; fullPath: string }
  | { kind: "publicRoot" }
  | { kind: "publicUser"; username: string }
  | { kind: "publicPath"; fullPath: string }
  | { kind: "jobResult"; fullPath: string; visiblePath: string };

export interface UseWorkspaceDirectoryOptions {
  /** Default true. When false, disables the query. */
  enabled?: boolean;
  /** Initial items to seed the query cache (e.g. from SSR). */
  initialItems?: WorkspaceItem[];
  /** Pre-fetched permissions map to seed the permissions query. */
  initialPermissions?: ListPermissionsResult;
}

export interface UseWorkspaceDirectoryReturn {
  items: WorkspaceItem[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => void;
  /** Permissions keyed by each item's path (authenticated modes only). */
  memberCountByPath: Record<string, number> | undefined;
  /** Raw permissions map (authenticated modes only). */
  permissions: ListPermissionsResult | undefined;
}

function buildHomePath(username: string, relativePath: string): string {
  const userSegment = username.includes("@") ? username : `${username}@bvbrc`;
  const trimmed = relativePath.replace(/^\/+|\/+$/g, "");
  return trimmed
    ? `/${userSegment}/home/${trimmed}`
    : `/${userSegment}/home`;
}

function normalizeFullPath(raw: string): string {
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // Leave malformed percent-encodings as-is rather than crashing the render.
    decoded = raw;
  }
  return decoded.startsWith("/") ? decoded : `/${decoded}`;
}

/**
 * Shared-root mode: merge the user's own top-level workspaces with the
 * workspaces shared with them. The repository exposes directory listings, so
 * we fetch both paths and de-dupe by `path`.
 */
async function fetchSharedRoot(
  repository: WorkspaceRepository,
  currentUser: string,
): Promise<WorkspaceItem[]> {
  const userSegment = currentUser.includes("@")
    ? currentUser
    : `${currentUser}@bvbrc`;
  const [rootListing, userListing] = await Promise.all([
    repository.listDirectory({ path: "/" }),
    repository.listDirectory({ path: `/${userSegment}` }),
  ]);
  const shared = rootListing.filter((item) => {
    const g = item.permissions?.global ?? "";
    const u = item.permissions?.user ?? "";
    if (g !== "n") return false;
    if (u === "o" && g === "n") return false;
    return true;
  });
  const byPath = new Map<string, WorkspaceItem>();
  for (const item of [...userListing, ...shared]) {
    if (!byPath.has(item.path)) byPath.set(item.path, item);
  }
  return Array.from(byPath.values());
}

async function fetchPublicRoot(
  repository: WorkspaceRepository,
): Promise<WorkspaceItem[]> {
  const items = await repository.listDirectory({ path: "/" });
  return items.filter((item) => (item.permissions?.global ?? "") !== "n");
}

async function fetchPublicUser(
  repository: WorkspaceRepository,
  username: string,
): Promise<WorkspaceItem[]> {
  if (!username) return [];
  const userSegment = username.includes("@") ? username : `${username}@bvbrc`;
  const items = await repository.listDirectory({ path: `/${userSegment}` });
  return items.filter((item) => (item.permissions?.global ?? "") !== "n");
}

function modeQueryKey(mode: WorkspaceDirectoryMode): readonly unknown[] {
  switch (mode.kind) {
    case "home":
      return workspaceQueryKeys.browser(mode.username, "home", mode.path);
    case "sharedRoot":
      return workspaceQueryKeys.directory("sharedRoot", {
        user: mode.currentUser,
      });
    case "sharedPath":
      return workspaceQueryKeys.listPath(normalizeFullPath(mode.fullPath));
    case "publicRoot":
      return workspaceQueryKeys.publicRoot();
    case "publicUser":
      return workspaceQueryKeys.publicUser(mode.username);
    case "publicPath":
      return workspaceQueryKeys.publicPath(normalizeFullPath(mode.fullPath));
    case "jobResult":
      return workspaceQueryKeys.jobResult(normalizeFullPath(mode.fullPath));
  }
}

function isAuthenticatedMode(mode: WorkspaceDirectoryMode): boolean {
  return (
    mode.kind === "home" ||
    mode.kind === "sharedRoot" ||
    mode.kind === "sharedPath" ||
    mode.kind === "jobResult"
  );
}

function isPublicMode(mode: WorkspaceDirectoryMode): boolean {
  return (
    mode.kind === "publicRoot" ||
    mode.kind === "publicUser" ||
    mode.kind === "publicPath"
  );
}

function modeDirectoryPath(mode: WorkspaceDirectoryMode): string | undefined {
  switch (mode.kind) {
    case "home":
      return buildHomePath(mode.username, mode.path);
    case "sharedPath":
      return normalizeFullPath(mode.fullPath);
    case "publicPath":
      return normalizeFullPath(mode.fullPath);
    case "jobResult":
      return normalizeFullPath(mode.fullPath);
    default:
      return undefined;
  }
}

async function fetchModeItems(
  repository: WorkspaceRepository,
  mode: WorkspaceDirectoryMode,
): Promise<WorkspaceItem[]> {
  switch (mode.kind) {
    case "home":
      return repository.listDirectory({
        path: buildHomePath(mode.username, mode.path),
      });
    case "sharedRoot":
      return fetchSharedRoot(repository, mode.currentUser);
    case "sharedPath":
      return repository.listDirectory({ path: normalizeFullPath(mode.fullPath) });
    case "publicRoot":
      return fetchPublicRoot(repository);
    case "publicUser":
      return fetchPublicUser(repository, mode.username);
    case "publicPath":
      return repository.listDirectory({ path: normalizeFullPath(mode.fullPath) });
    case "jobResult":
      return repository.listDirectory({ path: normalizeFullPath(mode.fullPath) });
  }
}

export function useWorkspaceDirectory(
  mode: WorkspaceDirectoryMode,
  options: UseWorkspaceDirectoryOptions = {},
): UseWorkspaceDirectoryReturn {
  const authenticated = useWorkspaceRepository("authenticated");
  const publicRepo = useWorkspaceRepository("public");
  const repository = isPublicMode(mode) ? publicRepo : authenticated;

  const enabled = options.enabled ?? true;

  const listingQuery: UseQueryResult<WorkspaceItem[], Error> = useQuery<
    WorkspaceItem[],
    Error
  >({
    queryKey: modeQueryKey(mode),
    queryFn: () => fetchModeItems(repository, mode),
    enabled,
    initialData: options.initialItems,
    staleTime: 2 * 60 * 1000,
  });

  const items = useMemo(() => listingQuery.data ?? [], [listingQuery.data]);
  const itemPaths = useMemo(() => items.map((i) => i.path), [items]);

  const permissionsQuery = useQuery<ListPermissionsResult, Error>({
    queryKey: workspaceQueryKeys.permissions(itemPaths),
    queryFn: () => repository.listPermissions(itemPaths),
    enabled: enabled && isAuthenticatedMode(mode) && itemPaths.length > 0,
    initialData: options.initialPermissions,
    staleTime: 2 * 60 * 1000,
  });

  const currentPath = modeDirectoryPath(mode);
  const currentPathPermissionsQuery = useQuery<ListPermissionsResult, Error>({
    queryKey: currentPath
      ? workspaceQueryKeys.permissions([currentPath])
      : workspaceQueryKeys.permissions([]),
    queryFn: () =>
      currentPath ? repository.listPermissions([currentPath]) : Promise.resolve({}),
    enabled:
      enabled &&
      isAuthenticatedMode(mode) &&
      !!currentPath &&
      mode.kind === "sharedPath",
    staleTime: 2 * 60 * 1000,
  });

  const isAuthenticated = isAuthenticatedMode(mode);

  const memberCountByPath = useMemo(() => {
    if (!isAuthenticated) return undefined;
    const perms = permissionsQuery.data;
    if (!perms) return undefined;
    const out: Record<string, number> = {};
    for (const path of itemPaths) {
      const list = perms[path];
      out[path] = Array.isArray(list) ? list.length : 0;
    }
    return out;
  }, [isAuthenticated, permissionsQuery.data, itemPaths]);

  const combinedPermissions = useMemo<ListPermissionsResult | undefined>(() => {
    if (!isAuthenticated) return undefined;
    const itemPerms = permissionsQuery.data ?? {};
    const currentPerms = currentPathPermissionsQuery.data ?? {};
    return { ...currentPerms, ...itemPerms };
  }, [isAuthenticated, permissionsQuery.data, currentPathPermissionsQuery.data]);

  return {
    items,
    isLoading: listingQuery.isLoading,
    isFetching: listingQuery.isFetching,
    error: listingQuery.error ?? null,
    refetch: () => {
      void listingQuery.refetch();
      void permissionsQuery.refetch();
      void currentPathPermissionsQuery.refetch();
    },
    memberCountByPath,
    permissions: combinedPermissions,
  };
}

/** Helper used during migration: converts an incoming `WorkspaceBrowserItem` list to canonical items. */
export function browserItemsToCanonical(
  items: WorkspaceBrowserItem[],
): WorkspaceItem[] {
  return items.map(toWorkspaceItem);
}
