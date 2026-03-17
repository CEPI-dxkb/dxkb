import { http, HttpResponse } from "msw";

import { server } from "@/test-helpers/msw-server";
import {
  JsonRpcClient,
  JsonRpcError,
  createBvBrcClient,
} from "@/lib/jsonrpc-client";

vi.mock("@/lib/env", () => ({
  getRequiredEnv: vi.fn((key: string) => {
    if (key === "APP_SERVICE_URL") return "https://api.example.com/rpc";
    throw new Error(`Missing required environment variable: ${key}`);
  }),
}));

describe("JsonRpcClient", () => {
  beforeEach(() => {
    // Reset the static requestId to get deterministic ids across tests.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (JsonRpcClient as any).requestId = 1;
  });

  describe("constructor", () => {
    it("sets baseUrl and Content-Type header", () => {
      const client = new JsonRpcClient("https://api.example.com/rpc");
      expect(client["baseUrl"]).toBe("https://api.example.com/rpc");
      expect(client["headers"]).toEqual({
        "Content-Type": "application/json",
      });
    });

    it("includes Authorization header when authToken is provided", () => {
      const client = new JsonRpcClient(
        "https://api.example.com/rpc",
        "my-token",
      );
      expect(client["headers"]).toEqual({
        "Content-Type": "application/json",
        Authorization: "my-token",
      });
    });
  });

  describe("call", () => {
    it("sends POST with correct JSON-RPC 2.0 format", async () => {
      let capturedBody: unknown;

      server.use(
        http.post("https://api.example.com/rpc", async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json({
            id: 1,
            jsonrpc: "2.0",
            result: "ok",
          });
        }),
      );

      const client = new JsonRpcClient("https://api.example.com/rpc");
      await client.call("TestMethod", ["arg1", "arg2"]);

      expect(capturedBody).toEqual({
        id: 1,
        method: "TestMethod",
        params: ["arg1", "arg2"],
        jsonrpc: "2.0",
      });
    });

    it("returns result on success", async () => {
      server.use(
        http.post("https://api.example.com/rpc", () => {
          return HttpResponse.json({
            id: 1,
            jsonrpc: "2.0",
            result: { foo: "bar" },
          });
        }),
      );

      const client = new JsonRpcClient("https://api.example.com/rpc");
      const result = await client.call("TestMethod");

      expect(result).toEqual({ foo: "bar" });
    });

    it("throws JsonRpcError on JSON-RPC error response", async () => {
      server.use(
        http.post("https://api.example.com/rpc", () => {
          return HttpResponse.json({
            id: 1,
            jsonrpc: "2.0",
            error: {
              code: -32601,
              message: "Method not found",
              data: { detail: "unknown method" },
            },
          });
        }),
      );

      const client = new JsonRpcClient("https://api.example.com/rpc");

      await expect(client.call("BadMethod")).rejects.toThrow(JsonRpcError);
      await expect(client.call("BadMethod")).rejects.toMatchObject({
        message: "Method not found",
        code: -32601,
        data: { detail: "unknown method" },
      });
    });

    it("throws Error on HTTP error (non-ok response)", async () => {
      server.use(
        http.post("https://api.example.com/rpc", () => {
          return new HttpResponse(null, { status: 500 });
        }),
      );

      const client = new JsonRpcClient("https://api.example.com/rpc");

      await expect(client.call("TestMethod")).rejects.toThrow(
        "JSON-RPC call failed: HTTP error! status: 500",
      );
    });

    it("throws Error when response has no result or error", async () => {
      server.use(
        http.post("https://api.example.com/rpc", () => {
          return HttpResponse.json({
            id: 1,
            jsonrpc: "2.0",
          });
        }),
      );

      const client = new JsonRpcClient("https://api.example.com/rpc");

      await expect(client.call("TestMethod")).rejects.toThrow(
        "JSON-RPC call failed: No result or error in JSON-RPC response",
      );
    });

    it("uses default empty params when none provided", async () => {
      let capturedBody: unknown;

      server.use(
        http.post("https://api.example.com/rpc", async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json({
            id: 1,
            jsonrpc: "2.0",
            result: "ok",
          });
        }),
      );

      const client = new JsonRpcClient("https://api.example.com/rpc");
      await client.call("TestMethod");

      expect((capturedBody as Record<string, unknown>).params).toEqual([]);
    });
  });

  describe("batch", () => {
    it("sends array of requests and returns array of results", async () => {
      let capturedBody: unknown;

      server.use(
        http.post("https://api.example.com/rpc", async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json([
            { id: 1, jsonrpc: "2.0", result: "result1" },
            { id: 2, jsonrpc: "2.0", result: "result2" },
          ]);
        }),
      );

      const client = new JsonRpcClient("https://api.example.com/rpc");
      const results = await client.batch([
        { method: "Method1", params: ["a"] },
        { method: "Method2", params: ["b"] },
      ]);

      expect(results).toEqual(["result1", "result2"]);

      const body = capturedBody as Record<string, unknown>[];
      expect(body).toHaveLength(2);
      expect(body[0]).toMatchObject({
        method: "Method1",
        params: ["a"],
        jsonrpc: "2.0",
      });
      expect(body[1]).toMatchObject({
        method: "Method2",
        params: ["b"],
        jsonrpc: "2.0",
      });
    });

    it("throws JsonRpcError if any response has error", async () => {
      server.use(
        http.post("https://api.example.com/rpc", () => {
          return HttpResponse.json([
            { id: 1, jsonrpc: "2.0", result: "ok" },
            {
              id: 2,
              jsonrpc: "2.0",
              error: { code: -32600, message: "Invalid request" },
            },
          ]);
        }),
      );

      const client = new JsonRpcClient("https://api.example.com/rpc");

      await expect(
        client.batch([
          { method: "Method1", params: [] },
          { method: "Method2", params: [] },
        ]),
      ).rejects.toThrow(JsonRpcError);
    });

    it("throws Error on HTTP error", async () => {
      server.use(
        http.post("https://api.example.com/rpc", () => {
          return new HttpResponse(null, { status: 502 });
        }),
      );

      const client = new JsonRpcClient("https://api.example.com/rpc");

      await expect(
        client.batch([{ method: "Method1", params: [] }]),
      ).rejects.toThrow("JSON-RPC batch call failed: HTTP error! status: 502");
    });
  });

  describe("updateAuthToken", () => {
    it("adds Bearer prefix if not present", () => {
      const client = new JsonRpcClient("https://api.example.com/rpc");
      client.updateAuthToken("my-token");

      expect(client.getAuthToken()).toBe("Bearer my-token");
    });

    it("keeps Bearer prefix if already present", () => {
      const client = new JsonRpcClient("https://api.example.com/rpc");
      client.updateAuthToken("Bearer existing-token");

      expect(client.getAuthToken()).toBe("Bearer existing-token");
    });
  });

  describe("removeAuthToken", () => {
    it("removes Authorization header", () => {
      const client = new JsonRpcClient(
        "https://api.example.com/rpc",
        "my-token",
      );
      expect(client.getAuthToken()).toBe("my-token");

      client.removeAuthToken();

      expect(client.getAuthToken()).toBeUndefined();
    });
  });

  describe("getAuthToken", () => {
    it("returns current auth token", () => {
      const client = new JsonRpcClient(
        "https://api.example.com/rpc",
        "my-token",
      );
      expect(client.getAuthToken()).toBe("my-token");
    });

    it("returns undefined when no auth token set", () => {
      const client = new JsonRpcClient("https://api.example.com/rpc");
      expect(client.getAuthToken()).toBeUndefined();
    });
  });
});

describe("JsonRpcError", () => {
  it("has correct name, code, and data properties", () => {
    const error = new JsonRpcError("Something went wrong", -32600, {
      detail: "extra",
    });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(JsonRpcError);
    expect(error.name).toBe("JsonRpcError");
    expect(error.message).toBe("Something went wrong");
    expect(error.code).toBe(-32600);
    expect(error.data).toEqual({ detail: "extra" });
  });

  it("sets data to undefined when not provided", () => {
    const error = new JsonRpcError("err", -32700);
    expect(error.data).toBeUndefined();
  });
});

describe("createBvBrcClient", () => {
  it("uses APP_SERVICE_URL env var", () => {
    const client = createBvBrcClient();
    expect(client["baseUrl"]).toBe("https://api.example.com/rpc");
  });

  it("passes authToken to the client", () => {
    const client = createBvBrcClient("test-token");
    expect(client.getAuthToken()).toBe("test-token");
  });
});
