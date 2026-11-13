"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { refreshJobsAfterSubmit } from "@/lib/jobs/recent-submit";
import { submitServiceJob } from "@/lib/services/service-utils";
import { formatUserFacingErrorMessage } from "@/lib/utils";

interface UseServiceFormSubmissionOptions {
  serviceName: string;
  displayName: string;
  onSuccess?: () => void;
}

/** First element of every service-submit mutation key, so `<ServiceSubmitError>` finds the submission by prefix. */
export const serviceSubmitMutationKey = "service-submit";

export interface ServiceSubmitError {
  title: string;
  message: string;
  /** The job service never answered (504), so the job may still have been queued. */
  mayHaveBeenQueued: boolean;
}

export function describeServiceSubmitError(error: unknown): ServiceSubmitError {
  const mayHaveBeenQueued =
    typeof error === "object" &&
    error !== null &&
    (error as { status?: unknown }).status === 504;
  return {
    title: mayHaveBeenQueued
      ? "The job service did not respond"
      : "Submission failed",
    message: formatUserFacingErrorMessage(error, "Failed to submit job"),
    mayHaveBeenQueued,
  };
}

export function useServiceFormSubmission(
  options: UseServiceFormSubmissionOptions,
): {
  submit: (params: Record<string, unknown>) => Promise<void>;
  isSubmitting: boolean;
  submitError: ServiceSubmitError | null;
} {
  const { serviceName, displayName, onSuccess } = options;
  const router = useRouter();
  const queryClient = useQueryClient();

  const submitMutation = useMutation({
    mutationKey: [serviceSubmitMutationKey, serviceName],
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
      refreshJobsAfterSubmit(queryClient);
      onSuccess?.();
    },
    onError: (error) => {
      console.error(`Failed to submit ${displayName} job:`, error);
      const { title, message, mayHaveBeenQueued } =
        describeServiceSubmitError(error);
      // 504: the job may still have been queued; keep the error on screen and watch for it.
      if (mayHaveBeenQueued) {
        refreshJobsAfterSubmit(queryClient);
        toast.error(title, {
          description: message,
          closeButton: true,
          duration: Infinity,
          action: { label: "View Jobs", onClick: () => { router.push("/jobs"); } },
        });
        return;
      }
      toast.error(title, { description: message, closeButton: true });
    },
  });

  const submit = async (params: Record<string, unknown>) => {
    await submitMutation.mutateAsync(params).catch(() => { /* handled by onError */ });
  };

  return {
    submit,
    isSubmitting: submitMutation.isPending,
    submitError: submitMutation.isError
      ? describeServiceSubmitError(submitMutation.error)
      : null,
  };
}
