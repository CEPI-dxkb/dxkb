/**
 * Low-level JSON-RPC helper used by the HTTP workspace adapter. Handles only
 * transport — envelope construction, HTTP errors, and unwrapping
 * `{ result, error }`. Method-specific response parsing lives in `./parsers.ts`.
 */

import { WorkspaceApiError } from "../domain";

export interface RpcOptions {
  /** Endpoint, default "/api/services/workspace". */
  baseUrl?: string;
  /** When true, do not log errors. */
  silent?: boolean;
}

export interface RpcRequestInit extends RpcOptions {
  method: string;
  params: unknown[];
  /** Some write-only Workspace methods may return a JSON-RPC envelope without `result`. */
  allowMissingResult?: boolean;
}

function getErrorMessage(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const message = (value as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return null;
}

/**
 * Send a JSON-RPC POST and return `result`. Throws `WorkspaceApiError` for
 * HTTP or RPC-level errors. The envelope and headers match the existing
 * `WorkspaceApiClient.makeRequest` shape so the `/api/services/workspace` proxy
 * continues to work unchanged.
 */
export async function rpc<T = unknown>({
  method,
  params,
  baseUrl = "/api/services/workspace",
  silent = false,
  allowMissingResult = false,
}: RpcRequestInit): Promise<T> {
  try {
    const response = await fetch(baseUrl, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: 1, method, params, jsonrpc: "2.0" }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorValue = (errorData as { error?: unknown }).error;
      const apiResponse =
        (errorData as { apiResponse?: unknown }).apiResponse ??
        errorValue ??
        errorData;
      const message =
        getErrorMessage(apiResponse) ||
        getErrorMessage(errorValue) ||
        `HTTP error! status: ${response.status}`;
      throw new WorkspaceApiError(message, method, apiResponse);
    }

    const rawPayload: unknown = await response.json();

    if (typeof rawPayload !== "object" || rawPayload === null || Array.isArray(rawPayload)) {
      throw new WorkspaceApiError(
        "Malformed JSON-RPC response: expected an object",
        method,
        rawPayload,
      );
    }

    const payload = rawPayload as {
      result?: unknown;
      error?: { message?: string; code?: number };
    };

    if (payload.error) {
      throw new WorkspaceApiError(
        payload.error.message ?? "API error",
        method,
        payload.error,
      );
    }

    if (!("result" in payload)) {
      if (allowMissingResult) return null as T;
      throw new WorkspaceApiError(
        "Malformed JSON-RPC response: missing `result` and `error`",
        method,
        payload,
      );
    }

    return payload.result as T;
  } catch (error) {
    if (error instanceof WorkspaceApiError) {
      if (!silent) console.error(`Failed to call ${method}:`, error);
      throw error;
    }
    const apiError = new WorkspaceApiError(
      error instanceof Error ? error.message : String(error),
      method,
      undefined,
    );
    if (!silent) console.error(`Failed to call ${method}:`, apiError);
    throw apiError;
  }
}
