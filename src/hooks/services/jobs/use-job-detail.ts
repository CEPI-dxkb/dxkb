import { useApiQuery } from "@/hooks/use-api-query";
import type { JobDetails } from "@/types/workspace";
import { activeJobStatuses } from "@/lib/jobs/constants";

export function useJobDetail(jobId: string | null) {
  return useApiQuery<JobDetails>({
    url: `/api/services/app-service/jobs/${jobId}`,
    queryKey: ["job-detail", jobId],
    queryOptions: {
      enabled: !!jobId,
      staleTime: 30_000,
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        if (status && activeJobStatuses.includes(status)) return 3_000;
        return false;
      },
      refetchIntervalInBackground: false,
    },
  });
}

export function useJobOutput(
  jobId: string | null,
  outputType: "stdout" | "stderr",
  enabled: boolean,
) {
  return useApiQuery<string>({
    url: `/api/services/app-service/jobs/${jobId}/${outputType}`,
    queryKey: ["job-output", jobId, outputType],
    responseType: "text",
    queryOptions: {
      enabled: !!jobId && enabled,
      staleTime: 60_000,
    },
  });
}
