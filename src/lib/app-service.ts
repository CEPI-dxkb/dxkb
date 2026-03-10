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
  QueryTaskSummaryFilteredParams,
  QueryTaskSummaryFilteredResponse,
  QueryAppSummaryFilteredParams,
  QueryAppSummaryFilteredResponse,
} from "@/types/workspace";

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

    const url = `https://p3.theseed.org/services/app_service/task_info/${job_id}/${output_type}`;

    const authToken = this.client.getAuthToken();
    if (!authToken) {
      throw new Error("Authentication token not available");
    }

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: "OAuth " + authToken,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.text();
    } catch (error) {
      throw new Error(
        `Failed to fetch ${output_type} for job ${job_id}: ${error instanceof Error ? error.message : String(error)}`,
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
    const { offset, limit, include_archived, sort_field, sort_order, app } =
      params;
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
    return this.client.call("AppService.enumerate_tasks_filtered", [
      offset,
      limit,
      opts,
    ]);
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
    const { app_name, app_params, context } = params;

    // Build the context object with base_url
    const contextObj = {
      base_url: context?.base_url || "https://dev.dxkb.org",
    };

    return this.client.call("AppService.start_app2", [
      app_name,
      app_params,
      contextObj,
    ]);
  }
}

/**
 * Factory function to create an app service instance
 */
export function createAppService(token: string): AppService {
  return new AppService(token);
}

