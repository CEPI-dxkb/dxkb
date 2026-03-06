import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedFetch } from "@/hooks/use-authenticated-fetch-client";
import { QueryJobDetailsResponse } from "@/types/workspace";
import { useQuery } from "@tanstack/react-query";

// Hook for getting job details
export function useJobDetails(
  jobId: string | undefined,
  includeLogs: boolean = false,
) {
  const authenticatedFetch = useAuthenticatedFetch();

  return useQuery<QueryJobDetailsResponse, Error>({
    queryKey: ["job-details", jobId, includeLogs],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (includeLogs) {
        searchParams.append("include_logs", "true");
      }
      const response = await authenticatedFetch(
        `/api/services/app-service/jobs/${jobId}?${searchParams.toString()}`,
      );
      if (!response.ok) {
        throw new Error(`Failed to get job details: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!jobId,
  });
}

// Hook for killing jobs — invalidates jobs list on success
export function useKillJob() {
  const authenticatedFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, string>({
    mutationFn: async (jobId) => {
      const response = await authenticatedFetch(
        `/api/services/app-service/jobs/${jobId}/kill`,
        { method: "POST" },
      );
      if (!response.ok) {
        throw new Error(`Failed to kill job: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["jobs"] });
      void queryClient.invalidateQueries({ queryKey: ["jobs-filtered"] });
      void queryClient.invalidateQueries({ queryKey: ["jobs-task-summary"] });
    },
  });
}
