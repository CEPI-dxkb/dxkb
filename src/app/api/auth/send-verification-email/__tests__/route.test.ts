vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({ get: vi.fn(), set: vi.fn() })),
}));

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  getRequiredEnv: vi.fn(() => "http://mock-verification-url"),
}));

import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { POST } from "../route";
import { getSession } from "@/lib/auth/session";

const mockGetSession = vi.mocked(getSession);

describe("POST /api/auth/send-verification-email", () => {
  it("returns 401 when no token is present", async () => {
    mockGetSession.mockResolvedValue({
      token: undefined,
      userId: "testuser",
      realm: undefined,
    });

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.message).toBe(
      "Authentication required. Please sign in first.",
    );
  });

  it("returns 401 when no userId is present", async () => {
    mockGetSession.mockResolvedValue({
      token: "some-token",
      userId: undefined,
      realm: undefined,
    });

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
  });

  it("returns success when verification email is sent", async () => {
    mockGetSession.mockResolvedValue({
      token: "valid-token",
      userId: "testuser",
      realm: "patricbrc.org",
    });

    let capturedBody: unknown;
    let capturedHeaders: Record<string, string> = {};
    server.use(
      http.post("http://mock-verification-url", async ({ request }) => {
        capturedBody = await request.json();
        capturedHeaders = {
          Authorization: request.headers.get("Authorization") ?? "",
        };
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe("Verification email sent successfully");
    expect(capturedBody).toEqual({ id: "testuser" });
    expect(capturedHeaders.Authorization).toBe("valid-token");
  });

  it("returns upstream error on non-ok response", async () => {
    mockGetSession.mockResolvedValue({
      token: "valid-token",
      userId: "testuser",
      realm: undefined,
    });

    server.use(
      http.post("http://mock-verification-url", () => {
        return HttpResponse.json(
          { message: "Too many verification requests" },
          { status: 429 },
        );
      }),
    );

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.success).toBe(false);
    expect(data.message).toBe("Too many verification requests");
  });

  it("returns 500 when an exception is thrown", async () => {
    mockGetSession.mockRejectedValue(new Error("Unexpected error"));

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.message).toBe("Internal server error");
  });
});
