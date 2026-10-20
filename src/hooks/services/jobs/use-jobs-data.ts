import { keepPreviousData } from "@tanstack/react-query";
import { z } from "zod";
import { useApiQuery } from "@/lib/api/hooks";
import { apiCall } from "@/lib/api/client";
import { errorBackoffPollInterval } from "@/lib/api/poll-backoff";
import type { JobListItem } from "@/types/workspace";

const jobIdSchema = z.union([
  z.string().min(1),
  z.number().int().nonnegative().transform(String),
]);

const elapsedTimeSchema = z
  .union([
    z.number().nonnegative(),
    z.string().regex(/^\d+:[0-5]\d:[0-5]\d$/),
    z.literal(""),
  ])
  .transform((value) => {
    if (typeof value === "number") return value;
    if (!value) return undefined;
    const [hours, minutes, seconds] = value.split(":").map(Number);
    return hours * 3600 + minutes * 60 + seconds;
  });

const jobSchema = z
  .looseObject({
    id: jobIdSchema,
    app: z.string().min(1),
    status: z.enum([
      "pending",
      "queued",
      "running",
      "in-progress",
      "completed",
      "failed",
      "cancelled",
      "error",
    ]),
    submit_time: z.string(),
    start_time: z.string().optional(),
    completed_time: z.string().optional(),
    owner: z.string().min(1).optional(),
    user_id: z.string().min(1).optional(),
    parameters: z.record(z.string(), z.unknown()),
    output_path: z.string().optional(),
    output_file: z.string().optional(),
    app_spec: z
      .looseObject({
        id: z.string(),
        script: z.string(),
        label: z.string(),
        description: z.string(),
      })
      .optional(),
    elapsed_time: elapsedTimeSchema.optional(),
    req_memory: z.string().optional(),
    req_cpu: z.number().optional(),
    req_runtime: z.string().optional(),
  })
  .transform((job, ctx) => {
    const owner = job.owner ?? job.user_id;
    if (owner === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "Expected owner or user_id",
        path: ["owner"],
      });
      return z.NEVER;
    }
    return { ...job, owner };
  });

const jobsResponseSchema = z.object({
  jobs: z.union([z.array(jobSchema), z.tuple([z.array(jobSchema)])]),
  totalTasks: z.number().int().nonnegative(),
});

export function parseJobsResponse(data: unknown): UseJobsDataResult {
  const parsed = jobsResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(`Invalid jobs response: ${z.prettifyError(parsed.error)}`);
  }

  const jobs = Array.isArray(parsed.data.jobs[0])
    ? parsed.data.jobs[0]
    : parsed.data.jobs;
  return { jobs: jobs as JobListItem[], totalTasks: parsed.data.totalTasks };
}

interface UseJobsDataParams {
  offset: number;
  limit: number;
  includeArchived: boolean;
  sortField: string;
  sortOrder: "asc" | "desc";
  app?: string;
  startTime?: string;
  endTime?: string;
  /** Healthy polling interval in ms, or `false` to fetch only on demand. */
  refetchInterval?: number | false;
  enabled?: boolean;
}

interface UseJobsDataResult {
  jobs: JobListItem[];
  totalTasks: number;
}

export function useJobsData(params: UseJobsDataParams) {
  const {
    offset, limit, includeArchived,
    sortField, sortOrder, app,
    startTime, endTime,
    refetchInterval = 10_000,
    enabled = true,
  } = params;

  return useApiQuery<UseJobsDataResult>({
    queryKey: [
      "jobs-filtered", offset, limit, includeArchived,
      sortField, sortOrder, app, startTime, endTime,
    ],
    enabled,
    placeholderData: keepPreviousData,
    refetchInterval: (query) => {
      // Called first even when not polling, so the back-off keeps its
      // record of the last success for when polling resumes.
      const backoff = errorBackoffPollInterval(query);
      if (refetchInterval === false) return false;
      return backoff ?? refetchInterval;
    },
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const data = await apiCall<unknown>(
        "/api/services/app-service/jobs/enumerate-tasks-filtered",
        {
          offset, limit,
          include_archived: includeArchived,
          sort_field: sortField,
          sort_order: sortOrder,
          app,
          start_time: startTime,
          end_time: endTime,
        },
      );
      return parseJobsResponse(data);
    },
  });
}
