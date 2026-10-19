import { JsonRpcRequest, JsonRpcResponse } from "@/types/workspace";
import {
  describeUpstreamFailure,
  fetchUpstream,
  upstreamResponseError,
  UpstreamError,
  upstreamServices,
  upstreamTimeoutMs,
} from "@/lib/api/upstream-failure";
import { getRequiredEnv } from "./env";

export interface JsonRpcClientOptions {
  /** Lower-case service phrase for failure messages: "the BV-BRC job service". */
  service?: string;
  /** Budget for one round trip, body included. */
  timeoutMs?: number;
}

function rpcErrorOf(
  envelope: unknown,
): { message: string; code: number; data?: unknown } | null {
  const entries = Array.isArray(envelope) ? envelope : [envelope];
  for (const entry of entries) {
    const error: unknown =
      entry && typeof entry === "object"
        ? (entry as { error?: unknown }).error
        : undefined;
    if (!error || typeof error !== "object") continue;
    const { message, code, data } = error as {
      message?: unknown;
      code?: unknown;
      data?: unknown;
    };
    if (typeof message !== "string" || !message.trim()) continue;
    return {
      message,
      code: typeof code === "number" ? code : jsonRpcErrorCodes.INTERNAL_ERROR,
      data,
    };
  }
  return null;
}

export class JsonRpcClient {
  private static requestId = 1;
  private baseUrl: string;
  private headers: HeadersInit;
  private readonly service: string;
  private readonly timeoutMs: number;

  constructor(
    baseUrl: string,
    authToken?: string,
    options: JsonRpcClientOptions = {},
  ) {
    this.baseUrl = baseUrl;
    this.service = options.service ?? "the JSON-RPC service";
    this.timeoutMs = options.timeoutMs ?? upstreamTimeoutMs.jobService;
    this.headers = {
      "Content-Type": "application/json",
      ...(authToken && {
        // Authorization: authToken.startsWith("Bearer ") ? authToken : `Bearer ${authToken}`
        Authorization: authToken,
      }),
    };
  }

  private getNextRequestId(): number {
    return JsonRpcClient.requestId++;
  }

  private createRequest(method: string, params: unknown[]): JsonRpcRequest {
    return {
      id: this.getNextRequestId(),
      method,
      params,
      jsonrpc: "2.0",
    };
  }

  /**
   * One POST to the service, returning its parsed body. A BV-BRC JSON-RPC
   * server reports an application error as an HTTP 500 carrying a JSON-RPC
   * `error`, so a non-2xx body is read for one before the status is: the
   * server's own message is a `JsonRpcError`, anything else (an HTML error
   * page) an `UpstreamError` describing the status and page title. Network
   * failures and a spent budget are `UpstreamError`s from `fetchUpstream`.
   */
  private async post(body: unknown): Promise<unknown> {
    const response = await fetchUpstream(
      this.baseUrl,
      { method: "POST", headers: this.headers, body: JSON.stringify(body) },
      { service: this.service, timeoutMs: this.timeoutMs },
    );

    if (!response.ok) {
      const text = await response
        .clone()
        .text()
        .catch(() => "");
      let envelope: unknown = null;
      try {
        envelope = text ? JSON.parse(text) : null;
      } catch {
        // Not JSON: described from the status and page below.
      }
      const rpcError = rpcErrorOf(envelope);
      if (rpcError) {
        throw new JsonRpcError(rpcError.message, rpcError.code, rpcError.data);
      }
      throw await upstreamResponseError(response, this.service);
    }

    return response.json().catch((error: unknown) => {
      const failure = describeUpstreamFailure(error, this.service, {
        timeoutMs: this.timeoutMs,
      });
      throw failure ? new UpstreamError(failure, { cause: error }) : error;
    });
  }

  async call<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
    const request = this.createRequest(method, params);

    try {
      // Never log the request here: the headers carry the user's
      // Authorization token and the params can hold job inputs.
      const jsonResponse = (await this.post(request)) as JsonRpcResponse<T>;

      if (jsonResponse.error) {
        throw new JsonRpcError(
          jsonResponse.error.message,
          jsonResponse.error.code,
          jsonResponse.error.data,
        );
      }

      if (jsonResponse.result === undefined) {
        throw new Error("No result or error in JSON-RPC response");
      }

      return jsonResponse.result;
    } catch (error) {
      if (error instanceof JsonRpcError || error instanceof UpstreamError) {
        throw error;
      }
      throw new Error(
        `JSON-RPC call failed: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
  }

  // Batch requests (if needed in the future)
  async batch<T = unknown>(
    requests: { method: string; params: unknown[] }[],
  ): Promise<T[]> {
    const jsonRequests = requests.map((req) =>
      this.createRequest(req.method, req.params),
    );

    try {
      const jsonResponses = (await this.post(
        jsonRequests,
      )) as JsonRpcResponse<T>[];

      return jsonResponses.map((jsonResponse) => {
        if (jsonResponse.error) {
          throw new JsonRpcError(
            jsonResponse.error.message,
            jsonResponse.error.code,
            jsonResponse.error.data,
          );
        }

        if (jsonResponse.result === undefined) {
          throw new Error("No result or error in JSON-RPC response");
        }

        return jsonResponse.result;
      });
    } catch (error) {
      if (error instanceof JsonRpcError || error instanceof UpstreamError) {
        throw error;
      }
      throw new Error(
        `JSON-RPC batch call failed: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
  }

  // Update authentication token
  updateAuthToken(token: string): void {
    this.headers = {
      ...(this.headers as Record<string, string>),
      Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}`,
    };
  }

  // Remove authentication token
  removeAuthToken(): void {
    const { Authorization: _Authorization, ...headersWithoutAuth } = this.headers as Record<string, string>;
    this.headers = headersWithoutAuth;
  }

  // Get authentication token
  getAuthToken(): string | undefined {
    return (this.headers as Record<string, string>).Authorization;
  }
}

export class JsonRpcError extends Error {
  code: number;
  data?: unknown;

  constructor(message: string, code: number, data?: unknown) {
    super(message);
    this.name = "JsonRpcError";
    this.code = code;
    this.data = data;
  }
}

// Factory function for creating BV-BRC API client
export function createBvBrcClient(authToken?: string): JsonRpcClient {
  return new JsonRpcClient(getRequiredEnv("APP_SERVICE_URL"), authToken, {
    service: upstreamServices.jobService,
    timeoutMs: upstreamTimeoutMs.jobService,
  });
}

// Common error codes for better error handling
export const jsonRpcErrorCodes = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  // Custom application error codes
  UNAUTHORIZED: -32001,
  FORBIDDEN: -32002,
  NOT_FOUND: -32003,
  VALIDATION_ERROR: -32004,
} as const;
