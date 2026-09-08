import type { z } from "zod";

export const maxExportRows = 10_000;

export const dataResources = [
  "taxonomy",
  "genome",
  "genome_feature",
  "epitope",
  "epitope_assay",
  "surveillance",
  "serology",
  "strain",
  "protein_feature",
  "protein_structure",
  "experiment",
  "bioset",
  "genome_sequence",
  "sequence_feature",
  "ppi",
] as const;

export type DataResource = (typeof dataResources)[number];
export type FieldType = "string" | "number" | "boolean" | "date";
export type SortDirection = "asc" | "desc";
export type RqlFieldOperator = "eq" | "ne" | "lt" | "le" | "gt" | "ge" | "in";

export interface ResourceField {
  type: FieldType;
  cardinality: "scalar" | "multiple";
  selectable: boolean;
  sortable: boolean;
  facet: boolean;
  quote: "always" | "auto" | "never";
  operators: readonly RqlFieldOperator[];
}

export interface ResourceDefinition<
  T extends Record<string, unknown> = Record<string, unknown>,
> {
  idField: string;
  identifierFields: readonly string[];
  fields: Readonly<Record<string, ResourceField>>;
  schema: z.ZodType<T>;
}

export interface DataSort {
  field: string;
  direction: SortDirection;
}

export interface CollectionRequest {
  operation: "collection";
  rql?: string;
  keyword?: string;
  keywordMode?: "exact" | "prefix";
  page?: number;
  pageSize?: number;
  sort?: DataSort;
  fields?: string[];
  facets?: string[];
}

export interface MemberRequest {
  operation: "member";
  id: string;
  idField?: string;
  fields?: string[];
}

export interface SelectedRequest {
  operation: "selected";
  ids: string[];
  fields?: string[];
}

export interface ExportRequest {
  operation: "export";
  rql?: string;
  keyword?: string;
  keywordMode?: "exact" | "prefix";
  fields: string[];
  limit: number;
  offset?: number;
  sort?: DataSort;
}

export type DataApiRequest =
  CollectionRequest | MemberRequest | SelectedRequest | ExportRequest;

export interface FacetBucket {
  value: string | number | boolean;
  count: number;
}

export interface CollectionResult<T extends Record<string, unknown>> {
  rows: T[];
  total: number;
  facets: Partial<Record<string, FacetBucket[]>>;
  page: number;
  pageSize: number;
}

export interface MemberResult<T extends Record<string, unknown>> {
  row: T | null;
}

export interface RowsResult<T extends Record<string, unknown>> {
  rows: T[];
}
