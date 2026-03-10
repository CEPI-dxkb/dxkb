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
  context?: {
    base_url?: string;
  };
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
    }
  ]
}

// Filtered jobs API types (server-side pagination + archived support)
export interface EnumerateTasksFilteredParams {
  offset: number;
  limit: number;
  include_archived?: boolean;
  sort_field?: string;
  sort_order?: "asc" | "desc";
  app?: string;
}
export type EnumerateTasksFilteredResponse = JobListItem[];

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

/** Runtime constant for workspace changeable object types (label/value for dropdowns, etc.). */
export const WORKSPACE_CHANGEABLE_TYPES = {
  aligned_dna_fasta: { label: "Aligned DNA Fasta", value: "aligned_dna_fasta" },
  aligned_protein_fasta: { label: "Aligned Protein Fasta", value: "aligned_protein_fasta" },
  bam: { label: "BAM", value: "bam" },
  bai: { label: "BAI", value: "bai" },
  bigwig: { label: "BigWig", value: "bigwig" },
  contigs: { label: "Contigs", value: "contigs" },
  csv: { label: "CSV", value: "csv" },
  diffexp_input_data: { label: "DiffExp Input Data", value: "diffexp_input_data" },
  diffexp_input_metadata: { label: "DiffExp Input Metadata", value: "diffexp_input_metadata" },
  doc: { label: "DOC", value: "doc" },
  docx: { label: "DOCX", value: "docx" },
  embl: { label: "EMBL", value: "embl" },
  feature_dna_fasta: { label: "Feature DNA Fasta", value: "feature_dna_fasta" },
  feature_protein_fasta: { label: "Feature Protein Fasta", value: "feature_protein_fasta" },
  genbank_file: { label: "Genbank File", value: "genbank_file" },
  gff: { label: "GFF", value: "gff" },
  gif: { label: "GIF", value: "gif" },
  graph: { label: "Graph", value: "graph" },
  jpg: { label: "JPG", value: "jpg" },
  json: { label: "JSON", value: "json" },
  nwk: { label: "Newick", value: "nwk" },
  pdf: { label: "PDF", value: "pdf" },
  phyloxml: { label: "PHYLOXML", value: "phyloxml" },
  png: { label: "PNG", value: "png" },
  pdb: { label: "PDB", value: "pdb" },
  ppt: { label: "PPT", value: "ppt" },
  pptx: { label: "PPTX", value: "pptx" },
  reads: { label: "Reads", value: "reads" },
  string: { label: "String", value: "string" },
  svg: { label: "SVG", value: "svg" },
  tar_gz: { label: "TAR.GZ", value: "tar_gz" },
  tbi: { label: "TBI", value: "tbi" },
  tsv: { label: "TSV", value: "tsv" },
  txt: { label: "TXT", value: "txt" },
  unspecified: { label: "Unspecified", value: "unspecified" },
  vcf: { label: "VCF", value: "vcf" },
  vcf_gz: { label: "VCF.GZ", value: "vcf_gz" },
  wig: { label: "WIG", value: "wig" },
  xls: { label: "XLS", value: "xls" },
  xlsx: { label: "XLSX", value: "xlsx" },
  xml: { label: "XML", value: "xml" },
} as const;

export type WorkspaceChangeableTypes = typeof WORKSPACE_CHANGEABLE_TYPES;