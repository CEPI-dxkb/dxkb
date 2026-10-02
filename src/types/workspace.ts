// JSON-RPC types for BV-BRC API communication
export interface JsonRpcRequest {
  id: number;
  method: string;
  params: unknown[];
  jsonrpc: "2.0";
}

export interface JsonRpcResponse<T = unknown> {
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
  jsonrpc: "2.0";
}

// Job/Job Status types
export type JobStatus =
  | "pending"
  | "queued"
  | "running"
  | "in-progress"
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
  parameters: Record<string, unknown>;
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
    parameters: {
      id: string;
      label: string;
      required: boolean;
      default?: unknown;
      type: string;
    }[];
  };
  // Raw stdout/stderr content if available
  stdout?: string;
  stderr?: string;
}

// API method specific types
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

export interface SubmitServiceParams {
  app_name: string;
  app_params: Record<string, unknown>;
}

// Response types for each API method
export type QueryJobDetailsResponse = JobDetails;
// Raw JSON-RPC result is [status_code, message], e.g. [1, "Canceled 18978105"]
export type KillJobRawResponse = [number, string];
export interface KillJobResponse {
  success: boolean;
  message: string;
}
export type FetchJobOutputResponse = string;
export interface SubmitServiceResponse {
  success: boolean;
  job: [
    {
      id: string;
      app: string;
      status: JobStatus;
      submit_time: string;
      params: Record<string, unknown>;
    },
  ];
}

// Filtered jobs API types (server-side pagination + archived support)
export interface EnumerateTasksFilteredParams {
  offset: number;
  limit: number;
  include_archived?: boolean;
  sort_field?: string;
  sort_order?: "asc" | "desc";
  app?: string;
  start_time?: string;
  end_time?: string;
}

export interface EnumerateTasksFilteredResponse {
  jobs: JobListItem[];
  totalTasks: number;
}

export interface QueryTaskSummaryFilteredParams {
  include_archived?: boolean;
}
export type QueryTaskSummaryFilteredResponse = Record<string, number>;

export interface QueryAppSummaryFilteredParams {
  include_archived?: boolean;
}
export type QueryAppSummaryFilteredResponse = Record<string, number>;

// Error types
export interface WorkspaceError {
  code: number;
  message: string;
  details?: string;
}
