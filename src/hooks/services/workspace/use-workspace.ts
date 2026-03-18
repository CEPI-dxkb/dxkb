import { useQueryClient } from "@tanstack/react-query";
import { useApiMutation } from "@/hooks/use-api-query";
import { toast } from "sonner";
import type { KillJobResponse } from "@/types/workspace";

// Hook for killing jobs — invalidates jobs list on success
export function useKillJob() {
  const queryClient = useQueryClient();

  return useApiMutation<KillJobResponse, string>({
    url: (jobId) => `/api/services/app-service/jobs/${jobId}/kill`,
    mutationOptions: {
      onSuccess: (data, jobId) => {
        toast.success(`Kill request for Job ${jobId} was sent successfully`);
        void queryClient.invalidateQueries({ queryKey: ["jobs"] });
        void queryClient.invalidateQueries({ queryKey: ["jobs-filtered"] });
        void queryClient.invalidateQueries({ queryKey: ["jobs-summary"] });
      },
      onError: (error, jobId) => {
        toast.error(`Failed to kill Job ${jobId}: ${error.message}`);
      },
    },
  });
}
