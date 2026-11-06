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
  /**
   * Poll on the usual schedule (default). `false` fetches once and then only
   * on demand (`refetch`), for a caller whose polls are likely to fail, such
   * as the header pill while the session could not be verified.
   */
  poll?: boolean;
}

/** The service answers a record, or a one-element array holding it. */
function unwrapCounts(raw: unknown): Record<string, number> {
  return ((Array.isArray(raw) ? raw[0] : raw) ?? {}) as Record<string, number>;
}

/**
 * Polling policy shared by the full summary and the pill's task summary:
 * back-off after failed polls, 5 s until the first data, 3 s while any job is
 * active, otherwise 30 s. `poll: false` fetches only on demand.
 */
export function jobsSummaryRefetchInterval(poll: boolean) {
  return (query: {
    state: Pick<QueryState<{ taskSummary: Record<string, number> }>, "status" | "errorUpdateCount" | "data">;
  }) => {
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
  };
}

/**
 * Task counts only, for the header pill: `/jobs/task-summary` makes one
 * AppService call where `/jobs/summary` makes two. Its key keeps the
 * `["jobs-summary"]` prefix so the existing invalidations refresh it.
 */
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
