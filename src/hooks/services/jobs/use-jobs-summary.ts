import type { QueryState } from "@tanstack/react-query";
import { useApiQuery } from "@/lib/api/hooks";
import { apiCall } from "@/lib/api/client";
import { errorBackoffPollInterval } from "@/lib/api/poll-backoff";
import { activeJobStatuses } from "@/lib/jobs/constants";
import { isInSubmitWindow } from "@/lib/jobs/recent-submit";

interface JobsSummaryData {
  taskSummary: Record<string, number>;
  appSummary: Record<string, number>;
}

interface UseJobsSummaryOptions {
  /** `false` fetches once, then only on demand (`refetch`). */
  poll?: boolean;
}

/** The service answers a record, or a one-element array holding it. The server's twin is `unwrapCounts` in `src/lib/app-service.ts`. */
function unwrapCounts(raw: unknown): Record<string, number> {
  return ((Array.isArray(raw) ? raw[0] : raw) ?? {}) as Record<string, number>;
}

/** Shared by the full summary and the pill's task summary. Re-run after every fetch, so the submit window closes on its own. */
export function jobsSummaryRefetchInterval(poll: boolean) {
  return (query: {
    state: Pick<QueryState<{ taskSummary: Record<string, number> }>, "status" | "errorUpdateCount" | "data">;
  }) => {
    // Called first even when not polling, so the back-off keeps its last-success record.
    const backoff = errorBackoffPollInterval(query);
    if (!poll) return false;
    if (backoff !== undefined) return backoff;
    // Just after a submit, the new job may not be counted yet.
    if (isInSubmitWindow()) return 3_000;
    const data = query.state.data;
    if (!data) return 5_000;
    const { taskSummary } = data;
    const hasActive = activeJobStatuses.some((s) => (taskSummary[s] ?? 0) > 0);
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
    // The app default is off, and its 60 s stale time would skip most returns; a hidden tab does not poll.
    // "always" also refetches during error back-off, on purpose: a return to the tab is a manual retry.
    refetchOnWindowFocus: poll ? "always" : false,
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
    // The app default is off, and its 60 s stale time would skip most returns; a hidden tab does not poll.
    // "always" also refetches during error back-off, on purpose: a return to the tab is a manual retry.
    refetchOnWindowFocus: poll ? "always" : false,
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
