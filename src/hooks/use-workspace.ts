import { useState, useCallback, useMemo } from "react";
import { useAuthenticatedFetch } from "./use-authenticated-fetch-client";
import {
  EnumerateJobsResponse,
  QueryJobsResponse,
  QueryJobSummaryResponse,
  QueryJobDetailsResponse,
  KillJobResponse,
  FetchJobOutputResponse,
  JobStatus,
  EnumerateJobsParams,
  QueryJobsParams,
  QueryJobSummaryParams,
  QueryJobDetailsParams,
  KillJobParams,
  FetchJobOutputParams,
} from "../types/workspace";

// Hook for enumerating jobs
export function useEnumerateJobs() {
  const [jobs, setJobs] = useState<EnumerateJobsResponse>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const authenticatedFetch = useAuthenticatedFetch();

  const enumerateJobs = useCallback(
    async (params?: EnumerateJobsParams) => {
      setLoading(true);
      setError(null);

      try {
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
          `/api/workspace/jobs?${searchParams.toString()}`,
        );

        if (!response.ok) {
          throw new Error(`Failed to enumerate jobs: ${response.statusText}`);
        }

        const data = await response.json();
        // Extract jobs from the wrapped response
        const jobsArray = data.jobs[0] || [];
        setJobs(jobsArray);

        return data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [authenticatedFetch],
  );

  return {
    jobs,
    loading,
    error,
    enumerateJobs,
  };
}

// Hook for querying specific jobs
export function useQueryJobs() {
  const [jobs, setJobs] = useState<QueryJobsResponse>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const authenticatedFetch = useAuthenticatedFetch();

  const queryJobs = useCallback(
    async (params: QueryJobsParams) => {
      setLoading(true);
      setError(null);

      try {
        const response = await authenticatedFetch(
          "/api/workspace/jobs/query",
          {
            method: "POST",
            body: JSON.stringify({ job_ids: params.job_ids }),
          },
        );

        if (!response.ok) {
          throw new Error(`Failed to query jobs: ${response.statusText}`);
        }

        const data = await response.json();
        setJobs(data.jobs);
        return data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [authenticatedFetch],
  );

  return {
    jobs,
    loading,
    error,
    queryJobs,
  };
}

// Hook for getting job summary
export function useJobSummary() {
  const [jobSummary, setJobSummary] =
    useState<QueryJobSummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const authenticatedFetch = useAuthenticatedFetch();

  const getJobSummary = useCallback(
    async (jobId: string) => {
      setLoading(true);
      setError(null);

      try {
        const response = await authenticatedFetch(
          `/api/workspace/jobs/${jobId}/summary`,
        );

        if (!response.ok) {
          throw new Error(`Failed to get job summary: ${response.statusText}`);
        }

        const data = await response.json();
        setJobSummary(data);
        return data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [authenticatedFetch],
  );

  return {
    jobSummary,
    loading,
    error,
    getJobSummary,
  };
}

// Hook for getting job details
export function useJobDetails() {
  const [jobDetails, setJobDetails] =
    useState<QueryJobDetailsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const authenticatedFetch = useAuthenticatedFetch();

  const getJobDetails = useCallback(
    async (jobId: string, includeLogs: boolean = false) => {
      setLoading(true);
      setError(null);

      try {
        const searchParams = new URLSearchParams();
        if (includeLogs) {
          searchParams.append("include_logs", "true");
        }

        const response = await authenticatedFetch(
          `/api/workspace/jobs/${jobId}?${searchParams.toString()}`,
        );

        if (!response.ok) {
          throw new Error(`Failed to get job details: ${response.statusText}`);
        }

        const data = await response.json();
        setJobDetails(data);
        return data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [authenticatedFetch],
  );

  return {
    jobDetails,
    loading,
    error,
    getJobDetails,
  };
}

// Hook for killing jobs
export function useKillJob() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const authenticatedFetch = useAuthenticatedFetch();

  const killJob = useCallback(
    async (jobId: string) => {
      setLoading(true);
      setError(null);

      try {
        const response = await authenticatedFetch(
          `/api/workspace/jobs/${jobId}/kill`,
          {
            method: "POST",
          },
        );

        if (!response.ok) {
          throw new Error(`Failed to kill job: ${response.statusText}`);
        }

        const data = await response.json();
        return data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [authenticatedFetch],
  );

  return {
    loading,
    error,
    killJob,
  };
}

// Hook for fetching job output (stdout/stderr)
export function useJobOutput() {
  const [output, setOutput] = useState<FetchJobOutputResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const authenticatedFetch = useAuthenticatedFetch();

  const fetchJobOutput = useCallback(
    async (params: FetchJobOutputParams) => {
      setLoading(true);
      setError(null);

      try {
        const response = await authenticatedFetch(
          `/api/workspace/jobs/${params.job_id}/${params.output_type}`,
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch ${params.output_type}: ${response.statusText}`);
        }

        const data = await response.text();
        setOutput(data);
        return data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [authenticatedFetch],
  );

  return {
    output,
    loading,
    error,
    fetchJobOutput,
  };
}

// Combined hook for workspace operations
export function useWorkspace() {
  const enumerateJobsHook = useEnumerateJobs();
  const queryJobsHook = useQueryJobs();
  const jobSummaryHook = useJobSummary();
  const jobDetailsHook = useJobDetails();
  const killJobHook = useKillJob();
  const jobOutputHook = useJobOutput();

  const workspaceData = useMemo(() => {
    return {
      // Job enumeration
      jobs: enumerateJobsHook.jobs,
      enumerateJobs: enumerateJobsHook.enumerateJobs,

      // Job querying
      queryJobs: queryJobsHook.queryJobs,

      // Job summary
      jobSummary: jobSummaryHook.jobSummary,
      getJobSummary: jobSummaryHook.getJobSummary,

      // Job details
      jobDetails: jobDetailsHook.jobDetails,
      getJobDetails: jobDetailsHook.getJobDetails,

      // Job killing
      killJob: killJobHook.killJob,

      // Job output
      jobOutput: jobOutputHook.output,
      fetchJobOutput: jobOutputHook.fetchJobOutput,

      // Loading states
      loading: {
        enumerate: enumerateJobsHook.loading,
        query: queryJobsHook.loading,
        summary: jobSummaryHook.loading,
        details: jobDetailsHook.loading,
        kill: killJobHook.loading,
        output: jobOutputHook.loading,
      },

      // Error states
      error: {
        enumerate: enumerateJobsHook.error,
        query: queryJobsHook.error,
        summary: jobSummaryHook.error,
        details: jobDetailsHook.error,
        kill: killJobHook.error,
        output: jobOutputHook.error,
      },
    };
  }, [
    enumerateJobsHook.jobs,
    enumerateJobsHook.loading,
    enumerateJobsHook.error,
    queryJobsHook.queryJobs,
    queryJobsHook.loading,
    queryJobsHook.error,
    jobSummaryHook.jobSummary,
    jobSummaryHook.loading,
    jobSummaryHook.error,
    jobDetailsHook.jobDetails,
    jobDetailsHook.loading,
    jobDetailsHook.error,
    killJobHook.killJob,
    killJobHook.loading,
    killJobHook.error,
    jobOutputHook.output,
    jobOutputHook.loading,
    jobOutputHook.error,
  ]);

  return workspaceData;
}
