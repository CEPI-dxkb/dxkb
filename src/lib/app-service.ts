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

/**
 * The plain-HTTP job output endpoint. It lives under the app service's own
 * JSON-RPC endpoint (`APP_SERVICE_URL`, e.g.
 * `https://p3.theseed.org/services/app_service`), so it follows the configured
 * service rather than always reaching production.
 */
export function jobOutputUrl(jobId: string, outputType: "stdout" | "stderr"): string {
  const base = getRequiredEnv("APP_SERVICE_URL").replace(/\/+$/, "");
  return `${base}/task_info/${encodeURIComponent(jobId)}/${outputType}`;
}

export const submitTimeoutMessage = `The BV-BRC job service did not respond within ${String(upstreamTimeoutMs.jobService / 1000)} s. Your job may still have been queued: check Jobs before you submit it again.`;

/**
 * Centralized app service for AppService operations
 * Handles job management, submission, and monitoring
 * Maintains "job" terminology in the frontend while handling "task" terminology internally
 */
export class AppService {
  private client: ReturnType<typeof createBvBrcClient>;

  constructor(token: string) {
    this.client = createBvBrcClient(token);
  }

  /**
   * Get detailed job information (maps to AppService.query_task_details)
   */
  async queryJobDetails(
    params: QueryJobDetailsParams,
  ): Promise<QueryJobDetailsResponse> {
    const { job_id, include_logs = false } = params;

    return this.client.call("AppService.query_task_details", [
      job_id,
      include_logs,
    ]);
  }

  /**
   * Kill a job (maps to AppService.kill_task)
   */
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

  /**
   * Fetch job output (stdout or stderr) via direct HTTP GET
   */
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
      // Keep the status of an upstream failure so the route answers
      // 502/503/504, whether `fetchUpstream` threw it or the output stopped
      // arriving (a budget spent or a socket dropped mid-body).
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

  /**
   * Enumerate jobs with server-side pagination and archived support
   * (maps to AppService.enumerate_tasks_filtered)
   */
  async enumerateTasksFiltered(
    params: EnumerateTasksFilteredParams,
  ): Promise<EnumerateTasksFilteredResponse> {
    const {
      offset,
      limit,
      include_archived,
      sort_field,
      sort_order,
      app,
      start_time,
      end_time,
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

    const raw = await this.client.call<[unknown[], number] | unknown[]>(
      "AppService.enumerate_tasks_filtered",
      [offset, limit, opts],
    );
    // Backend returns [[...jobs], totalTasks]
    const jobs = (Array.isArray(raw[0]) ? raw[0] : raw) as JobListItem[];
    const totalTasks = typeof raw[1] === "number" ? raw[1] : 0;
    return { jobs, totalTasks };
  }

  /**
   * Query task status summary with optional archived filter
   * (maps to AppService.query_task_summary_filtered)
   */
  async queryTaskSummaryFiltered(
    params: QueryTaskSummaryFilteredParams,
  ): Promise<QueryTaskSummaryFilteredResponse> {
    const opts: Record<string, unknown> = {};
    if (params.include_archived) opts.include_archived = 1;
    return this.client.call("AppService.query_task_summary_filtered", [opts]);
  }

  /**
   * Query app/service summary with optional archived filter
   * (maps to AppService.query_app_summary_filtered)
   */
  async queryAppSummaryFiltered(
    params: QueryAppSummaryFilteredParams,
  ): Promise<QueryAppSummaryFilteredResponse> {
    const opts: Record<string, unknown> = {};
    if (params.include_archived) opts.include_archived = 1;
    return this.client.call("AppService.query_app_summary_filtered", [opts]);
  }

  /**
   * Submit a service job (maps to AppService.start_app2)
   */
  async submitService(
    params: SubmitServiceParams,
  ): Promise<SubmitServiceResponse> {
    const { app_name, app_params } = params;

    // base_url picks the job's per-site container and becomes P3_BASE_URL in
    // the job, so it comes from server config and never from the request.
    try {
      return await this.client.call("AppService.start_app2", [
        app_name,
        app_params,
        { base_url: getAppBaseUrl() },
      ]);
    } catch (error) {
      // A submit is not idempotent: once the request was sent, a service that
      // never answered may still have queued the job. A connect timeout never
      // sent it, and keeps its own message.
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

/**
 * Factory function to create an app service instance
 */
export function createAppService(token: string): AppService {
  return new AppService(token);
}

