import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiCall } from "@/lib/api/client";
import { toast } from "sonner";
import { formatUserFacingErrorMessage } from "@/lib/utils";
import type { KillJobResponse } from "@/types/workspace";

export function useKillJob() {
  const queryClient = useQueryClient();

  return useMutation<KillJobResponse, Error, string>({
    mutationFn: async (jobId) => {
      const result = await apiCall<KillJobResponse>(
        `/api/services/app-service/jobs/${jobId}/kill`,
        undefined,
      );
      // kill_task answers [0, "<reason>"] (e.g. "Task not found") when it did
      // not cancel the job; that is a failure, not a sent request.
      if (!result.success) {
        throw new Error(
          result.message || "The job service did not cancel the job.",
        );
      }
      return result;
    },
    onSuccess: (data, jobId) => {
      toast.success(`Kill request for Job ${jobId} was sent successfully`);
      void queryClient.invalidateQueries({ queryKey: ["jobs"] });
      void queryClient.invalidateQueries({ queryKey: ["jobs-filtered"] });
      void queryClient.invalidateQueries({ queryKey: ["jobs-summary"] });
    },
    onError: (error, jobId) => {
      toast.error(
        `Failed to kill Job ${jobId}: ${formatUserFacingErrorMessage(error, "The job service did not answer.")}`,
      );
    },
  });
}
