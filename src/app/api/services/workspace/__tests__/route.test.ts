import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { POST } from "../route";
import { json, mockNextRequest } from "@/test-helpers/api-route-helpers";

vi.mock("@/lib/auth/session", () => ({ getAuthToken: vi.fn() }));
vi.mock("@/lib/env", () => ({
  getRequiredEnv: vi.fn(() => "http://mock-workspace-api"),
}));

import { getAuthToken } from "@/lib/auth/session";
const mockGetToken = vi.mocked(getAuthToken);

describe("POST /api/services/workspace", () => {
  it("returns 401 when no auth token", async () => {
    mockGetToken.mockResolvedValue(undefined);

    const req = mockNextRequest({
      method: "POST",
      body: { method: "Workspace.ls", params: [] },
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
    expect(await json(res)).toEqual(
      expect.objectContaining({ error: "Authentication required" }),
    );
  });

  it("returns 400 when method is missing", async () => {
    mockGetToken.mockResolvedValue("token");

    const req = mockNextRequest({
      method: "POST",
      body: { params: [] },
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(await json(res)).toEqual(
      expect.objectContaining({ error: "method is required" }),
    );
  });

  it("wraps request in JSON-RPC 2.0 envelope", async () => {
    mockGetToken.mockResolvedValue("token");

    const rpcResult = { id: 1, result: [[]], jsonrpc: "2.0" };
    let capturedBody: unknown;
    server.use(
      http.post("http://mock-workspace-api", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(rpcResult);
      }),
    );

    const req = mockNextRequest({
      method: "POST",
      body: { method: "Workspace.ls", params: [{ paths: ["/user/"] }] },
    });
    await POST(req);

    expect(capturedBody).toEqual(
      expect.objectContaining({
        id: 1,
        method: "Workspace.ls",
        params: [{ paths: ["/user/"] }],
        jsonrpc: "2.0",
      }),
    );
  });

  it("sends Authorization header with auth token", async () => {
    mockGetToken.mockResolvedValue("my-auth-token");

    let capturedHeaders: Headers | undefined;
    server.use(
      http.post("http://mock-workspace-api", async ({ request }) => {
        capturedHeaders = request.headers;
        return HttpResponse.json({ id: 1, result: [], jsonrpc: "2.0" });
      }),
    );

    const req = mockNextRequest({
      method: "POST",
      body: { method: "Workspace.ls", params: [] },
    });
    await POST(req);

    expect(capturedHeaders?.get("Authorization")).toBe("my-auth-token");
  });

  it("returns empty result array for preferences GET 404", async () => {
    mockGetToken.mockResolvedValue("token");

    server.use(
      http.post("http://mock-workspace-api", () => {
        return HttpResponse.text("not found", { status: 404 });
      }),
    );

    const req = mockNextRequest({
      method: "POST",
      body: {
        method: "Workspace.get",
        params: [
          { objects: ["/user@bvbrc/home/.preferences/favorites.json"] },
        ],
      },
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual(
      expect.objectContaining({ result: [], jsonrpc: "2.0" }),
    );
  });

  it("returns error for non-preferences 404", async () => {
    mockGetToken.mockResolvedValue("token");

    server.use(
      http.post("http://mock-workspace-api", () => {
        return HttpResponse.text("not found", { status: 404 });
      }),
    );

    const req = mockNextRequest({
      method: "POST",
      body: {
        method: "Workspace.get",
        params: [{ objects: ["/user/home/some-other-file"] }],
      },
    });
    const res = await POST(req);

    expect(res.status).toBe(404);
    expect(await json(res)).toEqual(
      expect.objectContaining({ error: expect.stringContaining("BV-BRC API error") }),
    );
  });

  it("includes sanitized error in response for upstream errors", async () => {
    mockGetToken.mockResolvedValue("token");

    const upstreamError = {
      error: { code: -32600, message: "Invalid Request" },
    };
    server.use(
      http.post("http://mock-workspace-api", () => {
        return HttpResponse.json(upstreamError, {
          status: 500,
          statusText: "Internal Server Error",
        });
      }),
    );

    const req = mockNextRequest({
      method: "POST",
      body: { method: "Workspace.ls", params: [] },
    });
    const res = await POST(req);

    expect(res.status).toBe(500);
    const body = await json(res);
    expect(body.apiResponse).toEqual(
      expect.objectContaining({ code: -32600, message: "Invalid Request" }),
    );
  });

  it("returns data on success", async () => {
    mockGetToken.mockResolvedValue("token");

    const rpcResult = {
      id: 1,
      result: [
        [
          ["file1.txt", "txt", "/user/home/file1.txt"],
        ],
      ],
      jsonrpc: "2.0",
    };
    server.use(
      http.post("http://mock-workspace-api", () => {
        return HttpResponse.json(rpcResult);
      }),
    );

    const req = mockNextRequest({
      method: "POST",
      body: { method: "Workspace.ls", params: [{ paths: ["/user/home/"] }] },
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual(rpcResult);
  });

  it("returns 500 on unexpected exception", async () => {
    mockGetToken.mockResolvedValue("token");

    server.use(
      http.post("http://mock-workspace-api", () => {
        return HttpResponse.error();
      }),
    );

    const req = mockNextRequest({
      method: "POST",
      body: { method: "Workspace.ls", params: [] },
    });
    const res = await POST(req);

    expect(res.status).toBe(500);
    expect(await json(res)).toEqual(
      expect.objectContaining({ error: "Internal server error" }),
    );
  });
});
