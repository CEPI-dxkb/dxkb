import { ApiCallError, statusToErrorCode } from "./types";

let authRefreshCallback: (() => Promise<void>) | null = null;
let inflightRefresh: Promise<void> | null = null;

export function setAuthRefreshCallback(cb: (() => Promise<void>) | null): void {
  authRefreshCallback = cb;
}

function coalesceRefresh(): Promise<void> {
  if (!authRefreshCallback) return Promise.reject(new Error("No auth refresh callback"));
  if (inflightRefresh) return inflightRefresh;
  inflightRefresh = authRefreshCallback().finally(() => {
    inflightRefresh = null;
  });
  return inflightRefresh;
}

async function parseErrorBody(response: Response): Promise<{
  message: string;
  details?: unknown;
}> {
  try {
    const body = await response.json();
    const message =
      typeof body?.error === "string"
        ? body.error
        : typeof body?.message === "string"
          ? body.message
          : `HTTP ${response.status} ${response.statusText}`;
    return { message, details: body?.details };
  } catch {
    return { message: `HTTP ${response.status} ${response.statusText}` };
  }
}

function throwApiError(
  status: number,
  message: string,
  details?: unknown,
): never {
  throw new ApiCallError({
    message,
    status,
    code: statusToErrorCode(status),
    details,
  });
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.ok) {
    const text = await response.text();
    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as T;
    }
  }

  const { message, details } = await parseErrorBody(response);
  throwApiError(response.status, message, details);
}

async function fetchWithRetry<T>(
  url: string,
  init: RequestInit,
): Promise<T> {
  const response = await fetch(url, init);

  if (response.status === 401 && authRefreshCallback) {
    try {
      await coalesceRefresh();
    } catch {
      // If refresh fails, fall through to handle the original 401
      return handleResponse<T>(response);
    }
    const retryResponse = await fetch(url, init);
    return handleResponse<T>(retryResponse);
  }

  return handleResponse<T>(response);
}

export async function apiCall<T>(
  url: string,
  body: unknown,
  init?: Omit<RequestInit, "method" | "body" | "credentials">,
): Promise<T> {
  return fetchWithRetry<T>(url, {
    ...init,
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    body: JSON.stringify(body),
  });
}

export async function apiGet<T>(
  url: string,
  params?: Record<string, string | number | boolean | undefined>,
  init?: Omit<RequestInit, "method" | "body" | "credentials">,
): Promise<T> {
  let fullUrl = url;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        searchParams.set(key, String(value));
      }
    }
    const qs = searchParams.toString();
    if (qs) fullUrl = `${url}?${qs}`;
  }

  return fetchWithRetry<T>(fullUrl, {
    ...init,
    method: "GET",
    credentials: "include",
  });
}
