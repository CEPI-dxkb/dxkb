import { z } from "zod";
import {
  describeUpstreamFailure,
  describeUpstreamResponse,
  fetchUpstream,
  isHtmlBody,
  summarizeUpstreamBody,
  upstreamServices,
  upstreamTimeoutMs,
} from "@/lib/api/upstream-failure";
import {
  downloadFormats,
  downloadUnavailableReason,
  emptyDownloadMessage,
  maxQueryDownloadRows,
  maxSelectionDownloadRows,
  queryDownloadRowLimit,
  sequenceDownloadFor,
  unselectableFields,
  type DownloadFormatId,
  type DownloadQuery,
  type DownloadRequest,
} from "./downloads";
import {
  fastaAcceptTypes,
  type FastaRequest,
  type FastaResource,
} from "./fasta";
import { DataApiValidationError, getResourceDefinition } from "./resources";
import {
  eq,
  keywordClauses,
  serializeInClause,
  serializeRql,
} from "./rql";
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
import { sortKeys } from "./types";
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
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "DataApiError";
  }
}

const dataService = upstreamServices.dataApi;

export interface DataApiMultiQuery {
  dataType: string;
  accept: string;
  query: string;
}

/**
 * Keeps the `UpstreamError` as `cause` so the route log shows its host; other
 * errors, including a caller's `AbortError`, pass through.
 */
function dataApiFailure(
  error: unknown,
  timeoutMs: number = upstreamTimeoutMs.dataApi,
): unknown {
  const failure = describeUpstreamFailure(error, dataService, { timeoutMs });
  if (!failure) return error;
  return new DataApiError(failure.message, failure.status, failure.code, {
    cause: error,
  });
}

const resourceTimeoutMs: Partial<Record<DataResource, number>> = {
  genome_amr: upstreamTimeoutMs.dataApiGenomeAmr,
  genome_feature: upstreamTimeoutMs.dataApiGenomeFeature,
};

interface Endpoint {
  url: URL;
  timeoutMs: number;
}

function quotedHtmlPage(message: string): string {
  const start = message.search(/<(html|head|body|title|h1)\b/i);
  return start === -1 ? "" : message.slice(start);
}

function appendQuery(url: URL, clause: string): void {
  url.search = url.search ? `${url.search.slice(1)}&${clause}` : clause;
}

function predicateClause(request: DownloadQuery): string | undefined {
  const clauses: string[] = [];
  if (request.rql) clauses.push(request.rql);
  if (request.keyword) {
    const expressions = keywordClauses(request.keyword, request.keywordMode);
    if (expressions.length === 1) clauses.push(expressions[0]);
    else if (expressions.length > 1)
      clauses.push(`and(${expressions.join(",")})`);
  }
  if (clauses.length === 0) return undefined;
  return clauses.length === 1 ? clauses[0] : `and(${clauses.join(",")})`;
}

function addPredicate(url: URL, request: DownloadQuery): void {
  const clause = predicateClause(request);
  if (clause) appendQuery(url, clause);
}

function addFields(
  url: URL,
  fields: string[] | undefined,
  idField: string,
): boolean {
  if (!fields?.length) return false;
  // The upstream RQL parser misreads identifiers such as `1_pb2` in select();
  // omit the projection and project locally.
  if (unselectableFields(fields).length > 0) return true;
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

/**
 * Re-emits the bytes read to detect emptiness, so the stream is otherwise
 * unchanged.
 */
async function nonEmptyBody(
  body: ReadableStream<Uint8Array> | null,
): Promise<ReadableStream<Uint8Array> | null> {
  if (!body) return null;
  const reader = body.getReader();
  let first = await reader.read();
  while (!first.done && first.value.byteLength === 0)
    first = await reader.read();
  if (first.done) return null;
  const head = first.value;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(head);
    },
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) controller.close();
      else controller.enqueue(value);
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

function sortClause(sort: DataSort, idField: string): string {
  const keys = sortKeys(sort);
  const clauses = keys.map(
    (key) => `${key.direction === "desc" ? "-" : "+"}${key.field}`,
  );
  if (!keys.some((key) => key.field === idField)) clauses.push(`+${idField}`);
  return `sort(${clauses.join(",")})`;
}

function addSort(url: URL, sort: DataSort | undefined, idField: string): void {
  if (sort) appendQuery(url, sortClause(sort, idField));
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
    // A null, primitive or unparseable body is an upstream protocol failure,
    // not an empty result.
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

  /**
   * Facets are counted in parallel because the upstream counts one request's
   * fields serially; the rows ride with the first facet.
   */
  async collection(
    resource: DataResource,
    request: CollectionRequest,
    signal?: AbortSignal,
  ): Promise<CollectionResult<Record<string, unknown>>> {
    const facetFields = [...new Set(request.facets ?? [])];
    const [first, ...rest] = facetFields;
    if (rest.length === 0)
      return this.collectionRead(
        resource,
        { ...request, facets: facetFields },
        signal,
      );
    const { idField } = getResourceDefinition(resource);
    const [main, ...counts] = await Promise.all([
      this.collectionRead(resource, { ...request, facets: [first] }, signal),
      ...rest.map((field) =>
        this.collectionRead(
          resource,
          {
            operation: "collection",
            rql: request.rql,
            keyword: request.keyword,
            keywordMode: request.keywordMode,
            pageSize: 1,
            fields: [idField],
            facets: [field],
          },
          signal,
        ),
      ),
    ]);
    const facets = { ...main.facets };
    for (const count of counts) Object.assign(facets, count.facets);
    return { ...main, facets };
  }

  private async collectionRead(
    resource: DataResource,
    request: CollectionRequest,
    signal?: AbortSignal,
  ): Promise<CollectionResult<Record<string, unknown>>> {
    const definition = getResourceDefinition(resource);
    const size = request.pageSize ?? defaultPageSize;
    const page = request.page ?? 1;
    const start = (page - 1) * size;
    const endpoint = this.endpoint(resource);
    const { url } = endpoint;
    addPredicate(url, request);
    const projectLocally = addFields(url, request.fields, definition.idField);
    addSort(url, request.sort, definition.idField);
    if (request.facets?.length)
      appendQuery(
        url,
        `facet(${request.facets.join(",")},(mincount,1),(limit,100))`,
      );
    const payload = await this.request(
      endpoint,
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
    const endpoint = this.endpoint(resource);
    const { url } = endpoint;
    appendQuery(url, eq(resource, idField, request.id));
    const projectLocally = addFields(url, request.fields, definition.idField);
    const payload = await this.request(
      endpoint,
      0,
      2,
      signal,
      "application/json",
    );
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
    const endpoint = this.endpoint(resource);
    const { url } = endpoint;
    addPredicate(url, request);
    const projectLocally = addFields(url, request.fields, definition.idField);
    addSort(url, request.sort, definition.idField);
    const offset = request.offset ?? 0;
    const payload = await this.request(
      endpoint,
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
    const endpoint = this.endpoint(resource);
    const { url } = endpoint;
    const predicate = serializeRql(resource, {
      operator: "in",
      field: definition.idField,
      values: ids,
    });
    const projectLocally = addFields(url, fields, definition.idField);
    addSort(url, sort, definition.idField);
    const payload = await this.request(
      endpoint,
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
   * `clause` is appended verbatim and skips `validateRql`, so callers must
   * build it only from server-validated values.
   * `start`/`end` go into the Range headers unchanged, including the upstream's
   * exclusive range end.
   */
  async rangedRows(
    resource: DataResource,
    clause: string,
    start: number,
    end: number,
    signal?: AbortSignal,
  ): Promise<{ rows: Record<string, unknown>[]; headers: Headers }> {
    const endpoint = this.endpoint(resource);
    const { url } = endpoint;
    appendQuery(url, clause);
    const { payload, headers } = await this.requestWithHeaders(
      endpoint,
      start,
      end,
      signal,
      "application/json",
    );
    return { rows: this.parseRows(resource, normalizeRows(payload)), headers };
  }

  /**
   * Same `clause` contract as `rangedRows`. The body is consumed for error
   * messages but never validated, so an incidental row cannot fail a facet-only
   * request.
   */
  async rangedHeaders(
    resource: DataResource,
    clause: string,
    start: number,
    end: number,
    signal?: AbortSignal,
  ): Promise<Headers> {
    const endpoint = this.endpoint(resource);
    const { url } = endpoint;
    appendQuery(url, clause);
    const { headers } = await this.requestWithHeaders(
      endpoint,
      start,
      end,
      signal,
      "application/json",
    );
    return headers;
  }

  /**
   * Streams the upstream response unbuffered; it can be empty on success, which
   * the caller must interpret.
   * `request` must have passed `validateFastaRequest`.
   */
  async fasta(
    resource: FastaResource,
    request: FastaRequest,
    signal?: AbortSignal,
  ): Promise<ReadableStream<Uint8Array> | null> {
    const definition = getResourceDefinition(resource);
    const predicate = serializeRql(resource, {
      operator: "in",
      field: definition.idField,
      values: request.ids,
    });
    const response = await this.send(
      this.endpoint(resource),
      0,
      request.ids.length,
      signal,
      fastaAcceptTypes[request.type],
      "POST",
      predicate,
      true,
    );
    return response.body;
  }

  /**
   * Streams the upstream response unbuffered. An empty body is a 404, not an
   * empty file, because the native transport saves whatever it is sent.
   * `request` must have passed `validateDownloadRequest`.
   */
  async download(
    resource: DataResource,
    request: DownloadRequest,
    signal?: AbortSignal,
  ): Promise<ReadableStream<Uint8Array>> {
    const format = downloadFormats[request.format];
    const definition = getResourceDefinition(resource);
    const via =
      format.kind === "sequence"
        ? sequenceDownloadFor(resource)?.via
        : undefined;
    if (request.scope.kind === "query")
      await this.recountQueryDownload(
        resource,
        request.format,
        request.scope,
        signal,
      );
    const clauses: string[] = [];
    let target = resource;
    let limit: number;
    if (via) {
      const idLimit = queryDownloadRowLimit(request.format);
      const ids =
        request.scope.kind === "selected"
          ? request.scope.ids
          : (
              await this.export(
                resource,
                {
                  operation: "export",
                  rql: request.scope.rql,
                  keyword: request.scope.keyword,
                  keywordMode: request.scope.keywordMode,
                  fields: [definition.idField],
                  limit: idLimit + 1,
                  sort: request.sort,
                },
                signal,
              )
            ).rows.map((row) => String(row[definition.idField]));
      // The one id past the cap is a query that grew after its recount.
      const overflowReason =
        request.scope.kind === "query" && ids.length > idLimit
          ? downloadUnavailableReason({
              format: request.format,
              scope: "all",
              rows: ids.length,
            })
          : null;
      if (overflowReason)
        throw new DataApiValidationError(
          `${overflowReason} (the query now matches more than ${idLimit.toLocaleString("en-US")} rows).`,
        );
      if (ids.length === 0) {
        throw new DataApiError(
          "No records matched the download.",
          404,
          "not_found",
        );
      }
      target = via.resource;
      clauses.push(
        serializeInClause(via.resource, via.key, ids, maxSelectionDownloadRows),
        `sort(+${via.sort})`,
      );
      limit = maxQueryDownloadRows;
    } else {
      clauses.push(
        request.scope.kind === "selected"
          ? serializeInClause(
              resource,
              definition.idField,
              request.scope.ids,
              maxSelectionDownloadRows,
            )
          : (predicateClause(request.scope) ?? `eq(${definition.idField},*)`),
      );
      // Exactly the visible columns: the primary key JSON reads add would be an
      // extra column in a streamed file.
      if (format.kind === "table" && request.fields?.length) {
        clauses.push(`select(${[...new Set(request.fields)].join(",")})`);
      }
      clauses.push(
        sortClause(
          request.sort ?? { field: definition.idField, direction: "asc" },
          definition.idField,
        ),
      );
      limit =
        request.scope.kind === "selected"
          ? request.scope.ids.length
          : queryDownloadRowLimit(request.format);
    }
    clauses.push(`limit(${String(limit)})`);
    const response = await this.send(
      this.endpoint(target),
      0,
      limit,
      signal,
      format.accept,
      "POST",
      clauses.join("&"),
      true,
    );
    const body = await nonEmptyBody(response.body);
    if (!body)
      throw new DataApiError(
        emptyDownloadMessage(request.format),
        404,
        "not_found",
      );
    return body;
  }

  /**
   * Refuses a query that grew past a cap since `request.total` was checked.
   * The read that follows asks for the format's whole cap, so later additions
   * are not cut.
   */
  private async recountQueryDownload(
    resource: DataResource,
    format: DownloadFormatId,
    query: DownloadQuery,
    signal: AbortSignal | undefined,
  ): Promise<void> {
    const { total } = await this.collection(
      resource,
      {
        operation: "collection",
        rql: query.rql,
        keyword: query.keyword,
        keywordMode: query.keywordMode,
        fields: [getResourceDefinition(resource).idField],
        pageSize: 1,
      },
      signal,
    );
    if (total === 0)
      throw new DataApiError(
        "No records matched the download.",
        404,
        "not_found",
      );
    const reason = downloadUnavailableReason({
      format,
      scope: "all",
      rows: total,
    });
    if (reason)
      throw new DataApiValidationError(
        `${reason} (the query now matches ${total.toLocaleString("en-US")} rows).`,
      );
  }

  async multiQuery(
    queries: Readonly<Record<string, DataApiMultiQuery>>,
    signal?: AbortSignal,
  ): Promise<Record<string, unknown>> {
    const base = this.options.baseUrl.replace(/\/$/, "");
    const response = await this.send(
      {
        url: new URL(`${base}/query/`),
        timeoutMs: upstreamTimeoutMs.dataApi,
      },
      0,
      0,
      signal,
      "application/json",
      "POST",
      JSON.stringify(queries),
      false,
      "application/json",
    );
    const payload: unknown = await response.json().catch((error: unknown) => {
      const failure = dataApiFailure(error);
      if (failure instanceof DataApiError) throw failure;
      if (error instanceof Error && error.name === "AbortError") throw error;
      return null;
    });
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new DataApiError(
        "Malformed search response: expected an object keyed by data type.",
        502,
        "malformed_response",
      );
    }
    return payload as Record<string, unknown>;
  }

  private endpoint(resource: DataResource): Endpoint {
    const base = this.options.baseUrl.replace(/\/$/, "");
    return {
      url: new URL(`${base}/${resource}/`),
      timeoutMs: resourceTimeoutMs[resource] ?? upstreamTimeoutMs.dataApi,
    };
  }

  private async request(
    endpoint: Endpoint,
    start: number,
    end: number,
    signal: AbortSignal | undefined,
    accept: string,
    method = "GET",
    body?: string,
  ): Promise<unknown> {
    const { payload } = await this.requestWithHeaders(
      endpoint,
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
    endpoint: Endpoint,
    start: number,
    end: number,
    signal: AbortSignal | undefined,
    accept: string,
    method = "GET",
    body?: string,
  ): Promise<{ payload: unknown; headers: Headers }> {
    const response = await this.send(
      endpoint,
      start,
      end,
      signal,
      accept,
      method,
      body,
    );
    // A body that stalls past the budget is a timeout, not malformed JSON.
    const payload: unknown = await response.json().catch((error: unknown) => {
      const failure = dataApiFailure(error, endpoint.timeoutMs);
      if (failure instanceof DataApiError) throw failure;
      if (error instanceof Error && error.name === "AbortError") throw error;
      return null;
    });
    return { payload, headers: response.headers };
  }

  /**
   * Returns the response with its body unread, so JSON reads and FASTA streams
   * share every rule up to body consumption.
   */
  private async send(
    { url, timeoutMs }: Endpoint,
    start: number,
    end: number,
    signal: AbortSignal | undefined,
    accept: string,
    method = "GET",
    body?: string,
    streamBody = false,
    contentType = "application/rqlquery+x-www-form-urlencoded",
  ): Promise<Response> {
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
    if (body) headers.set("Content-Type", contentType);
    let response: Response;
    try {
      response = await fetchUpstream(
        url,
        {
          method,
          headers,
          body,
          signal,
          ...(this.options.token ? { redirect: "error" as const } : {}),
          cache: this.options.cache,
          next: this.options.revalidate
            ? { revalidate: this.options.revalidate }
            : undefined,
        },
        {
          service: dataService,
          timeoutMs,
          // Downloads stream unread and may outlast any budget; JSON reads are
          // bounded through the body.
          streamBody,
          fetcher: this.fetcher,
        },
      );
    } catch (error) {
      throw dataApiFailure(error, timeoutMs);
    }
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      let payload: unknown = null;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        // non-JSON body
      }
      // A plain-text body stays unread because it can carry upstream internals.
      const contentType = response.headers.get("content-type");
      const detail =
        payload === null && isHtmlBody(text, contentType)
          ? summarizeUpstreamBody(text, contentType)
          : "";
      const upstreamText =
        payload === null && detail
          ? `Data service request failed with status ${String(response.status)}: ${detail}.`
          : upstreamMessage(payload, response.status);
      const serviceUnavailable =
        response.status === 503 ||
        (response.status >= 500 &&
          /503 service unavailable|no server is available to handle this request/i.test(
            upstreamText,
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
      // A 5xx with the service's own JSON error keeps that message; otherwise
      // only an HTML page's title and heading are summarized.
      const isOutage =
        serviceUnavailable || (payload === null && response.status >= 500);
      const message = isOutage
        ? describeUpstreamResponse(
            response,
            payload === null ? (detail ? text : "") : quotedHtmlPage(upstreamText),
            dataService,
          ).message
        : upstreamText;
      throw new DataApiError(
        message,
        safeStatus,
        code,
      );
    }
    return response;
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
