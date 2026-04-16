"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { submitServiceJob } from "@/lib/services/service-utils";

interface UseServiceFormSubmissionOptions {
  serviceName: string;
  displayName?: string;
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

  const formattedDisplayName =
    displayName ?? serviceName.replace(/([A-Z])/g, " $1").trim();

  const submitMutation = useMutation({
    mutationFn: async (params: Record<string, unknown>) => {
      const result = await submitServiceJob(serviceName, params);
      if (!result.success) throw new Error(result.error || "Failed to submit job");
      return result;
    },
    onSuccess: (result) => {
      const jobId = result.job?.[0]?.id;
      toast.success(`${formattedDisplayName} job submitted successfully!`, {
        description: jobId ? `Job ID: ${jobId}` : "Job submitted successfully",
        closeButton: true,
        ...(jobId && {
          action: { label: "View Job", onClick: () => router.push(`/jobs`) },
        }),
      });
      onSuccess?.();
    },
    onError: (error) => {
      console.error(`Failed to submit ${formattedDisplayName} job:`, error);
      const errorMessage = error instanceof Error ? error.message : "Failed to submit job";
      toast.error("Submission failed", { description: errorMessage, closeButton: true });
    },
  });

  const submit = async (params: Record<string, unknown>) => {
    await submitMutation.mutateAsync(params).catch(() => { /* handled by onError */ });
  };

  return { submit, isSubmitting: submitMutation.isPending };
}
