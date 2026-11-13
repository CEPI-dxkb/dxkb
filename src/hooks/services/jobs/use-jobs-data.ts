import { keepPreviousData } from "@tanstack/react-query";
import * as z from "@/lib/zod-mini";
import { useApiQuery } from "@/lib/api/hooks";
import { apiCall } from "@/lib/api/client";
import { errorBackoffPollInterval } from "@/lib/api/poll-backoff";
import type { JobListItem } from "@/types/workspace";

const jobIdSchema = z.union([
  z.string().check(z.minLength(1)),
  z.pipe(
    z.int().check(z.nonnegative()),
    z.transform((value) => String(value)),
  ),
]);

const elapsedTimeSchema = z.pipe(
  z.union([
    z.number().check(z.nonnegative()),
    z.string().check(z.regex(/^\d+:[0-5]\d:[0-5]\d$/)),
    z.literal(""),
  ]),
  z.transform((value) => {
    if (typeof value === "number") return value;
    if (!value) return undefined;
    const [hours, minutes, seconds] = value.split(":").map(Number);
    return hours * 3600 + minutes * 60 + seconds;
  }),
);

const nonEmptyString = () => z.string().check(z.minLength(1));

const jobSchema = z.pipe(
  z.looseObject({
    id: jobIdSchema,
    app: nonEmptyString(),
    status: z.enum([
      "pending",
      "queued",
      "init",
      "running",
      "in-progress",
      "completed",
      "failed",
      "cancelled",
      "error",
      "deleted",
    ]),
    submit_time: z.string(),
    start_time: z.optional(z.string()),
    completed_time: z.optional(z.string()),
    owner: z.optional(nonEmptyString()),
    user_id: z.optional(nonEmptyString()),
    parameters: z.record(z.string(), z.unknown()),
    output_path: z.optional(z.string()),
    output_file: z.optional(z.string()),
    app_spec: z.optional(
      z.looseObject({
        id: z.string(),
        script: z.string(),
        label: z.string(),
        description: z.string(),
      }),
    ),
    elapsed_time: z.optional(elapsedTimeSchema),
    req_memory: z.optional(z.string()),
    req_cpu: z.optional(z.number()),
    req_runtime: z.optional(z.string()),
  }),
  z.transform((job, ctx) => {
    const owner = job.owner ?? job.user_id;
    if (owner === undefined) {
      ctx.issues.push({
        code: "custom",
        message: "Expected owner or user_id",
        path: ["owner"],
        input: job,
      });
      return z.NEVER;
    }
    return { ...job, owner };
  }),
);

const jobsResponseSchema = z.object({
  jobs: z.union([z.array(jobSchema), z.tuple([z.array(jobSchema)])]),
  totalTasks: z.int().check(z.nonnegative()),
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
  refetchInterval?: number | false;
  enabled?: boolean;
  staleTime?: number;
}

interface UseJobsDataResult {
  jobs: JobListItem[];
  totalTasks: number;
}

export function jobsDataQueryOptions(
  params: Omit<UseJobsDataParams, "refetchInterval" | "enabled" | "staleTime">,
) {
  const {
    offset, limit, includeArchived,
    sortField, sortOrder, app,
    startTime, endTime,
  } = params;
  return {
    queryKey: [
      "jobs-filtered", offset, limit, includeArchived,
      sortField, sortOrder, app, startTime, endTime,
    ],
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
  };
}

export function useJobsData(params: UseJobsDataParams) {
  const {
    refetchInterval = 10_000,
    enabled = true,
    staleTime,
    ...pageParams
  } = params;

  return useApiQuery<UseJobsDataResult>({
    ...jobsDataQueryOptions(pageParams),
    enabled,
    // Only when set: an explicit undefined would override the client default.
    ...(staleTime === undefined ? {} : { staleTime }),
    placeholderData: keepPreviousData,
    refetchInterval: (query) => {
      // Called first even when not polling so the back-off keeps its last-success record.
      const backoff = errorBackoffPollInterval(query);
      if (refetchInterval === false) return false;
      return backoff ?? refetchInterval;
    },
    refetchIntervalInBackground: false,
  });
}
