"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { submitServiceJob } from "@/lib/services/service-utils";

interface UseServiceFormSubmissionOptions {
  serviceName: string;
  displayName: string;
  onSuccess?: () => void;
}

export function useServiceFormSubmission(
  options: UseServiceFormSubmissionOptions,
): {
  submit: (params: Record<string, unknown>) => Promise<void>;
  isSubmitting: boolean;
} {
  const { serviceName, displayName, onSuccess } = options;
  const router = useRouter();
  const queryClient = useQueryClient();

  const submitMutation = useMutation({
    mutationFn: async (params: Record<string, unknown>) => {
      const result = await submitServiceJob(serviceName, params);
      if (!result.success) {
        throw Object.assign(new Error(result.error || "Failed to submit job"), {
          status: result.status,
        });
      }
      return result;
    },
    onSuccess: (result) => {
      const jobId = result.job?.[0]?.id;
      toast.success(`${displayName} job submitted successfully!`, {
        description: jobId ? `Job ID: ${jobId}` : "Job submitted successfully",
        closeButton: true,
        ...(jobId && {
          action: { label: "View Job", onClick: () => { router.push("/jobs"); } },
        }),
      });
      void queryClient.invalidateQueries({ queryKey: ["jobs-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["jobs-filtered"] });
      onSuccess?.();
    },
    onError: (error) => {
      console.error(`Failed to submit ${displayName} job:`, error);
      const errorMessage = error instanceof Error ? error.message : "Failed to submit job";
      // 504: the job service never answered, so the job may still have been
      // queued (the server's message says which). Keep it on screen with a
      // way to check before the user submits again.
      if ((error as { status?: unknown }).status === 504) {
        toast.error("The job service did not respond", {
          description: errorMessage,
          closeButton: true,
          duration: Infinity,
          action: { label: "View Jobs", onClick: () => { router.push("/jobs"); } },
        });
        return;
      }
      toast.error("Submission failed", { description: errorMessage, closeButton: true });
    },
  });

  const submit = async (params: Record<string, unknown>) => {
    await submitMutation.mutateAsync(params).catch(() => { /* handled by onError */ });
  };

  return { submit, isSubmitting: submitMutation.isPending };
}
