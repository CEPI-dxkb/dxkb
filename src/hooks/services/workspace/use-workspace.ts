import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedFetch } from "@/hooks/use-authenticated-fetch-client";

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
