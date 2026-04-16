import { keepPreviousData } from "@tanstack/react-query";
import { useApiQuery } from "@/lib/api/hooks";
import { apiCall } from "@/lib/api/client";
import type { JobListItem } from "@/types/workspace";

interface UseJobsDataParams {
  offset: number;
  limit: number;
  includeArchived: boolean;
  sortField: string;
  sortOrder: "asc" | "desc";
  app?: string;
  startTime?: string;
  endTime?: string;
  refetchInterval?: number;
}

interface UseJobsDataResult {
  jobs: JobListItem[];
  totalTasks: number;
}

export function useJobsData(params: UseJobsDataParams) {
  const {
    offset, limit, includeArchived,
    sortField, sortOrder, app,
    startTime, endTime,
    refetchInterval = 10_000,
  } = params;

  return useApiQuery<UseJobsDataResult>({
    queryKey: [
      "jobs-filtered", offset, limit, includeArchived,
      sortField, sortOrder, app, startTime, endTime,
    ],
    placeholderData: keepPreviousData,
    refetchInterval,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const data = await apiCall<{ jobs: unknown; totalTasks: number }>(
        "/api/services/app-service/jobs/enumerate-tasks-filtered",
        {
          offset, limit,
          include_archived: includeArchived,
          sort_field: sortField,
          sort_order: sortOrder,
          app,
          start_time: startTime,
          end_time: endTime,
        },
      );
      const raw = Array.isArray(data.jobs) ? data.jobs : [];
      const jobs = (Array.isArray(raw[0]) ? raw[0] : raw) as JobListItem[];
      const totalTasks = typeof data.totalTasks === "number" ? data.totalTasks : 0;
      return { jobs, totalTasks };
    },
  });
}
