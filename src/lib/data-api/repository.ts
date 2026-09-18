import { z } from "zod";
import { DataApiValidationError, getResourceDefinition } from "./resources";
import { eq, serializeRql } from "./rql";
import type {
  CollectionRequest,
  CollectionResult,
  DataApiRequest,
  DataResource,
  DataSort,
  FacetBucket,
  MemberRequest,
  MemberResult,
  RowsResult,
} from "./types";
import { pageSize as defaultPageSize } from "./validation";

interface RepositoryOptions {
  baseUrl: string;
  token?: string;
  fetch?: typeof fetch;
  cache?: RequestCache;
  revalidate?: number;
}

export class DataApiError extends Error {
  constructor(
    message: string,
    readonly status = 502,
    readonly code = "upstream_error",
  ) {
    super(message);
    this.name = "DataApiError";
  }
}

function appendQuery(url: URL, clause: string): void {
  url.search = url.search ? `${url.search.slice(1)}&${clause}` : clause;
}

function addPredicate(
  url: URL,
  request: {
    rql?: string;
    keyword?: string;
    keywordMode?: "exact" | "prefix";
  },
  resource: DataResource,
): void {
  const clauses: string[] = [];
  if (request.rql) clauses.push(request.rql);
  if (request.keyword) {
    const keywords = request.keyword.trim().split(/\s+/).filter(Boolean);
    const expressions = keywords.map((value) =>
      serializeRql(resource, {
        operator: "keyword",
        value: request.keywordMode === "exact" ? value : `${value}*`,
      }),
    );
    if (expressions.length === 1) clauses.push(expressions[0]);
    else if (expressions.length > 1)
      clauses.push(`and(${expressions.join(",")})`);
  }
  if (clauses.length === 1) appendQuery(url, clauses[0]);
  else if (clauses.length > 1) appendQuery(url, `and(${clauses.join(",")})`);
}

function addFields(
  url: URL,
  fields: string[] | undefined,
  idField: string,
): boolean {
  if (!fields?.length) return false;
  // The upstream RQL parser misreads identifiers such as `1_pb2` in select().
  // Omit its projection, then project the full response locally.
  if (fields.some((field) => /^\d/.test(field))) return true;
  appendQuery(url, `select(${[...new Set([...fields, idField])].join(",")})`);
  return false;
}

function projectRows(
  rows: Record<string, unknown>[],
  fields: string[] | undefined,
  idField: string,
  projectLocally: boolean,
): Record<string, unknown>[] {
  if (!projectLocally || !fields?.length) return rows;
  const selected = new Set([...fields, idField]);
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).filter(([field]) => selected.has(field)),
    ),
  );
}

function addSort(url: URL, sort: DataSort | undefined, idField: string): void {
  if (!sort) return;
  const sign = sort.direction === "desc" ? "-" : "+";
  const clauses = [`${sign}${sort.field}`];
  if (sort.field !== idField) clauses.push(`+${idField}`);
  appendQuery(url, `sort(${clauses.join(",")})`);
}

function parseFacets(value: unknown): Record<string, FacetBucket[]> {
  if (!value || typeof value !== "object") return {};
  const fields = (value as { facet_fields?: unknown }).facet_fields;
  if (!fields || typeof fields !== "object") return {};
  return Object.fromEntries(
    Object.entries(fields).map(([field, raw]) => {
      if (!Array.isArray(raw) || raw.length % 2 !== 0) {
        throw new DataApiError(
          `Malformed facet response for ${field}.`,
          502,
          "malformed_response",
        );
      }
      const buckets: FacetBucket[] = [];
      for (let index = 0; index < raw.length; index += 2) {
        const value: unknown = raw[index];
        const count: unknown = raw[index + 1];
        if (
          (typeof value !== "string" &&
            typeof value !== "number" &&
            typeof value !== "boolean") ||
          typeof count !== "number" ||
          !Number.isFinite(count) ||
          count < 0
        ) {
          throw new DataApiError(
            `Malformed facet response for ${field}.`,
            502,
            "malformed_response",
          );
        }
        buckets.push({ value, count });
      }
      return [field, buckets];
    }),
  );
}

function upstreamMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === "object") {
    const value = payload as { error?: unknown; message?: unknown };
    const nestedError =
      value.error && typeof value.error === "object"
        ? (value.error as { message?: unknown; msg?: unknown })
        : undefined;
    const message =
      typeof value.message === "string"
        ? value.message
        : typeof value.error === "string"
          ? value.error
          : typeof nestedError?.message === "string"
            ? nestedError.message
            : typeof nestedError?.msg === "string"
              ? nestedError.msg
              : undefined;
    if (message) return message.replace(/\s+/g, " ").slice(0, 500);
  }
  return `Data service request failed with status ${String(status)}.`;
}

function normalizeRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") {
    // A successful response whose body is `null`, a bare string/number/
    // boolean, or unparseable JSON (the request layer maps a JSON parse
    // failure to `null`) is an upstream protocol failure, not an empty
    // result — surface it instead of caching/rendering a fake "no results".
    throw new DataApiError(
      "Malformed data service response.",
      502,
      "malformed_response",
    );
  }
  const object = payload as {
    response?: unknown;
    items?: unknown;
    rows?: unknown;
  };
  if (Array.isArray(object.response)) return object.response;
  if (object.response && typeof object.response === "object") {
    const docs = (object.response as { docs?: unknown }).docs;
    if (Array.isArray(docs)) return docs;
  }
  if (Array.isArray(object.items)) return object.items;
  if (Array.isArray(object.rows)) return object.rows;
  throw new DataApiError(
    "Malformed data service response.",
    502,
    "malformed_response",
  );
}

export class ServerDataRepository {
  private readonly fetcher: typeof fetch;

  constructor(private readonly options: RepositoryOptions) {
    this.fetcher = options.fetch ?? fetch;
  }

  async execute(
    resource: DataResource,
    request: DataApiRequest,
    signal?: AbortSignal,
  ): Promise<
    | CollectionResult<Record<string, unknown>>
    | MemberResult<Record<string, unknown>>
    | RowsResult<Record<string, unknown>>
  > {
    if (request.operation === "collection")
      return this.collection(resource, request, signal);
    if (request.operation === "member")
      return this.member(resource, request, signal);
    if (request.operation === "selected") {
      return this.rows(
        resource,
        request.ids,
        request.fields,
        request.ids.length,
        undefined,
        signal,
      );
    }
    return this.export(resource, request, signal);
  }

  async collection(
    resource: DataResource,
    request: CollectionRequest,
    signal?: AbortSignal,
  ): Promise<CollectionResult<Record<string, unknown>>> {
    const definition = getResourceDefinition(resource);
    const size = request.pageSize ?? defaultPageSize;
    const page = request.page ?? 1;
    const start = (page - 1) * size;
    const url = this.url(resource);
    addPredicate(url, request, resource);
    const projectLocally = addFields(url, request.fields, definition.idField);
    addSort(url, request.sort, definition.idField);
    if (request.facets?.length)
      appendQuery(
        url,
        `facet(${request.facets.join(",")},(mincount,1),(limit,100))`,
      );
    const payload = await this.request(
      url,
      start,
      start + size,
      signal,
      "application/solr+json",
    );
    const object =
      payload && typeof payload === "object"
        ? (payload as Record<string, unknown>)
        : {};
    const response =
      object.response &&
      typeof object.response === "object" &&
      !Array.isArray(object.response)
        ? (object.response as Record<string, unknown>)
        : {};
    const total = Number(
      response.numFound ?? object.numFound ?? normalizeRows(payload).length,
    );
    if (!Number.isFinite(total) || total < 0)
      throw new DataApiError(
        "Malformed data service count.",
        502,
        "malformed_response",
      );
    const rows = this.parseRows(resource, normalizeRows(payload));
    return {
      rows: projectRows(
        rows,
        request.fields,
        definition.idField,
        projectLocally,
      ),
      total,
      facets: parseFacets(object.facet_counts),
      page,
      pageSize: size,
    };
  }

  async member(
    resource: DataResource,
    request: MemberRequest,
    signal?: AbortSignal,
  ): Promise<MemberResult<Record<string, unknown>>> {
    const definition = getResourceDefinition(resource);
    const idField = request.idField ?? definition.idField;
    if (!definition.identifierFields.includes(idField))
      throw new DataApiValidationError(
        `Field ${idField} cannot identify ${resource}.`,
      );
    const url = this.url(resource);
    appendQuery(url, eq(resource, idField, request.id));
    const projectLocally = addFields(url, request.fields, definition.idField);
    const payload = await this.request(url, 0, 2, signal, "application/json");
    const parsedRows = this.parseRows(resource, normalizeRows(payload));
    const rows = projectRows(
      parsedRows,
      request.fields,
      definition.idField,
      projectLocally,
    );
    if (rows.length > 1)
      throw new DataApiError(
        `Multiple ${resource} records matched ${idField}.`,
        409,
        "ambiguous_member",
      );
    return { row: rows[0] ?? null };
  }

  async export(
    resource: DataResource,
    request: Extract<DataApiRequest, { operation: "export" }>,
    signal?: AbortSignal,
  ): Promise<RowsResult<Record<string, unknown>>> {
    const definition = getResourceDefinition(resource);
    const url = this.url(resource);
    addPredicate(url, request, resource);
    const projectLocally = addFields(url, request.fields, definition.idField);
    addSort(url, request.sort, definition.idField);
    const offset = request.offset ?? 0;
    const payload = await this.request(
      url,
      offset,
      offset + request.limit,
      signal,
      "application/json",
    );
    const rows = this.parseRows(resource, normalizeRows(payload));
    return {
      rows: projectRows(
        rows,
        request.fields,
        definition.idField,
        projectLocally,
      ),
    };
  }

  private async rows(
    resource: DataResource,
    ids: string[],
    fields: string[] | undefined,
    limit: number,
    sort: DataSort | undefined,
    signal?: AbortSignal,
  ): Promise<RowsResult<Record<string, unknown>>> {
    const definition = getResourceDefinition(resource);
    const url = this.url(resource);
    const predicate = serializeRql(resource, {
      operator: "in",
      field: definition.idField,
      values: ids,
    });
    const projectLocally = addFields(url, fields, definition.idField);
    addSort(url, sort, definition.idField);
    const payload = await this.request(
      url,
      0,
      limit,
      signal,
      "application/json",
      "POST",
      predicate,
    );
    const rows = this.parseRows(resource, normalizeRows(payload));
    return {
      rows: projectRows(rows, fields, definition.idField, projectLocally),
    };
  }

  /**
   * Ranged read whose *response headers* the caller needs, with rows validated
   * by the resource schema. The generic operations above expose only a parsed
   * body, because their contract is entirely in the body; the Taxa Tree's is
   * not — it pages on `Content-Range`.
   *
   * `clause` is appended to the query verbatim and does NOT pass through
   * `validateRql`, so every caller must build it from values it has already
   * validated server-side. Its only caller today is `./taxonomy-tree.ts`,
   * whose two clauses are built from positive integers that
   * `/api/taxonomy-tree/[operation]` parsed with a digits-only pattern.
   *
   * `start`/`end` go straight into the `Range`/`X-Range` headers, so the
   * caller owns its own window — including the upstream's *exclusive* range
   * end, the same convention `collection` relies on when it asks for
   * `start+size` to get `size` rows. This method knows no row limit of its
   * own and therefore shares none with `collection` (`pageSize`) or `export`
   * (`maxExportRows`).
   */
  async rangedRows(
    resource: DataResource,
    clause: string,
    start: number,
    end: number,
    signal?: AbortSignal,
  ): Promise<{ rows: Record<string, unknown>[]; headers: Headers }> {
    const url = this.url(resource);
    appendQuery(url, clause);
    const { payload, headers } = await this.requestWithHeaders(
      url,
      start,
      end,
      signal,
      "application/json",
    );
    return { rows: this.parseRows(resource, normalizeRows(payload)), headers };
  }

  /**
   * Ranged read for a query whose answer is entirely in the response headers
   * and whose body the caller does not read — a facet-only request. The body
   * is still consumed, because an error response carries its message there,
   * but it is neither normalized nor schema-validated: a facet request asks
   * for the narrowest range there is, so whatever row the upstream happens to
   * include is incidental and must not be able to fail the request.
   *
   * Same `clause` contract as {@link rangedRows}.
   */
  async rangedHeaders(
    resource: DataResource,
    clause: string,
    start: number,
    end: number,
    signal?: AbortSignal,
  ): Promise<Headers> {
    const url = this.url(resource);
    appendQuery(url, clause);
    const { headers } = await this.requestWithHeaders(
      url,
      start,
      end,
      signal,
      "application/json",
    );
    return headers;
  }

  private url(resource: DataResource): URL {
    const base = this.options.baseUrl.replace(/\/$/, "");
    return new URL(`${base}/${resource}/`);
  }

  private async request(
    url: URL,
    start: number,
    end: number,
    signal: AbortSignal | undefined,
    accept: string,
    method = "GET",
    body?: string,
  ): Promise<unknown> {
    const { payload } = await this.requestWithHeaders(
      url,
      start,
      end,
      signal,
      accept,
      method,
      body,
    );
    return payload;
  }

  private async requestWithHeaders(
    url: URL,
    start: number,
    end: number,
    signal: AbortSignal | undefined,
    accept: string,
    method = "GET",
    body?: string,
  ): Promise<{ payload: unknown; headers: Headers }> {
    if (this.options.token && url.protocol !== "https:") {
      throw new DataApiError(
        "Authenticated data service requests require HTTPS.",
        500,
        "insecure_upstream",
      );
    }
    const headers = new Headers({
      Accept: accept,
      Range: `items=${String(start)}-${String(end)}`,
      "X-Range": `items=${String(start)}-${String(end)}`,
    });
    if (this.options.token) headers.set("Authorization", this.options.token);
    if (body)
      headers.set("Content-Type", "application/rqlquery+x-www-form-urlencoded");
    const response = await this.fetcher(url, {
      method,
      headers,
      body,
      signal,
      ...(this.options.token ? { redirect: "error" as const } : {}),
      cache: this.options.cache,
      next: this.options.revalidate
        ? { revalidate: this.options.revalidate }
        : undefined,
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message = upstreamMessage(payload, response.status);
      const serviceUnavailable =
        response.status === 503 ||
        (response.status >= 500 &&
          /503 service unavailable|no server is available to handle this request/i.test(
            message,
          ));
      const safeStatus = serviceUnavailable
        ? 503
        : [401, 403, 404, 429].includes(response.status)
          ? response.status
          : 502;
      const code =
        safeStatus === 401
          ? "unauthorized"
          : safeStatus === 403
            ? "forbidden"
            : safeStatus === 404
              ? "not_found"
              : safeStatus === 429
                ? "rate_limited"
                : safeStatus === 503
                  ? "service_unavailable"
                  : "upstream_error";
      throw new DataApiError(
        serviceUnavailable
          ? "The data service is temporarily unavailable. Please try again."
          : message,
        safeStatus,
        code,
      );
    }
    return { payload, headers: response.headers };
  }

  private parseRows(
    resource: DataResource,
    rows: unknown[],
  ): Record<string, unknown>[] {
    const schema = getResourceDefinition(resource).schema;
    try {
      return z.array(schema).parse(rows);
    } catch (error) {
      const detail =
        error instanceof z.ZodError ? error.issues[0]?.message : undefined;
      throw new DataApiError(
        `Malformed ${resource} response${detail ? `: ${detail}` : "."}`,
        502,
        "malformed_response",
      );
    }
  }
}
