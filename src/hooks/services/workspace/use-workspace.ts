import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/auth";
import { toast } from "sonner";
import type { KillJobResponse } from "@/types/workspace";

export function useKillJob() {
  const queryClient = useQueryClient();

  return useMutation<KillJobResponse, Error, string>({
    mutationFn: async (jobId) => {
      const response = await apiFetch(
        `/api/services/app-service/jobs/${jobId}/kill`,
        { method: "POST" },
      );
      if (!response.ok) {
        throw new Error(`Failed to kill job: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: (data, jobId) => {
      toast.success(`Kill request for Job ${jobId} was sent successfully`);
      void queryClient.invalidateQueries({ queryKey: ["jobs"] });
      void queryClient.invalidateQueries({ queryKey: ["jobs-filtered"] });
      void queryClient.invalidateQueries({ queryKey: ["jobs-summary"] });
    },
    onError: (error, jobId) => {
      toast.error(`Failed to kill Job ${jobId}: ${error.message}`);
    },
  });
}
