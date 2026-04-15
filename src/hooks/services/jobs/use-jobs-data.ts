import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useAuthenticatedFetch } from "@/hooks/use-authenticated-fetch-client";
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
  const authenticatedFetch = useAuthenticatedFetch();
  const {
    offset, limit, includeArchived,
    sortField, sortOrder, app,
    startTime, endTime,
    refetchInterval = 10_000,
  } = params;

  return useQuery<UseJobsDataResult, Error>({
    queryKey: [
      "jobs-filtered",
      offset,
      limit,
      includeArchived,
      sortField,
      sortOrder,
      app,
      startTime,
      endTime,
    ],
    placeholderData: keepPreviousData,
    refetchInterval,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const response = await authenticatedFetch(
        "/api/services/app-service/jobs/enumerate-tasks-filtered",
        {
          method: "POST",
          body: JSON.stringify({
            offset,
            limit,
            include_archived: includeArchived,
            sort_field: sortField,
            sort_order: sortOrder,
            app,
            start_time: startTime,
            end_time: endTime,
          }),
        },
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch jobs: ${response.statusText}`);
      }
      const data = await response.json();
      const raw = data.jobs ?? [];
      const jobs = Array.isArray(raw[0]) ? raw[0] : raw;
      const totalTasks = typeof data.totalTasks === "number" ? data.totalTasks : 0;
      return { jobs, totalTasks };
    },
  });
}
