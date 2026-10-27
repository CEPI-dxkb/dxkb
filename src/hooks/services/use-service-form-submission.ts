"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { submitServiceJob } from "@/lib/services/service-utils";
import { formatUserFacingErrorMessage } from "@/lib/utils";

interface UseServiceFormSubmissionOptions {
  serviceName: string;
  displayName: string;
  onSuccess?: () => void;
}

/**
 * First element of every service-submit mutation key. The full key is
 * `[serviceSubmitMutationKey, serviceName]`, so `<ServiceSubmitError>` can
 * find the page's submission in the mutation cache by prefix.
 */
export const serviceSubmitMutationKey = "service-submit";

/** What a failed submission shows: inline by the Submit row and in a toast. */
export interface ServiceSubmitError {
  title: string;
  message: string;
  /**
   * The job service never answered (504), so the job may still have been
   * queued. The UI offers a way to check Jobs before submitting again.
   */
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
  /** The last submission's failure; cleared when the next submit starts. */
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
      void queryClient.invalidateQueries({ queryKey: ["jobs-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["jobs-filtered"] });
      onSuccess?.();
    },
    onError: (error) => {
      console.error(`Failed to submit ${displayName} job:`, error);
      // The same condensed text as the inline <ServiceSubmitError>.
      const { title, message, mayHaveBeenQueued } =
        describeServiceSubmitError(error);
      // 504: the job service never answered, so the job may still have been
      // queued (the server's message says which). Keep it on screen with a
      // way to check before the user submits again.
      if (mayHaveBeenQueued) {
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
