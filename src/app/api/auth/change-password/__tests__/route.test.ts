vi.mock("@/lib/auth/session", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  getRequiredEnv: vi.fn(() => "http://mock-user-url"),
}));

import { NextResponse } from "next/server";
import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { mockNextRequest } from "@/test-helpers/api-route-helpers";
import { POST } from "../route";
import { requireAuth } from "@/lib/auth/session";

const mockRequireAuth = vi.mocked(requireAuth);

describe("POST /api/auth/change-password", () => {
  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ message: "Authentication required" }, { status: 401 }),
    );

    const request = mockNextRequest({
      method: "POST",
      body: { currentPassword: "old", newPassword: "new" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.message).toBe("Authentication required");
  });

  it("returns 401 when token is missing", async () => {
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ message: "Authentication required" }, { status: 401 }),
    );

    const request = mockNextRequest({
      method: "POST",
      body: { currentPassword: "old", newPassword: "new" },
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("returns 400 when currentPassword is missing", async () => {
    mockRequireAuth.mockResolvedValue({ token: "the-token", userId: "testuser", realm: "bvbrc" });

    const request = mockNextRequest({
      method: "POST",
      body: { newPassword: "newpass" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe("Current password and new password are required");
  });

  it("returns 400 when newPassword is missing", async () => {
    mockRequireAuth.mockResolvedValue({ token: "the-token", userId: "testuser", realm: "bvbrc" });

    const request = mockNextRequest({
      method: "POST",
      body: { currentPassword: "oldpass" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe("Current password and new password are required");
  });

  it("returns 400 when passwords are empty strings", async () => {
    mockRequireAuth.mockResolvedValue({ token: "the-token", userId: "testuser", realm: "bvbrc" });

    const request = mockNextRequest({
      method: "POST",
      body: { currentPassword: "", newPassword: "" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe("Current password and new password are required");
  });

  it("returns 400 when passwords are not strings", async () => {
    mockRequireAuth.mockResolvedValue({ token: "the-token", userId: "testuser", realm: "bvbrc" });

    const request = mockNextRequest({
      method: "POST",
      body: { currentPassword: 123, newPassword: true },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe("Current password and new password are required");
  });

  it("forwards JSON-RPC setPassword call to upstream", async () => {
    mockRequireAuth.mockResolvedValue({ token: "the-token", userId: "testuser", realm: "bvbrc" });

    let capturedBody: unknown = null;
    server.use(
      http.post("http://mock-user-url/", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ id: 1, jsonrpc: "2.0", result: true });
      }),
    );

    const request = mockNextRequest({
      method: "POST",
      body: { currentPassword: "oldpass", newPassword: "newpass" },
    });

    await POST(request);

    expect(capturedBody).toEqual({
      id: 1,
      jsonrpc: "2.0",
      method: "setPassword",
      params: ["testuser", "oldpass", "newpass"],
    });
  });

  it("returns success when upstream succeeds", async () => {
    mockRequireAuth.mockResolvedValue({ token: "the-token", userId: "testuser", realm: "bvbrc" });

    server.use(
      http.post("http://mock-user-url/", () =>
        HttpResponse.json({ id: 1, jsonrpc: "2.0", result: true }),
      ),
    );

    const request = mockNextRequest({
      method: "POST",
      body: { currentPassword: "oldpass", newPassword: "newpass" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("returns upstream status when upstream returns non-ok", async () => {
    mockRequireAuth.mockResolvedValue({ token: "the-token", userId: "testuser", realm: "bvbrc" });

    server.use(
      http.post("http://mock-user-url/", () =>
        new HttpResponse("Forbidden", { status: 403 }),
      ),
    );

    const request = mockNextRequest({
      method: "POST",
      body: { currentPassword: "oldpass", newPassword: "newpass" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.message).toBe("Forbidden");
  });

  it("returns 400 when upstream returns a JSON-RPC error", async () => {
    mockRequireAuth.mockResolvedValue({ token: "the-token", userId: "testuser", realm: "bvbrc" });

    server.use(
      http.post("http://mock-user-url/", () =>
        HttpResponse.json({
          id: 1,
          jsonrpc: "2.0",
          error: { message: "Current password is incorrect" },
        }),
      ),
    );

    const request = mockNextRequest({
      method: "POST",
      body: { currentPassword: "wrong", newPassword: "newpass" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe("Current password is incorrect");
  });

  it("returns 400 with fallback message when JSON-RPC error has no message", async () => {
    mockRequireAuth.mockResolvedValue({ token: "the-token", userId: "testuser", realm: "bvbrc" });

    server.use(
      http.post("http://mock-user-url/", () =>
        HttpResponse.json({ id: 1, jsonrpc: "2.0", error: {} }),
      ),
    );

    const request = mockNextRequest({
      method: "POST",
      body: { currentPassword: "wrong", newPassword: "newpass" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe("Failed to change password");
  });

  it("returns 500 when an exception is thrown", async () => {
    mockRequireAuth.mockResolvedValue({ token: "the-token", userId: "testuser", realm: "bvbrc" });

    server.use(
      http.post("http://mock-user-url/", () => HttpResponse.error()),
    );

    const request = mockNextRequest({
      method: "POST",
      body: { currentPassword: "old", newPassword: "new" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.message).toBe("Internal server error");
  });
});
