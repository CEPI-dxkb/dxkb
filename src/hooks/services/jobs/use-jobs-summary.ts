import { useApiQuery } from "@/hooks/use-api-query";

interface JobsSummaryData {
  taskSummary: Record<string, number>;
  appSummary: Record<string, number>;
}

export function useJobsSummary(includeArchived: boolean) {
  return useApiQuery<JobsSummaryData>({
    url: "/api/services/app-service/jobs/summary",
    method: "POST",
    body: { include_archived: includeArchived },
    queryKey: ["jobs-summary", includeArchived],
    select: (data) => {
      const rawTask = (data as { taskSummary?: unknown }).taskSummary;
      const rawApp = (data as { appSummary?: unknown }).appSummary;

      return {
        // BV-BRC JSON-RPC may wrap results in an extra array
        taskSummary: ((Array.isArray(rawTask) ? rawTask[0] : rawTask) ?? {}) as Record<string, number>,
        appSummary: ((Array.isArray(rawApp) ? rawApp[0] : rawApp) ?? {}) as Record<string, number>,
      };
    },
    queryOptions: {
      refetchInterval: 30_000,
      refetchIntervalInBackground: false,
    },
  });
}
