"use client";

import { useQuery } from "@tanstack/react-query";
import { WorkspaceApiClient } from "@/lib/services/workspace/client";
import type { WorkspaceDuResponse } from "@/lib/services/workspace/types";

const client = new WorkspaceApiClient();

export interface WorkspaceDuResult {
  sizeBytes: number;
  files: number;
  folders: number;
}

async function fetchWorkspaceDu(path: string): Promise<WorkspaceDuResult> {
  const result = await client.makeRequest<WorkspaceDuResponse>(
    "Workspace.du",
    [{ paths: [path], recursive: true, adminmode: false }],
    { silent: true },
  );
  if (!result?.[0]?.[0]) {
    return { sizeBytes: 0, files: 0, folders: 0 };
  }
  const entry = result[0][0];
  return {
    sizeBytes: typeof entry[1] === "number" ? entry[1] : 0,
    files: typeof entry[2] === "number" ? entry[2] : 0,
    folders: typeof entry[3] === "number" ? entry[3] : 0,
  };
}

export function useWorkspaceDu(path: string | null) {
  return useQuery<WorkspaceDuResult, Error>({
    queryKey: ["workspace-du", path],
    queryFn: () => fetchWorkspaceDu(path!),
    enabled: !!path,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
