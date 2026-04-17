"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceRepository } from "@/contexts/workspace-repository-context";
import { workspaceQueryKeys } from "@/lib/services/workspace/workspace-query-keys";

export interface WorkspaceDuResult {
  sizeBytes: number;
  files: number;
  folders: number;
}

export function useWorkspaceDu(path: string | null) {
  const repository = useWorkspaceRepository("authenticated");
  return useQuery<WorkspaceDuResult, Error>({
    queryKey: workspaceQueryKeys.du(path ?? ""),
    queryFn: async () => {
      if (!path) return { sizeBytes: 0, files: 0, folders: 0 };
      const entries = await repository.diskUsage([path], true);
      const entry = entries[0];
      if (!entry) return { sizeBytes: 0, files: 0, folders: 0 };
      return {
        sizeBytes: typeof entry[1] === "number" ? entry[1] : 0,
        files: typeof entry[2] === "number" ? entry[2] : 0,
        folders: typeof entry[3] === "number" ? entry[3] : 0,
      };
    },
    enabled: !!path,
    staleTime: 2 * 60 * 1000,
  });
}
