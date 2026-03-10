import { JsonRpcRequest, JsonRpcResponse } from "@/types/workspace";
import { getRequiredEnv } from "./env";

export class JsonRpcClient {
  private static requestId = 1;
  private baseUrl: string;
  private headers: HeadersInit;

  constructor(baseUrl: string, authToken?: string) {
    this.baseUrl = baseUrl;
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

  async call<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
    const request = this.createRequest(method, params);

    try {
      console.log("Making JSON-RPC call:", {
        url: this.baseUrl,
        method,
        headers: this.headers,
        body: request,
      });

      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const jsonResponse: JsonRpcResponse<T> = await response.json();

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
      if (error instanceof JsonRpcError) {
        throw error;
      }
      throw new Error(
        `JSON-RPC call failed: ${error instanceof Error ? error.message : String(error)}`,
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
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(jsonRequests),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const jsonResponses: JsonRpcResponse<T>[] = await response.json();

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
      if (error instanceof JsonRpcError) {
        throw error;
      }
      throw new Error(
        `JSON-RPC batch call failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Update authentication token
  updateAuthToken(token: string): void {
    this.headers = {
      ...this.headers,
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
  return new JsonRpcClient(
    getRequiredEnv("APP_SERVICE_URL"),
    authToken,
  );
}

// Common error codes for better error handling
export const JSON_RPC_ERROR_CODES = {
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
