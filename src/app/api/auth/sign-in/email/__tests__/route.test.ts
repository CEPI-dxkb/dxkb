vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({ get: vi.fn(), set: vi.fn() })),
}));

vi.mock("@/lib/auth/session", () => ({
  createSession: vi.fn(),
  extractRealmFromToken: vi.fn(),
}));

vi.mock("@/lib/auth/profile", () => ({
  getProfileMetadata: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  getRequiredEnv: vi.fn(() => "http://mock-auth-url"),
}));

import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { mockNextRequest } from "@/test-helpers/api-route-helpers";
import { POST } from "../route";
import {
  createSession,
  extractRealmFromToken,
} from "@/lib/auth/session";
import { getProfileMetadata } from "@/lib/auth/profile";

const mockCreateSession = vi.mocked(createSession);
const mockGetProfileMetadata = vi.mocked(getProfileMetadata);
const mockExtractRealmFromToken = vi.mocked(extractRealmFromToken);

describe("POST /api/auth/sign-in/email", () => {
  beforeEach(() => {
    mockExtractRealmFromToken.mockReturnValue("patricbrc.org");
    mockGetProfileMetadata.mockResolvedValue(null);
  });

  it("returns 400 when username is missing", async () => {
    const request = mockNextRequest({
      method: "POST",
      body: { password: "secret" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe("Username and password are required");
  });

  it("returns 400 when password is missing", async () => {
    const request = mockNextRequest({
      method: "POST",
      body: { username: "testuser" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe("Username and password are required");
  });

  it("returns 401 when upstream returns 401", async () => {
    server.use(
      http.post("http://mock-auth-url", () => new HttpResponse(null, { status: 401 })),
    );

    const request = mockNextRequest({
      method: "POST",
      body: { username: "testuser", password: "wrong" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.message).toBe("Invalid credentials");
  });

  it("returns 401 when upstream returns 403", async () => {
    server.use(
      http.post("http://mock-auth-url", () => new HttpResponse(null, { status: 403 })),
    );

    const request = mockNextRequest({
      method: "POST",
      body: { username: "testuser", password: "wrong" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.message).toBe("Invalid credentials");
  });

  it("returns 503 when upstream returns a non-auth error", async () => {
    server.use(
      http.post("http://mock-auth-url", () => new HttpResponse(null, { status: 500 })),
    );

    const request = mockNextRequest({
      method: "POST",
      body: { username: "testuser", password: "pass" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.message).toBe("Authentication service unavailable");
  });

  it("uses token from Authorization header when available", async () => {
    server.use(
      http.post(
        "http://mock-auth-url",
        () =>
          new HttpResponse("body-token", {
            headers: { Authorization: "auth-token-from-header" },
          }),
      ),
    );

    const request = mockNextRequest({
      method: "POST",
      body: { username: "testuser", password: "pass" },
    });

    await POST(request);

    expect(mockExtractRealmFromToken).toHaveBeenCalledWith(
      "auth-token-from-header",
    );
  });

  it("falls back to body text when Authorization header is absent", async () => {
    server.use(
      http.post("http://mock-auth-url", () => new HttpResponse("body-token-value")),
    );

    const request = mockNextRequest({
      method: "POST",
      body: { username: "testuser", password: "pass" },
    });

    await POST(request);

    expect(mockExtractRealmFromToken).toHaveBeenCalledWith("body-token-value");
  });

  it("returns 503 when token is empty", async () => {
    server.use(
      http.post("http://mock-auth-url", () => new HttpResponse("")),
    );

    const request = mockNextRequest({
      method: "POST",
      body: { username: "testuser", password: "pass" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.message).toBe("Authentication service unavailable");
  });

  it("calls createSession with correct arguments", async () => {
    const profile = {
      id: "user123",
      email: "test@example.com",
      first_name: "Test",
      last_name: "User",
      email_verified: true,
    };
    mockGetProfileMetadata.mockResolvedValue(profile);
    mockExtractRealmFromToken.mockReturnValue("patricbrc.org");

    server.use(
      http.post(
        "http://mock-auth-url",
        () =>
          new HttpResponse("", {
            headers: { Authorization: "the-token" },
          }),
      ),
    );

    const request = mockNextRequest({
      method: "POST",
      body: { username: "testuser", password: "pass" },
    });

    await POST(request);

    expect(mockCreateSession).toHaveBeenCalledWith(
      "the-token",
      "testuser",
      "patricbrc.org",
      profile,
    );
  });

  it("returns user with profile data when profile is available", async () => {
    const profile = {
      id: "user123",
      email: "test@example.com",
      first_name: "Test",
      last_name: "User",
      email_verified: true,
    };
    mockGetProfileMetadata.mockResolvedValue(profile);
    mockExtractRealmFromToken.mockReturnValue("patricbrc.org");

    server.use(
      http.post(
        "http://mock-auth-url",
        () =>
          new HttpResponse("", {
            headers: { Authorization: "the-token" },
          }),
      ),
    );

    const request = mockNextRequest({
      method: "POST",
      body: { username: "testuser", password: "pass" },
    });

    const response = await POST(request);
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

  it("returns user with fallback values when no profile is available", async () => {
    mockGetProfileMetadata.mockResolvedValue(null);
    mockExtractRealmFromToken.mockReturnValue(undefined);

    server.use(
      http.post(
        "http://mock-auth-url",
        () =>
          new HttpResponse("", {
            headers: { Authorization: "the-token" },
          }),
      ),
    );

    const request = mockNextRequest({
      method: "POST",
      body: { username: "testuser", password: "pass" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user).toEqual(
      expect.objectContaining({
        id: "testuser",
        username: "testuser",
        email: "",
        first_name: "",
        last_name: "",
        email_verified: false,
      }),
    );
  });

  it("returns 503 when an exception is thrown", async () => {
    server.use(
      http.post("http://mock-auth-url", () => HttpResponse.error()),
    );

    const request = mockNextRequest({
      method: "POST",
      body: { username: "testuser", password: "pass" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.message).toBe("Authentication service unavailable");
  });
});
