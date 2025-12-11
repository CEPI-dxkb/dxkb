import { createBvBrcClient } from "./jsonrpc-client";
import {
  EnumerateJobsResponse,
  QueryJobsResponse,
  QueryJobSummaryResponse,
  QueryJobDetailsResponse,
  KillJobResponse,
  FetchJobOutputResponse,
  SubmitServiceResponse,
  EnumerateJobsParams,
  QueryJobsParams,
  QueryJobSummaryParams,
  QueryJobDetailsParams,
  KillJobParams,
  FetchJobOutputParams,
  SubmitServiceParams,
} from "../types/workspace";

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
   * Enumerate jobs (maps to AppService.enumerate_tasks)
   */
  async enumerateJobs(
    params?: EnumerateJobsParams,
  ): Promise<EnumerateJobsResponse> {
    const { offset = 0, limit = 30000 } = params || {};

    return this.client.call("AppService.enumerate_tasks", [offset, limit]);
  }

  /**
   * Query multiple jobs by IDs (maps to AppService.query_tasks)
   */
  async queryJobs(params: QueryJobsParams): Promise<QueryJobsResponse> {
    const { job_ids } = params;

    return this.client.call("AppService.query_tasks", [job_ids]);
  }

  /**
   * Get job summary (maps to AppService.query_task_summary)
   */
  async queryJobSummary(
    params: QueryJobSummaryParams,
  ): Promise<QueryJobSummaryResponse> {
    const { job_id } = params;

    return this.client.call("AppService.query_task_summary", [job_id]);
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

    return this.client.call("AppService.kill_task", [job_id]);
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

