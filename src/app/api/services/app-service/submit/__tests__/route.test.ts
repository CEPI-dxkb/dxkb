import { mockNextRequest } from "@/test-helpers/api-route-helpers";

vi.mock("@/lib/auth/session", () => ({
  getAuthToken: vi.fn(),
}));

vi.mock("@/lib/app-service", () => ({
  createAppService: vi.fn(),
}));

vi.mock("@/lib/jsonrpc-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/jsonrpc-client")>();
  return {
    ...actual,
    JsonRpcError: actual.JsonRpcError,
    jsonRpcErrorCodes: actual.jsonRpcErrorCodes,
  };
});

import { POST } from "../route";
import { getAuthToken } from "@/lib/auth/session";
import { createAppService } from "@/lib/app-service";

const mockGetAuthToken = vi.mocked(getAuthToken);
const mockCreateAppService = vi.mocked(createAppService);

const mockAppService = {
  submitService: vi.fn(),
};

describe("POST /api/services/app-service/submit", () => {
  beforeEach(() => {
    mockCreateAppService.mockReturnValue(mockAppService as never);
  });

  it("returns 401 when no auth token is available", async () => {
    mockGetAuthToken.mockResolvedValue(undefined);

    const request = mockNextRequest({
      method: "POST",
      body: { app_name: "TestApp", app_params: {} },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual(
      expect.objectContaining({ error: "Authentication required" }),
    );
  });

  it("returns 400 when app_name is missing", async () => {
    mockGetAuthToken.mockResolvedValue("test-token");

    const request = mockNextRequest({
      method: "POST",
      body: { app_params: { output_path: "/test" } },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: "app_name is required" });
  });

  it("returns 400 when app_params is missing", async () => {
    mockGetAuthToken.mockResolvedValue("test-token");

    const request = mockNextRequest({
      method: "POST",
      body: { app_name: "TestApp" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: "app_params must be an object" });
  });

  it("returns 400 when app_params is not an object", async () => {
    mockGetAuthToken.mockResolvedValue("test-token");

    const request = mockNextRequest({
      method: "POST",
      body: { app_name: "TestApp", app_params: "not-an-object" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: "app_params must be an object" });
  });

  it("returns success with job result on valid submission", async () => {
    mockGetAuthToken.mockResolvedValue("test-token");
    const mockResult = { id: "job-123", status: "queued" };
    mockAppService.submitService.mockResolvedValue(mockResult);

    const request = mockNextRequest({
      method: "POST",
      body: {
        app_name: "GenomeAssembly2",
        app_params: { output_path: "/user/output" },
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true, job: mockResult });
  });

  it("passes context to submitService when provided", async () => {
    mockGetAuthToken.mockResolvedValue("test-token");
    mockAppService.submitService.mockResolvedValue({ id: "job-456" });

    const context = { workspace: "/user@bvbrc/home" };
    const request = mockNextRequest({
      method: "POST",
      body: {
        app_name: "BLAST",
        app_params: { query: "ATCG" },
        context,
      },
    });

    await POST(request);

    expect(mockAppService.submitService).toHaveBeenCalledWith({
      app_name: "BLAST",
      app_params: { query: "ATCG" },
      context,
    });
  });

  it("returns 500 with error message when a JsonRpcError is thrown", async () => {
    mockGetAuthToken.mockResolvedValue("test-token");

    const { JsonRpcError } = await import("@/lib/jsonrpc-client");
    mockAppService.submitService.mockRejectedValue(
      new JsonRpcError("RPC failed", -32603, { detail: "server crash" }),
    );

    const request = mockNextRequest({
      method: "POST",
      body: { app_name: "TestApp", app_params: { x: 1 } },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual(
      expect.objectContaining({
        error: "RPC failed",
        code: "upstream",
        details: { detail: "server crash" },
      }),
    );
  });

  it("returns 500 with message when a generic Error is thrown", async () => {
    mockGetAuthToken.mockResolvedValue("test-token");
    mockAppService.submitService.mockRejectedValue(
      new Error("Connection refused"),
    );

    const request = mockNextRequest({
      method: "POST",
      body: { app_name: "TestApp", app_params: { x: 1 } },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual(
      expect.objectContaining({ error: "Connection refused" }),
    );
  });

  it("returns 500 with generic message for unknown error types", async () => {
    mockGetAuthToken.mockResolvedValue("test-token");
    mockAppService.submitService.mockRejectedValue("string error");

    const request = mockNextRequest({
      method: "POST",
      body: { app_name: "TestApp", app_params: { x: 1 } },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual(
      expect.objectContaining({ error: "Unknown error", code: "unknown" }),
    );
  });
});
