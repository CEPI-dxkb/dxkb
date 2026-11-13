import {
  describeUpstreamFailure,
  fetchUpstream,
  hostOf,
  UpstreamError,
  upstreamCauseCode,
  upstreamResponseError,
  upstreamServices,
  upstreamTimeoutMs,
} from "@/lib/api/upstream-failure";
import { getAppBaseUrl, getRequiredEnv } from "./env";
import { createBvBrcClient } from "./jsonrpc-client";
import {
  QueryJobDetailsResponse,
  KillJobResponse,
  KillJobRawResponse,
  FetchJobOutputResponse,
  SubmitServiceResponse,
  QueryJobDetailsParams,
  KillJobParams,
  FetchJobOutputParams,
  SubmitServiceParams,
  EnumerateTasksFilteredParams,
  EnumerateTasksFilteredResponse,
  JobListItem,
  QueryTaskSummaryFilteredParams,
  QueryTaskSummaryFilteredResponse,
  QueryAppSummaryFilteredParams,
  QueryAppSummaryFilteredResponse,
} from "@/types/workspace";

/** Plain-HTTP job output endpoint under the configured app service URL, so it follows that service rather than production. */
export function jobOutputUrl(jobId: string, outputType: "stdout" | "stderr"): string {
  const base = getRequiredEnv("APP_SERVICE_URL").replace(/\/+$/, "");
  return `${base}/task_info/${encodeURIComponent(jobId)}/${outputType}`;
}

/**
 * Statuses whose counts the task summary reads fresh. BV-BRC caches `query_task_summary_filtered` per user for 300 s
 * (Redis, `AppServiceImpl.pm` `_redis_get_or_compute`), and the submit-time cache clear does not reliably reach it,
 * while `enumerate_tasks_filtered` without a search term reads MySQL directly. So a just-submitted job is listed as
 * queued while the summary still says 0. Each of these is one uncached COUNT (`totalTasks`) laid over the summary;
 * `completed` and `failed` are included so a finishing job leaves running and joins its outcome in the same poll.
 */
export const freshCountStatuses = [
  "queued",
  "pending",
  "in-progress",
  "completed",
  "failed",
] as const;

/** The service answers a record, or a one-element array holding it. The browser's twin is `unwrapCounts` in `src/hooks/services/jobs/use-jobs-summary.ts`. */
function unwrapCounts(raw: unknown): Record<string, number> {
  const counts: unknown = Array.isArray(raw) ? raw[0] : raw;
  return counts && typeof counts === "object"
    ? { ...(counts as Record<string, number>) }
    : {};
}

export const submitTimeoutMessage = `The BV-BRC job service did not respond within ${String(upstreamTimeoutMs.jobService / 1000)} s. Your job may still have been queued: check Jobs before you submit it again.`;

export class AppService {
  private client: ReturnType<typeof createBvBrcClient>;

  constructor(token: string) {
    this.client = createBvBrcClient(token);
  }

  async queryJobDetails(
    params: QueryJobDetailsParams,
  ): Promise<QueryJobDetailsResponse> {
    const { job_id, include_logs = false } = params;

    return this.client.call("AppService.query_task_details", [
      job_id,
      include_logs,
    ]);
  }

  async killJob(params: KillJobParams): Promise<KillJobResponse> {
    const { job_id } = params;

    // The legacy API expects the job ID as a number
    const raw = await this.client.call<KillJobRawResponse>(
      "AppService.kill_task",
      [Number(job_id)],
    );

    return {
      success: raw[0] === 1,
      message: raw[1],
    };
  }

  async fetchJobOutput(
    params: FetchJobOutputParams,
  ): Promise<FetchJobOutputResponse> {
    const { job_id, output_type } = params;

    const url = jobOutputUrl(job_id, output_type);

    const authToken = this.client.getAuthToken();
    if (!authToken) {
      throw new Error("Authentication token not available");
    }

    const prefix = `Failed to fetch ${output_type} for job ${job_id}`;
    try {
      const response = await fetchUpstream(
        url,
        { method: "GET", headers: { Authorization: "OAuth " + authToken } },
        {
          service: upstreamServices.jobService,
          timeoutMs: upstreamTimeoutMs.jobService,
        },
      );

      if (!response.ok) {
        throw await upstreamResponseError(response, upstreamServices.jobService);
      }

      return await response.text();
    } catch (error) {
      // Keep an upstream failure's status so the route answers 502/503/504, including when the output stops arriving mid-body.
      const failure = describeUpstreamFailure(error, upstreamServices.jobService, {
        timeoutMs: upstreamTimeoutMs.jobService,
        host: hostOf(url),
      });
      if (failure) {
        throw new UpstreamError(
          { ...failure, message: `${prefix}: ${failure.message}` },
          { cause: error },
        );
      }
      throw new Error(
        `${prefix}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
  }

  async enumerateTasksFiltered(
    params: EnumerateTasksFilteredParams,
  ): Promise<EnumerateTasksFilteredResponse> {
    const { jobs, totalTasks } = await this.enumerateTasksRaw(params);
    return { jobs, totalTasks: totalTasks ?? 0 };
  }

  /** `enumerateTasksFiltered` with `totalTasks` undefined when the service answers no numeric total. */
  private async enumerateTasksRaw(
    params: EnumerateTasksFilteredParams,
  ): Promise<{ jobs: JobListItem[]; totalTasks: number | undefined }> {
    const {
      offset,
      limit,
      include_archived,
      sort_field,
      sort_order,
      app,
      start_time,
      end_time,
      status,
    } = params;
    const opts: Record<string, unknown> = {};
    if (include_archived) opts.include_archived = 1;
    if (sort_field) {
      const fieldMap: Record<string, string> = {
        status: "service_status",
        app: "application_id",
        completed_time: "finish_time",
      };
      opts.sort_field = fieldMap[sort_field] ?? sort_field;
    }
    if (sort_order) opts.sort_order = sort_order;
    if (app) opts.app = app;
    if (start_time) opts.start_time = start_time;
    if (end_time) opts.end_time = end_time;
    if (status) opts.status = status;

    const raw = await this.client.call<[unknown[], number] | unknown[]>(
      "AppService.enumerate_tasks_filtered",
      [offset, limit, opts],
    );
    const jobs = (Array.isArray(raw[0]) ? raw[0] : raw) as JobListItem[];
    const totalTasks = typeof raw[1] === "number" ? raw[1] : undefined;
    return { jobs, totalTasks };
  }

  async queryTaskSummaryFiltered(
    params: QueryTaskSummaryFilteredParams,
  ): Promise<QueryTaskSummaryFilteredResponse> {
    const opts: Record<string, unknown> = {};
    if (params.include_archived) opts.include_archived = 1;
    return this.client.call("AppService.query_task_summary_filtered", [opts]);
  }

  /** Fresh per-status totals (no `search`, which the backend caches). A status whose call fails, or answers no numeric total, is left out, so the caller keeps its cached count; the failures are logged once. */
  async queryFreshStatusCounts(params: {
    include_archived?: boolean;
    statuses: readonly string[];
  }): Promise<Record<string, number>> {
    const { include_archived, statuses } = params;
    const results = await Promise.allSettled(
      statuses.map(async (status) => {
        const { totalTasks } = await this.enumerateTasksRaw({
          offset: 0,
          limit: 1,
          include_archived,
          status,
        });
        if (totalTasks === undefined) {
          throw new Error("the job service answered no total count");
        }
        return totalTasks;
      }),
    );
    const counts: Record<string, number> = {};
    const failures: string[] = [];
    results.forEach((result, index) => {
      const status = statuses[index];
      if (result.status === "fulfilled") {
        counts[status] = result.value;
      } else {
        const reason: unknown = result.reason;
        failures.push(`${status}: ${reason instanceof Error ? reason.message : String(reason)}`);
      }
    });
    if (failures.length > 0) {
      console.warn(
        `[app-service] fresh job status counts failed, keeping the cached counts for ${failures.join("; ")}`,
      );
    }
    return counts;
  }

  /** The task summary with fresh counts for `freshCountStatuses` laid over the cached one (see there). Fails only when the cached summary call fails. */
  async queryTaskSummaryFresh(
    params: QueryTaskSummaryFilteredParams,
  ): Promise<QueryTaskSummaryFilteredResponse> {
    // On a partial count failure a fresh count may sit beside a cached one, so a job that just changed status can be counted twice for one poll (accepted degraded mode).
    const [cached, fresh] = await Promise.all([
      this.queryTaskSummaryFiltered(params),
      this.queryFreshStatusCounts({
        include_archived: params.include_archived,
        statuses: freshCountStatuses,
      }),
    ]);
    return { ...unwrapCounts(cached), ...fresh };
  }

  async queryAppSummaryFiltered(
    params: QueryAppSummaryFilteredParams,
  ): Promise<QueryAppSummaryFilteredResponse> {
    const opts: Record<string, unknown> = {};
    if (params.include_archived) opts.include_archived = 1;
    return this.client.call("AppService.query_app_summary_filtered", [opts]);
  }

  async submitService(
    params: SubmitServiceParams,
  ): Promise<SubmitServiceResponse> {
    const { app_name, app_params } = params;

    // base_url becomes P3_BASE_URL in the job, so it comes from server config, never from the request.
    try {
      return await this.client.call("AppService.start_app2", [
        app_name,
        app_params,
        { base_url: getAppBaseUrl() },
      ]);
    } catch (error) {
      // A submit is not idempotent: once sent, a silent service may still have queued the job. A connect timeout never sent it.
      if (
        error instanceof UpstreamError &&
        error.code === "upstream_timeout" &&
        upstreamCauseCode(error) !== "UND_ERR_CONNECT_TIMEOUT"
      ) {
        throw new UpstreamError(
          {
            status: 504,
            code: "upstream_timeout",
            message: submitTimeoutMessage,
          },
          { cause: error },
        );
      }
      throw error;
    }
  }
}

export function createAppService(token: string): AppService {
  return new AppService(token);
}

