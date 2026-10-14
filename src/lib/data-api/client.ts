import {
  fastaContentType,
  maxFastaIds,
  type FastaRequest,
  type FastaResource,
} from "./fasta";
import { maxExportRows } from "./types";
import type {
  CollectionRequest,
  CollectionResult,
  DataResource,
  ExportRequest,
  MemberRequest,
  MemberResult,
  RowsResult,
  SelectedRequest,
} from "./types";

export class DataRepositoryError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "DataRepositoryError";
  }
}

const maxExportRetries = 3;
const defaultRetryDelayMs = 1_000;

function retryDelay(response: Response): number | undefined {
  const header = response.headers.get("Retry-After");
  if (header === null) return undefined;
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1_000 : undefined;
}

function abortError(signal: AbortSignal): Error {
  return signal.reason instanceof Error
    ? signal.reason
    : new DOMException("The operation was aborted.", "AbortError");
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  if (!signal) return new Promise((resolve) => setTimeout(resolve, ms));

  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError(signal));
      return;
    }

    const onAbort = () => {
      clearTimeout(timeout);
      reject(abortError(signal));
    };
    const timeout = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/** The gateway's `{error, code}` body as a `DataRepositoryError`. */
async function responseError(response: Response): Promise<DataRepositoryError> {
  const payload: unknown = await response.json().catch(() => null);
  const body =
    payload && typeof payload === "object"
      ? (payload as { error?: unknown; code?: unknown })
      : {};
  return new DataRepositoryError(
    typeof body.error === "string"
      ? body.error
      : `Data request failed with status ${String(response.status)}.`,
    response.status,
    typeof body.code === "string" ? body.code : "request_failed",
    retryDelay(response),
  );
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) throw await responseError(response);
  return (await response.json().catch(() => null)) as T;
}

function collectionParams(request: CollectionRequest): URLSearchParams {
  const params = new URLSearchParams({ operation: request.operation });
  if (request.rql) params.set("rql", request.rql);
  if (request.keyword) params.set("keyword", request.keyword);
  if (request.keywordMode) params.set("keywordMode", request.keywordMode);
  if (request.page) params.set("page", String(request.page));
  if (request.pageSize) params.set("pageSize", String(request.pageSize));
  if (request.sort)
    params.set("sort", `${request.sort.field}:${request.sort.direction}`);
  for (const field of request.fields ?? []) params.append("field", field);
  for (const facet of request.facets ?? []) params.append("facet", facet);
  return params;
}

export class DataRepository {
  constructor(private readonly basePath = "/api/data") {}

  collection<T extends Record<string, unknown> = Record<string, unknown>>(
    resource: DataResource,
    request: Omit<CollectionRequest, "operation">,
    signal?: AbortSignal,
  ): Promise<CollectionResult<T>> {
    const params = collectionParams({ operation: "collection", ...request });
    return fetch(`${this.basePath}/${resource}?${params}`, {
      credentials: "include",
      signal,
    }).then(parseResponse<CollectionResult<T>>);
  }

  member<T extends Record<string, unknown> = Record<string, unknown>>(
    resource: DataResource,
    request: Omit<MemberRequest, "operation">,
    signal?: AbortSignal,
  ): Promise<MemberResult<T>> {
    const params = new URLSearchParams({ operation: "member", id: request.id });
    if (request.idField) params.set("idField", request.idField);
    for (const field of request.fields ?? []) params.append("field", field);
    return fetch(`${this.basePath}/${resource}?${params}`, {
      credentials: "include",
      signal,
    }).then(parseResponse<MemberResult<T>>);
  }

  selected<T extends Record<string, unknown> = Record<string, unknown>>(
    resource: DataResource,
    request: Omit<SelectedRequest, "operation">,
    signal?: AbortSignal,
  ): Promise<RowsResult<T>> {
    return this.post(resource, { operation: "selected", ...request }, signal);
  }

  export<T extends Record<string, unknown> = Record<string, unknown>>(
    resource: DataResource,
    request: Omit<ExportRequest, "operation">,
    signal?: AbortSignal,
  ): Promise<RowsResult<T>> {
    return this.post(resource, { operation: "export", ...request }, signal);
  }

  async exportAll<
    T extends Record<string, unknown> = Record<string, unknown>,
  >(
    resource: DataResource,
    request: Omit<ExportRequest, "operation" | "limit" | "offset">,
    signal?: AbortSignal,
  ): Promise<RowsResult<T>> {
    let retries = 0;
    for (;;) {
      try {
        return await this.export<T>(
          resource,
          {
            ...request,
            limit: maxExportRows,
            offset: 0,
          },
          signal,
        );
      } catch (error) {
        if (!(error instanceof DataRepositoryError) || error.status !== 429) {
          throw error;
        }
        if (retries >= maxExportRetries) {
          throw error;
        }
        const delay =
          error.retryAfterMs ?? defaultRetryDelayMs * Math.pow(2, retries);
        retries += 1;
        await wait(delay, signal);
      }
    }
  }

  /**
   * FASTA for any number of ids, as one file. Lists longer than
   * `maxFastaIds` go out as consecutive requests (sequential, so a large
   * selection cannot burst through the route's rate limit) and are joined
   * record-aligned. An empty `Blob` means nothing matched or no record had a
   * sequence of this type; the caller decides how to say so.
   */
  async fasta(
    resource: FastaResource,
    request: FastaRequest,
    signal?: AbortSignal,
  ): Promise<Blob> {
    const parts: string[] = [];
    for (let start = 0; start < request.ids.length; start += maxFastaIds) {
      const response = await fetch(`${this.basePath}/${resource}/fasta`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: request.type,
          ids: request.ids.slice(start, start + maxFastaIds),
        }),
        signal,
      });
      if (!response.ok) throw await responseError(response);
      const text = await response.text();
      // A part that does not end in a newline would glue its last sequence
      // line onto the next part's first `>` header.
      if (text) parts.push(text.endsWith("\n") ? text : `${text}\n`);
    }
    return new Blob(parts, { type: fastaContentType });
  }

  private post<T>(
    resource: DataResource,
    body: SelectedRequest | ExportRequest,
    signal?: AbortSignal,
  ): Promise<T> {
    return fetch(`${this.basePath}/${resource}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    }).then(parseResponse<T>);
  }
}
