import { useApiQuery } from "@/lib/api/hooks";
import { apiCall } from "@/lib/api/client";
import { errorBackoffPollInterval } from "@/lib/api/poll-backoff";

interface JobsSummaryData {
  taskSummary: Record<string, number>;
  appSummary: Record<string, number>;
}

const activeStatuses = ["running", "in-progress", "queued", "pending"];

interface UseJobsSummaryOptions {
  /**
   * Poll on the usual schedule (default). `false` fetches once and then only
   * on demand (`refetch`), for a caller whose polls are likely to fail, such
   * as the header pill while the session could not be verified.
   */
  poll?: boolean;
}

export function useJobsSummary(
  includeArchived: boolean,
  { poll = true }: UseJobsSummaryOptions = {},
) {
  return useApiQuery<JobsSummaryData>({
    queryKey: ["jobs-summary", includeArchived],
    refetchInterval: (query) => {
      // Called first even when not polling, so the back-off keeps its
      // record of the last success for when polling resumes.
      const backoff = errorBackoffPollInterval(query);
      if (!poll) return false;
      if (backoff !== undefined) return backoff;
      const data = query.state.data;
      if (!data) return 5_000;
      const { taskSummary } = data;
      const hasActive = activeStatuses.some((s) => (taskSummary[s] ?? 0) > 0);
      return hasActive ? 3_000 : 30_000;
    },
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const data = await apiCall<{
        taskSummary: unknown;
        appSummary: unknown;
      }>("/api/services/app-service/jobs/summary", {
        include_archived: includeArchived,
      });

      const rawTask = data.taskSummary;
      const rawApp = data.appSummary;

      return {
        taskSummary: ((Array.isArray(rawTask) ? rawTask[0] : rawTask) ?? {}) as Record<string, number>,
        appSummary: ((Array.isArray(rawApp) ? rawApp[0] : rawApp) ?? {}) as Record<string, number>,
      };
    },
  });
}
