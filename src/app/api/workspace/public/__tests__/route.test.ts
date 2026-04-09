const { mockCookieStore } = vi.hoisted(() => ({
  mockCookieStore: { get: vi.fn(), set: vi.fn() },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { mockNextRequest } from "@/test-helpers/api-route-helpers";
import { POST } from "../route";

const workspaceApiUrl = "http://mock-workspace-api";

beforeEach(() => {
  process.env.WORKSPACE_API_URL = workspaceApiUrl;
  mockCookieStore.get.mockReturnValue(undefined);
});

afterEach(() => {
  delete process.env.WORKSPACE_API_URL;
});

describe("POST /api/workspace/public", () => {
  it("returns 400 when method is missing", async () => {
    const request = mockNextRequest({ method: "POST", body: {} });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("method is required");
  });

  it("returns 403 for disallowed methods", async () => {
    const request = mockNextRequest({
      method: "POST",
      body: { method: "Workspace.delete", params: [] },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("Method not allowed for public access");
  });

  it("allows Workspace.ls and forwards to upstream", async () => {
    const upstreamResult = { jsonrpc: "2.0", id: 1, result: [{ path: "/test" }] };

    server.use(
      http.post(workspaceApiUrl, () => HttpResponse.json(upstreamResult)),
    );

    const request = mockNextRequest({
      method: "POST",
      body: { method: "Workspace.ls", params: [{ paths: ["/"] }] },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(upstreamResult);
  });

  it("allows Workspace.get", async () => {
    server.use(
      http.post(workspaceApiUrl, () =>
        HttpResponse.json({ jsonrpc: "2.0", id: 1, result: [] }),
      ),
    );

    const request = mockNextRequest({
      method: "POST",
      body: { method: "Workspace.get", params: [] },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
  });

  it("does not require authentication", async () => {
    mockCookieStore.get.mockReturnValue(undefined);

    let capturedAuthorization: string | null = null;
    server.use(
      http.post(workspaceApiUrl, ({ request }) => {
        capturedAuthorization = request.headers.get("Authorization");
        return HttpResponse.json({ jsonrpc: "2.0", id: 1, result: [] });
      }),
    );

    const request = mockNextRequest({
      method: "POST",
      body: { method: "Workspace.ls", params: [] },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(capturedAuthorization).toBeNull();
  });

  it("forwards auth token when user is logged in", async () => {
    mockCookieStore.get.mockImplementation((name: string) => {
      if (name === "bvbrc_token") return { value: "user-token" };
      return undefined;
    });

    let capturedAuthorization: string | null = null;
    server.use(
      http.post(workspaceApiUrl, ({ request }) => {
        capturedAuthorization = request.headers.get("Authorization");
        return HttpResponse.json({ jsonrpc: "2.0", id: 1, result: [] });
      }),
    );

    const request = mockNextRequest({
      method: "POST",
      body: { method: "Workspace.ls", params: [] },
    });

    await POST(request);

    expect(capturedAuthorization).toBe("user-token");
  });

  it("returns upstream status on API error", async () => {
    server.use(
      http.post(workspaceApiUrl, () =>
        new HttpResponse("Server Error", { status: 502 }),
      ),
    );

    const request = mockNextRequest({
      method: "POST",
      body: { method: "Workspace.ls", params: [] },
    });

    const response = await POST(request);

    expect(response.status).toBe(502);
  });

  it("returns 500 on network error", async () => {
    server.use(
      http.post(workspaceApiUrl, () => HttpResponse.error()),
    );

    const request = mockNextRequest({
      method: "POST",
      body: { method: "Workspace.ls", params: [] },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Internal server error");
  });
});
