import { useApiQuery } from "@/lib/api/hooks";
import { apiCall } from "@/lib/api/client";
import { errorBackoffPollInterval } from "@/lib/api/poll-backoff";

interface JobsSummaryData {
  taskSummary: Record<string, number>;
  appSummary: Record<string, number>;
}

const activeStatuses = ["running", "in-progress", "queued", "pending"];

export function useJobsSummary(includeArchived: boolean) {
  return useApiQuery<JobsSummaryData>({
    queryKey: ["jobs-summary", includeArchived],
    refetchInterval: (query) => {
      const backoff = errorBackoffPollInterval(query);
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
