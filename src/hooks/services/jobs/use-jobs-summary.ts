import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedFetch } from "@/hooks/use-authenticated-fetch-client";

export function useJobsStatusSummary(includeArchived: boolean) {
  const authenticatedFetch = useAuthenticatedFetch();

  return useQuery<Record<string, number>, Error>({
    queryKey: ["jobs-task-summary", includeArchived],
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const response = await authenticatedFetch(
        "/api/services/app-service/jobs/task-summary",
        {
          method: "POST",
          body: JSON.stringify({ include_archived: includeArchived }),
        },
      );
      if (!response.ok) {
        throw new Error(
          `Failed to fetch task summary: ${response.statusText}`,
        );
      }
      const data = await response.json();
      const raw = data.summary;
      // BV-BRC JSON-RPC may wrap results in an extra array
      return (Array.isArray(raw) ? raw[0] : raw) ?? {};
    },
  });
}

export function useJobsAppSummary(includeArchived: boolean) {
  const authenticatedFetch = useAuthenticatedFetch();

  return useQuery<Record<string, number>, Error>({
    queryKey: ["jobs-app-summary", includeArchived],
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const response = await authenticatedFetch(
        "/api/services/app-service/jobs/app-summary",
        {
          method: "POST",
          body: JSON.stringify({ include_archived: includeArchived }),
        },
      );
      if (!response.ok) {
        throw new Error(
          `Failed to fetch app summary: ${response.statusText}`,
        );
      }
      const data = await response.json();
      const raw = data.summary;
      // BV-BRC JSON-RPC may wrap results in an extra array
      return (Array.isArray(raw) ? raw[0] : raw) ?? {};
    },
  });
}
