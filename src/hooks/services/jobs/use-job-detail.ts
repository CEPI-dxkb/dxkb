import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedFetch } from "@/hooks/use-authenticated-fetch-client";
import type { JobDetails } from "@/types/workspace";

export function useJobDetail(jobId: string | null) {
  const authenticatedFetch = useAuthenticatedFetch();

  return useQuery<JobDetails, Error>({
    queryKey: ["job-detail", jobId],
    queryFn: async () => {
      const response = await authenticatedFetch(
        `/api/services/app-service/jobs/${jobId}`,
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch job details: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!jobId,
    staleTime: 30_000,
  });
}

export function useJobOutput(
  jobId: string | null,
  outputType: "stdout" | "stderr",
  enabled: boolean,
) {
  const authenticatedFetch = useAuthenticatedFetch();

  return useQuery<string, Error>({
    queryKey: ["job-output", jobId, outputType],
    queryFn: async () => {
      const response = await authenticatedFetch(
        `/api/services/app-service/jobs/${jobId}/${outputType}`,
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch ${outputType}: ${response.statusText}`);
      }
      return response.text();
    },
    enabled: !!jobId && enabled,
    staleTime: 60_000,
  });
}
