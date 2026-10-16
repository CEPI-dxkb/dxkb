import { z } from "zod";
import {
  fastaSequenceTypes,
  fastaTypeLabels,
  maxFastaIds,
  supportsFastaType,
  type FastaRequest,
  type FastaResource,
} from "./fasta";
import {
  downloadFormatIds,
  downloadFormats,
  downloadFormatsFor,
  downloadNoncePattern,
  downloadRowCount,
  downloadUnavailableReason,
  maxSelectionDownloadRows,
  unselectableColumnsReason,
  type DownloadRequest,
} from "./downloads";
import { safeFileNameBase } from "./file-name";
import { DataApiValidationError, getResourceDefinition } from "./resources";
import { validateRql } from "./rql";
import { maxExportRows, sortKeys } from "./types";
import type { DataApiRequest, DataResource, DataSort } from "./types";

export { maxExportRows, maxRequestBytes } from "./types";

export const pageSize = 200;
export const maxSelectedRows = 500;
export const maxFields = 200;
export const maxIdentifierLength = 1_000;

const fieldListSchema = z.array(z.string().min(1).max(128)).max(maxFields);
const sortKeySchema = z.object({
  field: z.string().min(1).max(128),
  direction: z.enum(["asc", "desc"]),
});
// Legacy's longest default order (FeatureGrid's) has two keys after its first.
const sortSchema = sortKeySchema.extend({
  then: z.array(sortKeySchema).max(3).optional(),
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
  for (const { field } of sortKeys(sort)) {
    if (!Object.hasOwn(fields, field) || !fields[field].sortable)
      throw new DataApiValidationError(
        `Field ${field} cannot sort ${resource}.`,
      );
  }
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

const downloadRequestSchema = z.object({
  format: z.enum(downloadFormatIds),
  scope: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("selected"),
      ids: z
        .array(z.string().min(1).max(maxIdentifierLength))
        .min(1, "Choose at least one row to download.")
        .max(
          maxSelectionDownloadRows,
          `Selection downloads are limited to ${maxSelectionDownloadRows.toLocaleString("en-US")} rows.`,
        ),
    }),
    z.object({
      kind: z.literal("query"),
      rql: z.string().max(8_000).optional(),
      keyword: z.string().max(500).optional(),
      keywordMode: z.enum(["exact", "prefix"]).optional(),
    }),
  ]),
  sort: sortSchema.optional(),
  // An empty list is refused below, with the reason the tile shows.
  fields: fieldListSchema.optional(),
  fileNameBase: z.string().max(200),
  total: z.number().int().min(0),
  nonce: z.string().regex(downloadNoncePattern).optional(),
});

/**
 * Body of `POST /api/data/[resource]/download`, whether it arrived as JSON or
 * as the native transport's form field. Duplicate ids are dropped, so the
 * upstream `in(...)` clause (and the file) names each record once; `fields`
 * are dropped from a sequence format, which has no columns; and the file name
 * base comes back safe for a `Content-Disposition` header.
 */
export function validateDownloadRequest(
  resource: DataResource,
  value: unknown,
): DownloadRequest {
  const parsed = downloadRequestSchema.safeParse(value);
  if (!parsed.success) {
    throw new DataApiValidationError(
      parsed.error.issues[0]?.message ?? "Invalid download request.",
    );
  }
  const request = parsed.data;
  if (!downloadFormatsFor(resource).includes(request.format)) {
    throw new DataApiValidationError(
      `${downloadFormats[request.format].label} downloads are not available for ${resource}.`,
    );
  }
  const scope =
    request.scope.kind === "selected"
      ? { kind: "selected" as const, ids: [...new Set(request.scope.ids)] }
      : {
          ...request.scope,
          rql: request.scope.rql
            ? validateRql(resource, request.scope.rql)
            : undefined,
        };
  const fields =
    downloadFormats[request.format].kind === "table"
      ? request.fields
      : undefined;
  validateFields(resource, fields, "select");
  const columnsReason = fields ? unselectableColumnsReason(fields) : null;
  if (columnsReason)
    throw new DataApiValidationError(
      `${columnsReason}; download every field instead.`,
    );
  validateSort(resource, request.sort);
  const reason = downloadUnavailableReason({
    format: request.format,
    scope: scope.kind === "selected" ? "selected" : "all",
    rows: downloadRowCount({ scope, total: request.total }),
  });
  if (reason) throw new DataApiValidationError(`${reason}.`);
  return {
    format: request.format,
    scope,
    sort: request.sort,
    fields,
    fileNameBase: safeFileNameBase(request.fileNameBase),
    total: request.total,
    nonce: request.nonce,
  };
}
