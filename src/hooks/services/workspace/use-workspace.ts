import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedFetch } from "@/hooks/use-authenticated-fetch-client";
import {
  EnumerateJobsResponse,
  QueryJobsResponse,
  QueryJobSummaryResponse,
  QueryJobDetailsResponse,
  FetchJobOutputResponse,
  EnumerateJobsParams,
  QueryJobsParams,
} from "@/types/workspace";

// Hook for enumerating jobs — auto-fetches on mount
export function useEnumerateJobs(params?: EnumerateJobsParams) {
  const authenticatedFetch = useAuthenticatedFetch();

  return useQuery<EnumerateJobsResponse, Error>({
    queryKey: ["jobs", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.offset !== undefined) {
        searchParams.append("offset", params.offset.toString());
      }
      if (params?.limit !== undefined) {
        searchParams.append("limit", params.limit.toString());
      }
      if (params?.status_filter?.length) {
        searchParams.append("status_filter", params.status_filter.join(","));
      }
      if (params?.app_filter?.length) {
        searchParams.append("app_filter", params.app_filter.join(","));
      }

      const response = await authenticatedFetch(
        `/api/services/app-service/jobs?${searchParams.toString()}`,
      );
      if (!response.ok) {
        throw new Error(`Failed to enumerate jobs: ${response.statusText}`);
      }
      const data = await response.json();
      return data.jobs[0] || [];
    },
  });
}

// Hook for querying specific jobs — imperative POST
export function useQueryJobs() {
  const authenticatedFetch = useAuthenticatedFetch();

  return useMutation<QueryJobsResponse, Error, QueryJobsParams>({
    mutationFn: async (params) => {
      const response = await authenticatedFetch(
        "/api/services/app-service/jobs/query",
        {
          method: "POST",
          body: JSON.stringify({ job_ids: params.job_ids }),
        },
      );
      if (!response.ok) {
        throw new Error(`Failed to query jobs: ${response.statusText}`);
      }
      const data = await response.json();
      return data.jobs;
    },
  });
}

// Hook for getting job summary
export function useJobSummary(jobId: string | undefined) {
  const authenticatedFetch = useAuthenticatedFetch();

  return useQuery<QueryJobSummaryResponse, Error>({
    queryKey: ["job-summary", jobId],
    queryFn: async () => {
      const response = await authenticatedFetch(
        `/api/services/app-service/jobs/${jobId}/summary`,
      );
      if (!response.ok) {
        throw new Error(`Failed to get job summary: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!jobId,
  });
}

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
    },
  });
}

// Hook for fetching job output (stdout/stderr)
export function useJobOutput(
  jobId: string | undefined,
  outputType: "stdout" | "stderr",
  enabled: boolean = true,
) {
  const authenticatedFetch = useAuthenticatedFetch();

  return useQuery<FetchJobOutputResponse, Error>({
    queryKey: ["job-output", jobId, outputType],
    queryFn: async () => {
      const response = await authenticatedFetch(
        `/api/services/app-service/jobs/${jobId}/${outputType}`,
      );
      if (!response.ok) {
        throw new Error(
          `Failed to fetch ${outputType}: ${response.statusText}`,
        );
      }
      return response.text();
    },
    enabled: enabled && !!jobId,
  });
}
