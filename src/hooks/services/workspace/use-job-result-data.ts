"use client";

import { useQuery } from "@tanstack/react-query";
import { getWorkspaceMetadata } from "@/lib/services/workspace/shared";
import {
  getJobResultDotPath,
  parseWorkspaceGetSingle,
} from "@/lib/services/workspace/helpers";
import { workspaceQueryKeys } from "@/lib/services/workspace/workspace-query-keys";
import type { ResolvedPathObject } from "@/lib/services/workspace/types";

export interface JobResultData {
  dotPath: string;
  dotMeta: ResolvedPathObject | null;
}

interface UseJobResultDataOptions {
  resolvedJobMeta: ResolvedPathObject | null | undefined;
  enabled?: boolean;
}

export function useJobResultData({
  resolvedJobMeta,
  enabled = true,
}: UseJobResultDataOptions) {
  const dotPath =
    resolvedJobMeta != null ? getJobResultDotPath(resolvedJobMeta) : "";

  const dotGetQuery = useQuery<ResolvedPathObject | null>({
    queryKey: workspaceQueryKeys.jobResultResolved(dotPath),
    queryFn: async () => {
      const raw = await getWorkspaceMetadata([dotPath]);
      return parseWorkspaceGetSingle(raw, 0);
    },
    enabled: enabled && !!dotPath,
    staleTime: 2 * 60 * 1000,
  });

  return {
    dotPath,
    dotMeta: dotGetQuery.data ?? null,
    dotMetaQuery: dotGetQuery,
  };
}
