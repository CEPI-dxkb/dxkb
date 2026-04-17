"use client";

import { useQuery } from "@tanstack/react-query";
import { WorkspaceBrowserItem } from "@/types/workspace-browser";
import {
  listSharedWithUser,
  listUserWorkspaces,
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
