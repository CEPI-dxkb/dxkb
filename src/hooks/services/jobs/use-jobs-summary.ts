import type { QueryState } from "@tanstack/react-query";
import { useApiQuery } from "@/lib/api/hooks";
import { apiCall } from "@/lib/api/client";
import { errorBackoffPollInterval } from "@/lib/api/poll-backoff";

interface JobsSummaryData {
  taskSummary: Record<string, number>;
  appSummary: Record<string, number>;
}

const activeStatuses = ["running", "in-progress", "queued", "pending"];

interface UseJobsSummaryOptions {
  /** `false` fetches once, then only on demand (`refetch`). */
  poll?: boolean;
}

/** The service answers a record, or a one-element array holding it. */
function unwrapCounts(raw: unknown): Record<string, number> {
  return ((Array.isArray(raw) ? raw[0] : raw) ?? {}) as Record<string, number>;
}

/** Shared by the full summary and the pill's task summary. */
export function jobsSummaryRefetchInterval(poll: boolean) {
  return (query: {
    state: Pick<QueryState<{ taskSummary: Record<string, number> }>, "status" | "errorUpdateCount" | "data">;
  }) => {
    // Called first even when not polling, so the back-off keeps its last-success record.
    const backoff = errorBackoffPollInterval(query);
    if (!poll) return false;
    if (backoff !== undefined) return backoff;
    const data = query.state.data;
    if (!data) return 5_000;
    const { taskSummary } = data;
    const hasActive = activeStatuses.some((s) => (taskSummary[s] ?? 0) > 0);
    return hasActive ? 3_000 : 30_000;
  };
}

/** Task counts only (one AppService call); keeps the `["jobs-summary"]` key prefix so existing invalidations refresh it. */
export function useJobsTaskSummary(
  includeArchived: boolean,
  { poll = true }: UseJobsSummaryOptions = {},
) {
  return useApiQuery<Pick<JobsSummaryData, "taskSummary">>({
    queryKey: ["jobs-summary", "tasks", includeArchived],
    refetchInterval: jobsSummaryRefetchInterval(poll),
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const data = await apiCall<{ summary: unknown }>(
        "/api/services/app-service/jobs/task-summary",
        { include_archived: includeArchived },
      );
      return { taskSummary: unwrapCounts(data.summary) };
    },
  });
}

export function useJobsSummary(
  includeArchived: boolean,
  { poll = true }: UseJobsSummaryOptions = {},
) {
  return useApiQuery<JobsSummaryData>({
    queryKey: ["jobs-summary", includeArchived],
    refetchInterval: jobsSummaryRefetchInterval(poll),
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const data = await apiCall<{
        taskSummary: unknown;
        appSummary: unknown;
      }>("/api/services/app-service/jobs/summary", {
        include_archived: includeArchived,
      });

      return {
        taskSummary: unwrapCounts(data.taskSummary),
        appSummary: unwrapCounts(data.appSummary),
      };
    },
  });
}
