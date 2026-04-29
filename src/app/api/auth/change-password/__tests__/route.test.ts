import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";

const { mockCookieStore } = vi.hoisted(() => ({
  mockCookieStore: { get: vi.fn(), set: vi.fn() },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

import { mockNextRequest } from "@/test-helpers/api-route-helpers";
import { POST } from "../route";

const userUrl = "https://user.test/user";

beforeEach(() => {
  process.env.USER_URL = userUrl;
  mockCookieStore.get.mockReset();
  mockCookieStore.set.mockReset();
});

afterEach(() => {
  delete process.env.USER_URL;
});

function setSessionCookies(token: string, userId: string) {
  mockCookieStore.get.mockImplementation((name: string) => {
    if (name === "bvbrc_token") return { value: token };
    if (name === "bvbrc_user_id") return { value: userId };
    return undefined;
  });
}

describe("POST /api/auth/change-password", () => {
  it("returns 400 when both fields are missing without calling upstream", async () => {
    let upstreamCalled = false;
    server.use(
      http.post(`${userUrl}/`, () => {
        upstreamCalled = true;
        return HttpResponse.json({ id: 1, jsonrpc: "2.0", result: null });
      }),
    );

    const request = mockNextRequest({ method: "POST", body: {} });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe("Current password and new password are required");
    expect(upstreamCalled).toBe(false);
  });

  it("returns 401 when no session cookies are set so the session.read() returns null", async () => {
    mockCookieStore.get.mockReturnValue(undefined);

    const request = mockNextRequest({
      method: "POST",
      body: { currentPassword: "old", newPassword: "newSecret123" },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.message).toMatch(/authentication required/i);
  });

  it("forwards the JSON-RPC setPassword body with the session token as the Authorization header to USER_URL on success", async () => {
    setSessionCookies("valid-token", "alice");

    let capturedAuthorization: string | null = null;
    let capturedContentType: string | null = null;
    let capturedBody: string | null = null;
    server.use(
      http.post(`${userUrl}/`, async ({ request }) => {
        capturedAuthorization = request.headers.get("Authorization");
        capturedContentType = request.headers.get("Content-Type");
        capturedBody = await request.text();
        return HttpResponse.json({ id: 1, jsonrpc: "2.0", result: null });
      }),
    );

    const request = mockNextRequest({
      method: "POST",
      body: { currentPassword: "old", newPassword: "newSecret123" },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true });
    expect(capturedAuthorization).toBe("valid-token");
    expect(capturedContentType).toBe("application/json");

    const parsedBody = JSON.parse(capturedBody ?? "{}") as {
      jsonrpc?: string;
      method?: string;
      params?: unknown[];
    };
    expect(parsedBody.jsonrpc).toBe("2.0");
    expect(parsedBody.method).toBe("setPassword");
    // params: [userId, currentPassword, newPassword] — pulled from session cookies + body.
    expect(parsedBody.params).toEqual(["alice", "old", "newSecret123"]);
  });

  it("propagates the JSON-RPC error message when upstream returns a 200 with an error envelope", async () => {
    setSessionCookies("valid-token", "alice");

    server.use(
      http.post(`${userUrl}/`, () =>
        HttpResponse.json({
          id: 1,
          jsonrpc: "2.0",
          error: { message: "Wrong current password" },
        }),
      ),
    );

    const request = mockNextRequest({
      method: "POST",
      body: { currentPassword: "wrong", newPassword: "newSecret123" },
    });
    const response = await POST(request);
    const data = await response.json();

    // bvbrcIdentity.changePassword maps a JSON-RPC error envelope to fail("validation", msg, 400)
    // and the route surfaces error.status (400) directly.
    expect(response.status).toBe(400);
    expect(data.message).toBe("Wrong current password");
  });

  it("returns the upstream HTTP error status with the upstream body text on a transport-level failure", async () => {
    setSessionCookies("valid-token", "alice");

    server.use(
      http.post(`${userUrl}/`, () =>
        new HttpResponse("Forbidden", { status: 403 }),
      ),
    );

    const request = mockNextRequest({
      method: "POST",
      body: { currentPassword: "old", newPassword: "newSecret123" },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.message).toBe("Forbidden");
  });
});
