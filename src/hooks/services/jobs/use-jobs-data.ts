import { useApiQuery } from "@/hooks/use-api-query";
import type { JobListItem } from "@/types/workspace";

interface UseJobsDataParams {
  offset: number;
  limit: number;
  includeArchived: boolean;
  sortField: string;
  sortOrder: "asc" | "desc";
  app?: string;
  refetchInterval?: number;
}

export function useJobsData(params: UseJobsDataParams) {
  const {
    offset, limit, includeArchived,
    sortField, sortOrder, app,
    refetchInterval = 10_000,
  } = params;

  return useApiQuery<JobListItem[]>({
    url: "/api/services/app-service/jobs/enumerate-tasks-filtered",
    method: "POST",
    body: {
      offset,
      limit,
      include_archived: includeArchived,
      sort_field: sortField,
      sort_order: sortOrder,
      app,
    },
    queryKey: [
      "jobs-filtered",
      offset,
      limit,
      includeArchived,
      sortField,
      sortOrder,
      app,
    ],
    select: (data) => {
      const raw = (data as { jobs?: unknown }).jobs ?? [];
      // BV-BRC JSON-RPC wraps enumeration results in an extra array
      return Array.isArray((raw as unknown[])[0]) ? (raw as unknown[][])[0] as JobListItem[] : raw as JobListItem[];
    },
    queryOptions: {
      refetchInterval,
      refetchIntervalInBackground: false,
    },
  });
}
