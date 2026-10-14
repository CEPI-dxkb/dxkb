import { z } from "zod";
import {
  fastaSequenceTypes,
  fastaTypeLabels,
  maxFastaIds,
  supportsFastaType,
  type FastaRequest,
  type FastaResource,
} from "./fasta";
import { DataApiValidationError, getResourceDefinition } from "./resources";
import { validateRql } from "./rql";
import { maxExportRows } from "./types";
import type { DataApiRequest, DataResource, DataSort } from "./types";

export { maxExportRows, maxRequestBytes } from "./types";

export const pageSize = 200;
export const maxSelectedRows = 500;
export const maxFields = 200;
export const maxIdentifierLength = 1_000;

const fieldListSchema = z.array(z.string().min(1).max(128)).max(maxFields);
const sortSchema = z.object({
  field: z.string().min(1).max(128),
  direction: z.enum(["asc", "desc"]),
});
const requestSchema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("collection"),
    rql: z.string().max(8_000).optional(),
    keyword: z.string().max(500).optional(),
    keywordMode: z.enum(["exact", "prefix"]).optional(),
    page: z.number().int().min(1).max(1_000_000).optional(),
    pageSize: z.number().int().min(1).max(pageSize).optional(),
    sort: sortSchema.optional(),
    fields: fieldListSchema.optional(),
    facets: fieldListSchema.optional(),
  }),
  z.object({
    operation: z.literal("member"),
    id: z.string().min(1).max(maxIdentifierLength),
    idField: z.string().min(1).max(128).optional(),
    fields: fieldListSchema.optional(),
  }),
  z.object({
    operation: z.literal("selected"),
    ids: z
      .array(z.string().min(1).max(maxIdentifierLength))
      .min(1)
      .max(maxSelectedRows),
    fields: fieldListSchema.optional(),
  }),
  z.object({
    operation: z.literal("export"),
    rql: z.string().max(8_000).optional(),
    keyword: z.string().max(500).optional(),
    keywordMode: z.enum(["exact", "prefix"]).optional(),
    fields: fieldListSchema.min(1),
    limit: z.number().int().min(1).max(maxExportRows),
    offset: z.number().int().min(0).optional(),
    sort: sortSchema.optional(),
  }),
]);

function validateFields(
  resource: DataResource,
  fields: string[] | undefined,
  purpose: "select" | "facet",
): void {
  if (!fields) return;
  const metadata = getResourceDefinition(resource).fields;
  for (const field of fields) {
    if (!Object.hasOwn(metadata, field)) {
      throw new DataApiValidationError(
        `Field ${field} cannot be used for ${purpose} on ${resource}.`,
      );
    }
    if (purpose === "facet" && !metadata[field].facet) {
      throw new DataApiValidationError(
        `Field ${field} cannot be used for ${purpose} on ${resource}.`,
      );
    }
  }
}

function validateSort(
  resource: DataResource,
  sort: DataSort | undefined,
): void {
  if (!sort) return;
  const fields = getResourceDefinition(resource).fields;
  if (!Object.hasOwn(fields, sort.field) || !fields[sort.field].sortable)
    throw new DataApiValidationError(
      `Field ${sort.field} cannot sort ${resource}.`,
    );
}

export function validateDataApiRequest(
  resource: DataResource,
  value: unknown,
): DataApiRequest {
  const parsed = requestSchema.safeParse(value);
  if (!parsed.success) {
    throw new DataApiValidationError(
      parsed.error.issues[0]?.message ?? "Invalid data request.",
    );
  }
  const request = parsed.data;
  validateFields(resource, request.fields, "select");
  validateSort(resource, "sort" in request ? request.sort : undefined);
  if (request.operation === "collection")
    validateFields(resource, request.facets, "facet");
  if (
    request.operation === "export" &&
    (request.offset ?? 0) + request.limit > maxExportRows
  ) {
    throw new DataApiValidationError(
      `Exports are limited to ${maxExportRows.toLocaleString()} rows.`,
    );
  }
  if ("rql" in request && request.rql)
    request.rql = validateRql(resource, request.rql);
  return request;
}

const fastaRequestSchema = z.object({
  type: z.enum(fastaSequenceTypes),
  ids: z
    .array(z.string().min(1).max(maxIdentifierLength))
    .min(1, "Choose at least one record to download.")
    .max(
      maxFastaIds,
      `FASTA downloads are limited to ${maxFastaIds.toLocaleString()} records per request.`,
    ),
});

/**
 * Body of `POST /api/data/[resource]/fasta`. Duplicate ids are dropped, so the
 * upstream `in(...)` clause (and the file) names each record once.
 */
export function validateFastaRequest(
  resource: FastaResource,
  value: unknown,
): FastaRequest {
  const parsed = fastaRequestSchema.safeParse(value);
  if (!parsed.success) {
    throw new DataApiValidationError(
      parsed.error.issues[0]?.message ?? "Invalid FASTA request.",
    );
  }
  const { type, ids } = parsed.data;
  if (!supportsFastaType(resource, type)) {
    throw new DataApiValidationError(
      `${fastaTypeLabels[type]} FASTA is not available for ${resource}.`,
    );
  }
  return { type, ids: [...new Set(ids)] };
}
