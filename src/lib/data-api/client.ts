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

export class DataExportError<
  T extends Record<string, unknown> = Record<string, unknown>,
> extends DataRepositoryError {
  constructor(
    error: DataRepositoryError,
    readonly rows: T[],
    readonly nextOffset: number,
  ) {
    super(error.message, error.status, error.code, error.retryAfterMs);
    this.name = "DataExportError";
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

async function parseResponse<T>(response: Response): Promise<T> {
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const body =
      payload && typeof payload === "object"
        ? (payload as { error?: unknown; code?: unknown })
        : {};
    throw new DataRepositoryError(
      typeof body.error === "string"
        ? body.error
        : `Data request failed with status ${String(response.status)}.`,
      response.status,
      typeof body.code === "string" ? body.code : "request_failed",
      retryDelay(response),
    );
  }
  return payload as T;
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
          throw new DataExportError(error, [], 0);
        }
        const delay =
          error.retryAfterMs ?? defaultRetryDelayMs * Math.pow(2, retries);
        retries += 1;
        await wait(delay, signal);
      }
    }
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
