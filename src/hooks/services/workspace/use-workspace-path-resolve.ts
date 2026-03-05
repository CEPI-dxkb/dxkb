"use client";

import { useQuery } from "@tanstack/react-query";
import { getWorkspaceMetadata } from "@/lib/services/workspace/shared";
import { parseWorkspaceGetSingle } from "@/lib/services/workspace/helpers";
import type { ResolvedPathObject } from "@/lib/services/workspace/types";

interface UseWorkspacePathResolveOptions {
  fullPath: string;
  enabled?: boolean;
}

/**
 * Resolves a single workspace path via Workspace.get and returns the parsed object (type, name, path, job metadata when job_result).
 */
export function useWorkspacePathResolve({
  fullPath,
  enabled = true,
}: UseWorkspacePathResolveOptions) {
  return useQuery<ResolvedPathObject | null, Error>({
    queryKey: ["workspace-path-resolve", fullPath],
    queryFn: async () => {
      const raw = await getWorkspaceMetadata([fullPath]);
      return parseWorkspaceGetSingle(raw as unknown[], 0);
    },
    enabled: enabled && !!fullPath,
    staleTime: 2 * 60 * 1000,
  });
}
