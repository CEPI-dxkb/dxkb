import { JsonRpcRequest, JsonRpcResponse } from "../types/workspace";

export class JsonRpcClient {
  private static requestId = 1;
  private baseUrl: string;
  private headers: HeadersInit;

  constructor(baseUrl: string, authToken?: string) {
    this.baseUrl = baseUrl;
    this.headers = {
      "Content-Type": "application/json",
      ...(authToken && { Authorization: authToken }),
    };
  }

  private getNextRequestId(): number {
    return JsonRpcClient.requestId++;
  }

  private createRequest(method: string, params: any[]): JsonRpcRequest {
    return {
      id: this.getNextRequestId(),
      method,
      params,
      jsonrpc: "2.0",
    };
  }

  async call<T = any>(method: string, params: any[] = []): Promise<T> {
    const request = this.createRequest(method, params);

    try {
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
  async batch<T = any>(
    requests: Array<{ method: string; params: any[] }>,
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
      Authorization: token,
    };
  }

  // Remove authentication token
  removeAuthToken(): void {
    const { Authorization, ...headersWithoutAuth } = this.headers as any;
    this.headers = headersWithoutAuth;
  }

  // Get authentication token
  getAuthToken(): string | undefined {
    return (this.headers as any).Authorization;
  }
}

export class JsonRpcError extends Error {
  code: number;
  data?: any;

  constructor(message: string, code: number, data?: any) {
    super(message);
    this.name = "JsonRpcError";
    this.code = code;
    this.data = data;
  }
}

// Factory function for creating BV-BRC API client
export function createBvBrcClient(authToken?: string): JsonRpcClient {
  return new JsonRpcClient(
    "https://p3.theseed.org/services/app_service",
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
