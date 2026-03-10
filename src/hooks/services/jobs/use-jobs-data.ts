import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedFetch } from "@/hooks/use-authenticated-fetch-client";
import type { JobListItem } from "@/types/workspace";

interface UseJobsDataParams {
  offset: number;
  limit: number;
  includeArchived: boolean;
  sortField: string;
  sortOrder: "asc" | "desc";
  app?: string;
}

export function useJobsData(params: UseJobsDataParams) {
  const authenticatedFetch = useAuthenticatedFetch();
  const { offset, limit, includeArchived, sortField, sortOrder, app } = params;

  return useQuery<JobListItem[], Error>({
    queryKey: [
      "jobs-filtered",
      offset,
      limit,
      includeArchived,
      sortField,
      sortOrder,
      app,
    ],
    refetchInterval: 10_000,
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
          }),
        },
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch jobs: ${response.statusText}`);
      }
      const data = await response.json();
      const raw = data.jobs ?? [];
      // BV-BRC JSON-RPC wraps enumeration results in an extra array
      return Array.isArray(raw[0]) ? raw[0] : raw;
    },
  });
}
