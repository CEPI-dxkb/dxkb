// JSON-RPC types for BV-BRC API communication
export interface JsonRpcRequest {
  id: number;
  method: string;
  params: any[];
  jsonrpc: "2.0";
}

export interface JsonRpcResponse<T = any> {
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  jsonrpc: "2.0";
}

// Job/Job Status types
export type JobStatus =
  | "pending"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "error";

export interface JobBase {
  id: string;
  app: string;
  status: JobStatus;
  submit_time: string;
  start_time?: string;
  completed_time?: string;
  owner: string;
  parameters: Record<string, any>;
  output_path?: string;
  output_file?: string;
}

// Job enumeration response
export interface JobListItem extends JobBase {
  app_spec?: {
    id: string;
    script: string;
    label: string;
    description: string;
  };
  elapsed_time?: number;
  req_memory?: string;
  req_cpu?: number;
  req_runtime?: string;
}

// Job summary response
export interface JobSummary extends JobBase {
  stdout_shock_node?: string;
  stderr_shock_node?: string;
  hostname?: string;
  pid?: number;
  exitcode?: number;
  maxrss?: number;
  user_cpu?: number;
  sys_cpu?: number;
  wall_clock?: number;
}

// Job details response
export interface JobDetails extends JobSummary {
  monitor_url?: string;
  app_definition?: {
    id: string;
    script: string;
    label: string;
    description: string;
    parameters: Array<{
      id: string;
      label: string;
      required: boolean;
      default?: any;
      type: string;
    }>;
  };
  // Raw stdout/stderr content if available
  stdout?: string;
  stderr?: string;
}

// API method specific types
export interface EnumerateJobsParams {
  offset?: number;
  limit?: number;
  status_filter?: JobStatus[];
  app_filter?: string[];
}

export interface QueryJobsParams {
  job_ids: string[];
}

export interface QueryJobSummaryParams {
  job_id: string;
}

export interface QueryJobDetailsParams {
  job_id: string;
  include_logs?: boolean;
}

export interface KillJobParams {
  job_id: string;
}

export interface FetchJobOutputParams {
  job_id: string;
  output_type: "stdout" | "stderr";
}

// Response types for each API method
export type EnumerateJobsResponse = JobListItem[];
export type QueryJobsResponse = JobListItem[];
export type QueryJobSummaryResponse = JobSummary;
export type QueryJobDetailsResponse = JobDetails;
export type KillJobResponse = {
  success: boolean;
  message?: string;
};
export type FetchJobOutputResponse = string;

// Error types
export interface WorkspaceError {
  code: number;
  message: string;
  details?: string;
}

// Workspace service interface
export interface WorkspaceService {
  enumerateJobs(params?: EnumerateJobsParams): Promise<EnumerateJobsResponse>;
  queryJobs(params: QueryJobsParams): Promise<QueryJobsResponse>;
  queryJobSummary(
    params: QueryJobSummaryParams,
  ): Promise<QueryJobSummaryResponse>;
  queryJobDetails(
    params: QueryJobDetailsParams,
  ): Promise<QueryJobDetailsResponse>;
  killJob(params: KillJobParams): Promise<KillJobResponse>;
  fetchJobOutput(params: FetchJobOutputParams): Promise<FetchJobOutputResponse>;
}

// Frontend state types
export interface WorkspaceState {
  Jobs: JobListItem[];
  selectedJob: JobDetails | null;
  loading: boolean;
  error: string | null;
  filters: {
    status: JobStatus[];
    app: string[];
  };
  pagination: {
    offset: number;
    limit: number;
    total: number;
  };
}
