// Core workspace object types
//
// `type` is the raw string returned by the Workspace API (folder, job_result,
// reads, genome_group, etc.). It is intentionally not narrowed here — the
// rules for which types count as folder-like live in `./utils` and the
// canonical `WorkspaceItem` in `./domain.ts`.
export interface WorkspaceObject {
  id: string;
  name: string;
  type: string;
  size?: number;
  modified?: string;
  status?: string;
  path: string;
  isDirectory: boolean;
  permissions?: string;
  owner?: string;
}

// Workspace.ls parameters and response
export interface WorkspaceListParams {
  paths: string[];
  excludeDirectories?: boolean;
  excludeObjects?: boolean;
  query?: {
    type?: string[];
    name?: string;
    owner?: string;
  };
  recursive?: boolean;
  limit?: number;
  offset?: number;
}

export interface WorkspaceListResponse {
  objects: WorkspaceObject[];
  total: number;
  offset: number;
  limit: number;
}

// Workspace.get_permissions parameters and response
export interface WorkspaceGetPermissionsParams {
  objects: {
    workspace: string;
    id: string;
  }[];
}

export interface WorkspacePermissions {
  workspace: string;
  id: string;
  permissions: string[];
  owner: string;
  isPublic: boolean;
}

export interface WorkspaceGetPermissionsResponse {
  permissions: WorkspacePermissions[];
}

// Workspace.create parameters and response
export interface WorkspaceCreateParams {
  objects: {
    workspace: string;
    id: string;
    type: "folder" | "file";
    meta?: Record<string, unknown>;
  }[];
}

export interface WorkspaceCreateResponse {
  objects: {
    workspace: string;
    id: string;
    type: string;
    meta: Record<string, unknown>;
  }[];
}

/**
 * Path-based Workspace.create params for uploads.
 * objects: [fullPath, type, userMeta, content][] (BV-BRC API format).
 * createUploadNodes: true returns Shock node URLs in the result (index 11 = link_reference).
 */
export interface WorkspaceCreateUploadParams {
  objects: [string, string, Record<string, unknown>, string][];
  createUploadNodes?: boolean;
  overwrite?: boolean;
}

/** Parsed result from Workspace.create with createUploadNodes: true (result[0][0] tuple; index 11 = link_reference). */
export interface WorkspaceCreateUploadNodeResult {
  link_reference: string;
}

// Workspace.delete parameters and response
export interface WorkspaceDeleteParams {
  /** Full object paths (e.g. /user@realm/home/file.pdb). */
  objects: string[];
  /** If true, delete non-empty directories. */
  force?: boolean;
  /** If true, delete directory objects; if false, only files. */
  deleteDirectories?: boolean;
}

export interface WorkspaceDeleteResponse {
  objects: {
    workspace: string;
    id: string;
  }[];
}

// Workspace.copy parameters and response
export interface WorkspaceCopyParams {
  objects: {
    workspace: string;
    id: string;
  }[];
  new_workspace: string;
  new_id: string;
}

export interface WorkspaceCopyResponse {
  objects: {
    workspace: string;
    id: string;
  }[];
}

/** Path-based copy params (BV-BRC API: objects as [sourcePath, destPath][]). */
export interface WorkspaceCopyByPathsParams {
  objects: [string, string][];
  recursive: boolean;
  move: boolean;
}

/** Response from Workspace.copy when using path-based params (result array). */
export type WorkspaceCopyByPathsResponse = unknown[];

// Workspace.move parameters and response
export interface WorkspaceMoveParams {
  objects: {
    workspace: string;
    id: string;
  }[];
  new_workspace: string;
  new_id: string;
}

export interface WorkspaceMoveResponse {
  objects: {
    workspace: string;
    id: string;
  }[];
}

// Workspace.rename parameters and response
export interface WorkspaceRenameParams {
  objects: {
    workspace: string;
    id: string;
  }[];
  new_name: string;
}

export interface WorkspaceRenameResponse {
  objects: {
    workspace: string;
    id: string;
  }[];
}

// Workspace.get parameters and response
export interface WorkspaceGetParams {
  objects: {
    workspace: string;
    id: string;
  }[];
  infos: {
    workspace: string;
    id: string;
    metadata_only: boolean;
  }[];
}

export interface WorkspaceGetResponse {
  objects: {
    workspace: string;
    id: string;
    type: string;
    meta: Record<string, unknown>;
    data?: string; // Base64 encoded data for files
  }[];
}

/** Raw Workspace.get result: result[0] = path results, result[0][i][0] = object tuple. */
export type WorkspaceGetRawResult = unknown[];

/** task_data from userMeta (index 7) for job_result objects. */
export interface JobResultTaskData {
  success?: number;
  start_time?: number;
  end_time?: number;
  app_id?: string;
  task_id?: string;
  elapsed_time?: number;
}

/** sysMeta (tuple index 8) for job_result objects. */
export interface JobResultSysMeta {
  success?: number;
  elapsed_time?: number;
  id?: string;
  parameters?: Record<string, unknown>;
  end_time?: number;
  start_time?: number;
  is_folder?: number;
  output_files?: [string, string][];
  app?: { script?: string; label?: string; id?: string; description?: string };
  hostname?: string;
  job_output?: number;
}

/** Parsed object from Workspace.get single-path response (one tuple). */
export interface ResolvedPathObject {
  name: string;
  type: string;
  path: string;
  creation_time: string;
  id: string;
  owner_id: string;
  size: number;
  userMeta: Record<string, unknown>;
  sysMeta: Record<string, unknown>;
  taskData?: JobResultTaskData;
  jobSysMeta?: JobResultSysMeta;
}

// Workspace.save parameters and response
export interface WorkspaceSaveParams {
  objects: {
    workspace: string;
    id: string;
    type: string;
    meta: Record<string, unknown>;
    data?: string; // Base64 encoded data for files
  }[];
}

export interface WorkspaceSaveResponse {
  objects: {
    workspace: string;
    id: string;
    type: string;
    meta: Record<string, unknown>;
  }[];
}

// Generic JSON-RPC request/response types
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

// Workspace API method names
// Workspace.update_metadata parameters: objects are [path, meta, type][] per object
export interface WorkspaceUpdateMetadataParams {
  /** Array of [path, meta, type] tuples; meta is typically {} */
  objects: [string, Record<string, unknown>, string][];
}

/** Params for Workspace.update_auto_meta (trigger inspection/metadata update for uploaded objects). */
export interface WorkspaceUpdateAutoMetaParams {
  objects: string[];
}

/** Params for Workspace.du (disk usage). */
export interface WorkspaceDuParams {
  paths: string[];
  recursive?: boolean;
  adminmode?: boolean;
}

/** Response from Workspace.du: result[0] = array of [path, sizeBytes, fileCount, dirCount, error]. */
export type WorkspaceDuResponse = [[string, number, number, number, string][]];

export type WorkspaceMethod =
  | "Workspace.ls"
  | "Workspace.du"
  | "Workspace.list_permissions"
  | "Workspace.get_permissions"
  | "Workspace.create"
  | "Workspace.delete"
  | "Workspace.copy"
  | "Workspace.move"
  | "Workspace.rename"
  | "Workspace.get"
  | "Workspace.save"
  | "Workspace.get_download_url"
  | "Workspace.get_archive_url"
  | "Workspace.update_metadata"
  | "Workspace.update_auto_meta";

export const forbiddenDownloadTypes = [
  "experiment_group",
  "feature_group",
  "genome_group",
  "modelfolder",
] as const;

export const otherWorkspaceObjectTypes = [
  "folder",
  "job_result",
  "feature_group",
  "experiment_group",
  "genome_group",
  "modelfolder",
] as const;

export const viewableTypes = [
  "txt",
  "html",
  "json",
  "csv",
  "tsv",
  "diffexp_experiment",
  "diffexp_expression",
  "diffexp_mapping",
  "diffexp_sample",
  "pdf",
  "diffexp_input_data",
  "diffexp_input_metadata",
  "svg",
  "gif",
  "png",
  "jpg",
  "aligned_dna_fasta",
  "aligned_protein_fasta",
  "feature_dna_fasta",
  "feature_protein_fasta",
  "pdb",
] as const;

export const knownUploadTypes = {
  unspecified: {
    label: "Unspecified",
    formats: ["*.*"],
  },
  aligned_dna_fasta: {
    label: "Aligned DNA FASTA",
    formats: [".fa", ".fasta", ".faa", ".fna", ".afa", ".xmfa"],
    description: "DNA sequences must be provided in fasta format (typically .fa, .fasta, .faa). Genbank formatted files are not currently accepted.",
  },
  aligned_protein_fasta: {
    label: "Aligned Protein FASTA",
    formats: [".fa", ".fasta", ".faa", ".fna", ".afa", ".xmfa"],
    description: "Protein sequences must be provided in fasta format (typically .fa, .fasta, .faa). Genbank formatted files are not currently accepted.",
  },
  bai: {
    label: "Indexed Sequence Alignment Data",
    formats: [".bai"],
  },
  bam: {
    label: "Sequence Alignment Data",
    formats: [".bam"],
  },
  contigs: {
    label: "Contigs",
    formats: [".fa", ".fasta", ".faa", ".fna"],
    description: "Contigs must be provided in fasta format (typically .fa, .fasta, .fna). Genbank formatted files are not currently accepted.",
  },
  csv: {
    label: "CSV",
    formats: [".csv"],
    description: "A CSV (comma separated values) file.",
  },
  diffexp_input_data: {
    label: "Diff. Expression Input Data",
    formats: [".csv", ".txt", ".xls", ".xlsx"],
  },
  diffexp_input_metadata: {
    label: "Diff. Expression Input Metadata",
    formats: [".csv", ".txt", ".xls", ".xlsx"],
  },
  doc: {
    label: "DOC",
    formats: [".doc"],
  },
  docx: {
    label: "DOCX",
    formats: [".docx"],
  },
  embl: {
    label: "EMBL",
    formats: [".embl"],
    description: "A DNA or protein sequence file.",
  },
  feature_dna_fasta: {
    label: "Feature DNA FASTA",
    formats: [".fa", ".faa", ".fasta", ".faa"],
    description: "DNA sequences must be provided in fasta format (typically .fa, .fasta, .faa). Genbank formatted files are not currently accepted.",
  },
  feature_protein_fasta: {
    label: "Feature Protein FASTA",
    formats: [".fa", "fna", ".fasta", ".faa"],
    description: "Protein sequences must be provided in fasta format (typically .fa, .fasta, .faa). Genbank formatted files are not currently accepted.",
  },
  genbank_file: {
    label: "GBK",
    formats: [".gbk"],
    description: "A GenBank formatted file.",
  },
  gff: {
    label: "GFF",
    formats: [".gff", "gtf"],
    description: "A General Feature Format file.",
  },
  gif: {
    label: "GIF Image",
    formats: [".gif"],
    description: "A GIF image file.",
  },
  jpg: {
    label: "JPEG Image",
    formats: [".jpg", ".jpeg"],
    description: "A JPEG image file.",
  },
  json: {
    label: "JSON",
    formats: [".json"],
    description: "A json file.",
  },
  nwk: {
    label: "Newick",
    formats: [".nwk"],
    description: "Phylogenetic tree file.",
  },
  pdb: {
    label: "PDB",
    formats: [".pdb"],
    description: "A pdb file describing a molecular structure.",
  },
  pdf: {
    label: "PDF",
    formats: [".pdf"],
    description: "A pdf file.",
  },
  phyloxml: {
    label: "PHYLOXML",
    formats: [".xml", ".phyloxml"],
    description: "An phyloxml file.",
  },
  png: {
    label: "PNG Image",
    formats: [".png"],
    description: "A PNG image file.",
  },
  ppt: {
    label: "PPT",
    formats: [".ppt"],
  },
  pptx: {
    label: "PPTX",
    formats: [".pptx"],
  },
  reads: {
    label: "Reads",
    formats: [".fq", ".fastq", ".fa", ".fasta", ".gz", ".bz2"],
    description: "Reads must be in fasta or fastq format (typically .fa, .fasta, .fq, .fastq).  Genbank formatted files are not currently accepted.",
  },
  svg: {
    label: "SVG Image",
    formats: [".svg"],
    description: "A SVG image file.",
  },
  tbi: {
    label: "TBI",
    formats: [".tbi"],
  },
  tsv: {
    label: "TSV",
    formats: [".tsv"],
    description: "A TSV (tab separated values) file.",
  },
  txt: {
    label: "Plain Text",
    formats: [".txt"],
    description: "A plain text file.",
  },
  vcf: {
    label: "VCF",
    formats: [".vcf"],
    description: "A Variant Call Format file.",
  },
  vcf_gz: {
    label: "VCF_GZ",
    formats: [".vcf.gz"],
    description: "A compressed Variant Call Format file.",
  },
  xls: {
    label: "XLS",
    formats: [".xls"],
    description: "An Excel file.",
  },
  xlsx: {
    label: "XLSX",
    formats: [".xlsx"],
    description: "An Excel file.",
  },
  xml: {
    label: "XML",
    formats: [".xml"],
    description: "An xml file.",
  },
} as const;

// Type for the keys of knownUploadTypes
export type ValidWorkspaceObjectTypes = keyof typeof knownUploadTypes | typeof otherWorkspaceObjectTypes[number] | typeof viewableTypes[number];

export interface changeableTypes {
  aligned_dna_fasta: { label: "aligned_dna_fasta"; value: "aligned_dna_fasta" };
  aligned_protein_fasta: {
    label: "aligned_protein_fasta";
    value: "aligned_protein_fasta";
  };
  bam: { label: "bam"; value: "bam" };
  bai: { label: "bai"; value: "bai" };
  contigs: { label: "contigs"; value: "contigs" };
  csv: { label: "csv"; value: "csv" };
  diffexp_input_data: {
    label: "diffexp_input_data";
    value: "diffexp_input_data";
  };
  diffexp_input_metadata: {
    label: "diffexp_input_metadata";
    value: "diffexp_input_metadata";
  };
  doc: { label: "doc"; value: "doc" };
  docx: { label: "docx"; value: "docx" };
  embl: { label: "embl"; value: "embl" };
  feature_dna_fasta: { label: "feature_dna_fasta"; value: "feature_dna_fasta" };
  feature_protein_fasta: {
    label: "feature_protein_fasta";
    value: "feature_protein_fasta";
  };
  genbank_file: { label: "genbank_file"; value: "genbank_file" };
  gff: { label: "gff"; value: "gff" };
  gif: { label: "gif"; value: "gif" };
  jpg: { label: "jpg"; value: "jpg" };
  json: { label: "json"; value: "json" };
  nwk: { label: "nwk"; value: "nwk" };
  pdf: { label: "pdf"; value: "pdf" };
  phyloxml: { label: "phyloxml"; value: "phyloxml" };
  png: { label: "png"; value: "png" };
  pdb: { label: "pdb"; value: "pdb" };
  ppt: { label: "ppt"; value: "ppt" };
  pptx: { label: "pptx"; value: "pptx" };
  reads: { label: "reads"; value: "reads" };
  string: { label: "string"; value: "string" };
  svg: { label: "svg"; value: "svg" };
  tar_gz: { label: "tar_gz"; value: "tar_gz" };
  tbi: { label: "tbi"; value: "tbi" };
  tsv: { label: "tsv"; value: "tsv" };
  txt: { label: "txt"; value: "txt" };
  unspecified: { label: "unspecified"; value: "unspecified" };
  vcf: { label: "vcf"; value: "vcf" };
  vcf_gz: { label: "vcf_gz"; value: "vcf_gz" };
  wig: { label: "wig"; value: "wig" };
  xls: { label: "xls"; value: "xls" };
  xlsx: { label: "xlsx"; value: "xlsx" };
  xml: { label: "xml"; value: "xml" };
}

/** Sorted list of object type IDs for the "Change Object Type" dialog. */
export const editTypeOptions: string[] = [
  "aligned_dna_fasta",
  "aligned_protein_fasta",
  "bai",
  "bam",
  "contigs",
  "csv",
  "diffexp_input_data",
  "diffexp_input_metadata",
  "doc",
  "docx",
  "embl",
  "feature_dna_fasta",
  "feature_protein_fasta",
  "genbank_file",
  "gff",
  "gif",
  "jpg",
  "json",
  "nwk",
  "pdb",
  "pdf",
  "phyloxml",
  "png",
  "ppt",
  "pptx",
  "reads",
  "string",
  "svg",
  "tar_gz",
  "tbi",
  "tsv",
  "txt",
  "unspecified",
  "vcf",
  "vcf_gz",
  "wig",
  "xls",
  "xlsx",
  "xml",
].sort((a, b) => a.localeCompare(b));


