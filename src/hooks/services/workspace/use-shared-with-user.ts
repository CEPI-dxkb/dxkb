"use client";

import { useQuery } from "@tanstack/react-query";
import { WorkspaceBrowserItem } from "@/types/workspace-browser";
import {
  listSharedWithUser,
  listUserWorkspaces,
  listByFullPath,
  listPermissions,
  getWorkspaceMetadata,
  type ListPermissionsResult,
  type WorkspaceGetResult,
} from "@/lib/services/workspace/shared";

interface UseSharedWithUserOptions {
  username: string;
  enabled?: boolean;
  initialData?: WorkspaceBrowserItem[];
}

export function useSharedWithUser({
  username,
  enabled = true,
  initialData,
}: UseSharedWithUserOptions) {
  return useQuery<WorkspaceBrowserItem[], Error>({
    queryKey: ["workspace-shared", username],
    queryFn: listSharedWithUser,
    enabled: enabled && !!username,
    initialData,
    staleTime: 2 * 60 * 1000,

  });
}

interface UseUserWorkspacesOptions {
  username: string;
  enabled?: boolean;
  initialData?: WorkspaceBrowserItem[];
}

export function useUserWorkspaces({
  username,
  enabled = true,
  initialData,
}: UseUserWorkspacesOptions) {
  return useQuery<WorkspaceBrowserItem[], Error>({
    queryKey: ["workspace-user", username],
    queryFn: () => listUserWorkspaces(username),
    enabled: enabled && !!username,
    initialData,
    staleTime: 2 * 60 * 1000,

  });
}

interface UseWorkspaceGetOptions {
  objectPaths: string[];
  enabled?: boolean;
}

export function useWorkspaceGet({
  objectPaths,
  enabled = true,
}: UseWorkspaceGetOptions) {
  return useQuery<WorkspaceGetResult, Error>({
    queryKey: ["workspace-get", objectPaths],
    queryFn: () => getWorkspaceMetadata(objectPaths),
    enabled: enabled && objectPaths.length > 0,
    staleTime: 2 * 60 * 1000,

  });
}

interface UseWorkspaceListByPathOptions {
  fullPath: string;
  enabled?: boolean;
  initialData?: WorkspaceBrowserItem[];
}

export function useWorkspaceListByPath({
  fullPath,
  enabled = true,
  initialData,
}: UseWorkspaceListByPathOptions) {
  return useQuery<WorkspaceBrowserItem[], Error>({
    queryKey: ["workspace-list-path", fullPath],
    queryFn: () => listByFullPath(fullPath),
    enabled: enabled && !!fullPath,
    initialData,
    staleTime: 2 * 60 * 1000,

  });
}

interface UseWorkspacePermissionsOptions {
  paths: string[];
  enabled?: boolean;
  initialData?: ListPermissionsResult;
}

export function useWorkspacePermissions({
  paths,
  enabled = true,
  initialData,
}: UseWorkspacePermissionsOptions) {
  return useQuery<ListPermissionsResult, Error>({
    queryKey: ["workspace-permissions", paths],
    queryFn: () => listPermissions(paths),
    enabled: enabled && paths.length > 0,
    initialData,
    staleTime: 2 * 60 * 1000,

  });
}
