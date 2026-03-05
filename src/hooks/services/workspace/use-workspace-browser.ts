"use client";

import { useQuery } from "@tanstack/react-query";
import { WorkspaceBrowserItem } from "@/types/workspace-browser";
import { WorkspaceApiClient } from "@/lib/services/workspace/client";

const client = new WorkspaceApiClient();

function buildWorkspacePath(
  username: string,
  base: string,
  relativePath: string,
): string {
  // Callers (page components) already decode params via safeDecode; do not
  // decode again—decodeURIComponent throws on already-decoded strings with "%".
  // Username may already be "user@realm" from URL; do not append @bvbrc again.
  const userSegment = username.includes("@") ? username : `${username}@bvbrc`;
  const trimmed = relativePath.replace(/^\/+|\/+$/g, "");
  const root = `/${userSegment}/${base}`;
  return trimmed ? `${root}/${trimmed}` : root;
}

async function fetchDirectoryContents(
  username: string,
  base: string,
  relativePath: string,
): Promise<WorkspaceBrowserItem[]> {
  const fullPath = buildWorkspacePath(username, base, relativePath);

  const results = await client.makeRequest<WorkspaceBrowserItem[]>(
    "Workspace.ls",
    [{ paths: [fullPath], includeSubDirs: false, recursive: false }],
  );

  return results;
}

interface UseWorkspaceBrowserOptions {
  username: string;
  path: string;
  base?: string;
  enabled?: boolean;
}

export function useWorkspaceBrowser({
  username,
  path,
  base = "home",
  enabled = true,
}: UseWorkspaceBrowserOptions) {
  return useQuery<WorkspaceBrowserItem[], Error>({
    queryKey: ["workspace-browser", username, base, path],
    queryFn: () => fetchDirectoryContents(username, base, path),
    enabled: enabled && !!username,
    staleTime: 2 * 60 * 1000,
  });
}
