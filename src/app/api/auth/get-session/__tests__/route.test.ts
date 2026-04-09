vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({ get: vi.fn(), set: vi.fn() })),
}));

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(),
  createSession: vi.fn(),
  deleteSession: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  getRequiredEnv: vi.fn(() => "http://mock-user-url"),
}));

import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { GET } from "../route";
import {
  getSession,
  createSession,
  deleteSession,
} from "@/lib/auth/session";

const mockGetSession = vi.mocked(getSession);
const mockCreateSession = vi.mocked(createSession);
const mockDeleteSession = vi.mocked(deleteSession);

describe("GET /api/auth/get-session", () => {
  it("returns null user/session when no token", async () => {
    mockGetSession.mockResolvedValue({
      token: undefined,
      userId: "testuser",
      realm: undefined,
    });

    const response = await GET();
    const data = await response.json();

    expect(data).toEqual({ user: null, session: null });
    expect(mockDeleteSession).toHaveBeenCalled();
  });

  it("returns null user/session when no userId", async () => {
    mockGetSession.mockResolvedValue({
      token: "some-token",
      userId: undefined,
      realm: undefined,
    });

    const response = await GET();
    const data = await response.json();

    expect(data).toEqual({ user: null, session: null });
    expect(mockDeleteSession).toHaveBeenCalled();
  });

  it("clears cookies when no auth data is present", async () => {
    mockGetSession.mockResolvedValue({
      token: undefined,
      userId: undefined,
      realm: undefined,
    });

    await GET();

    expect(mockDeleteSession).toHaveBeenCalledTimes(1);
  });

  it("validates token by calling upstream user endpoint", async () => {
    let capturedHeaders: Headers | undefined;

    mockGetSession.mockResolvedValue({
      token: "valid-token",
      userId: "testuser",
      realm: "patricbrc.org",
    });

    server.use(
      http.get("http://mock-user-url/testuser", ({ request }) => {
        capturedHeaders = request.headers;
        return HttpResponse.json({
          id: "testuser",
          email: "test@example.com",
          first_name: "Test",
          last_name: "User",
          email_verified: true,
        });
      }),
    );

    await GET();

    expect(capturedHeaders?.get("Authorization")).toBe("valid-token");
    expect(capturedHeaders?.get("Accept")).toBe("application/json");
  });

  it("clears cookies and returns null when upstream returns non-ok", async () => {
    mockGetSession.mockResolvedValue({
      token: "expired-token",
      userId: "testuser",
      realm: undefined,
    });

    server.use(
      http.get(
        "http://mock-user-url/testuser",
        () => new HttpResponse(null, { status: 401 }),
      ),
    );

    const response = await GET();
    const data = await response.json();

    expect(data).toEqual({ user: null, session: null });
    expect(mockDeleteSession).toHaveBeenCalled();
  });

  it("clears cookies and returns null on network error", async () => {
    mockGetSession.mockResolvedValue({
      token: "some-token",
      userId: "testuser",
      realm: undefined,
    });

    server.use(
      http.get("http://mock-user-url/testuser", () => HttpResponse.error()),
    );

    const response = await GET();
    const data = await response.json();

    expect(data).toEqual({ user: null, session: null });
    expect(mockDeleteSession).toHaveBeenCalled();
  });

  it("refreshes cookies on valid session", async () => {
    mockGetSession.mockResolvedValue({
      token: "valid-token",
      userId: "testuser",
      realm: "patricbrc.org",
    });

    server.use(
      http.get("http://mock-user-url/testuser", () =>
        HttpResponse.json({
          id: "testuser",
          email: "test@example.com",
        }),
      ),
    );

    await GET();

    expect(mockCreateSession).toHaveBeenCalledWith(
      "valid-token",
      "testuser",
      "patricbrc.org",
    );
  });

  it("returns user data on valid session", async () => {
    mockGetSession.mockResolvedValue({
      token: "valid-token",
      userId: "testuser",
      realm: "patricbrc.org",
    });

    server.use(
      http.get("http://mock-user-url/testuser", () =>
        HttpResponse.json({
          id: "user123",
          email: "test@example.com",
          first_name: "Test",
          last_name: "User",
          email_verified: true,
        }),
      ),
    );

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user).toEqual(
      expect.objectContaining({
        id: "user123",
        username: "testuser",
        email: "test@example.com",
        first_name: "Test",
        last_name: "User",
        email_verified: true,
        realm: "patricbrc.org",
      }),
    );
    expect(data.session).toEqual(
      expect.objectContaining({
        token: "",
        expiresAt: expect.any(String),
      }),
    );
  });

  it("returns 500 with null user/session on outer exception", async () => {
    mockGetSession.mockRejectedValue(new Error("Unexpected error"));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ user: null, session: null });
  });
});
