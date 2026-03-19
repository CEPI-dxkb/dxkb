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
  getRequiredEnv: vi.fn(() => "http://mock-register-url"),
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

describe("POST /api/auth/sign-up/email", () => {
  const validBody = {
    username: "newuser",
    email: "new@example.com",
    password: "secret123",
    password_repeat: "secret123",
    first_name: "New",
    last_name: "User",
  };

  beforeEach(() => {
    mockExtractRealmFromToken.mockReturnValue("patricbrc.org");
    mockGetProfileMetadata.mockResolvedValue(null);
  });

  it("returns 400 when username is missing", async () => {
    const request = mockNextRequest({
      method: "POST",
      body: { email: "a@b.com", password: "p", password_repeat: "p" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe(
      "Username, email, and password are required",
    );
  });

  it("returns 400 when email is missing", async () => {
    const request = mockNextRequest({
      method: "POST",
      body: { username: "u", password: "p", password_repeat: "p" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe(
      "Username, email, and password are required",
    );
  });

  it("returns 400 when password is missing", async () => {
    const request = mockNextRequest({
      method: "POST",
      body: { username: "u", email: "a@b.com", password_repeat: "p" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe(
      "Username, email, and password are required",
    );
  });

  it("returns 400 when passwords do not match", async () => {
    const request = mockNextRequest({
      method: "POST",
      body: {
        username: "u",
        email: "a@b.com",
        password: "one",
        password_repeat: "two",
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe("Passwords do not match");
  });

  it("returns upstream error with JSON message", async () => {
    server.use(
      http.post(
        "http://mock-register-url",
        () =>
          new HttpResponse(
            JSON.stringify({ message: "Username already taken" }),
            { status: 409 },
          ),
      ),
    );

    const request = mockNextRequest({
      method: "POST",
      body: validBody,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.message).toBe("Username already taken");
  });

  it("returns upstream error with plain text message", async () => {
    server.use(
      http.post(
        "http://mock-register-url",
        () => new HttpResponse("Plain text error", { status: 422 }),
      ),
    );

    const request = mockNextRequest({
      method: "POST",
      body: validBody,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.message).toBe("Plain text error");
  });

  it("returns upstream error with default message when text is empty", async () => {
    server.use(
      http.post(
        "http://mock-register-url",
        () => new HttpResponse("", { status: 500 }),
      ),
    );

    const request = mockNextRequest({
      method: "POST",
      body: validBody,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.message).toBe("Registration failed");
  });

  it("returns 502 when token is missing from response", async () => {
    server.use(
      http.post("http://mock-register-url", () => new HttpResponse("")),
    );

    const request = mockNextRequest({
      method: "POST",
      body: validBody,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.message).toBe("Registration failed: missing auth token");
  });

  it("returns user data on successful registration with profile", async () => {
    const profile = {
      id: "user123",
      email: "new@example.com",
      first_name: "New",
      last_name: "User",
    };
    mockGetProfileMetadata.mockResolvedValue(profile);
    mockExtractRealmFromToken.mockReturnValue("patricbrc.org");

    server.use(
      http.post(
        "http://mock-register-url",
        () =>
          new HttpResponse("", {
            headers: { Authorization: "new-token" },
          }),
      ),
    );

    const request = mockNextRequest({
      method: "POST",
      body: validBody,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user).toEqual(
      expect.objectContaining({
        id: "user123",
        username: "newuser",
        email: "new@example.com",
        first_name: "New",
        last_name: "User",
        email_verified: false,
        realm: "patricbrc.org",
      }),
    );
    expect(data.session).toEqual(
      expect.objectContaining({
        token: "",
        expiresAt: expect.any(String),
      }),
    );
    expect(mockCreateSession).toHaveBeenCalledWith(
      "new-token",
      "newuser",
      "patricbrc.org",
      profile,
    );
  });

  it("always sets email_verified to false regardless of profile", async () => {
    const profile = {
      id: "user123",
      email_verified: true,
    };
    mockGetProfileMetadata.mockResolvedValue(profile);

    server.use(
      http.post(
        "http://mock-register-url",
        () =>
          new HttpResponse("", {
            headers: { Authorization: "new-token" },
          }),
      ),
    );

    const request = mockNextRequest({
      method: "POST",
      body: validBody,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.user.email_verified).toBe(false);
  });

  it("returns 503 when an exception is thrown", async () => {
    server.use(
      http.post("http://mock-register-url", () => HttpResponse.error()),
    );

    const request = mockNextRequest({
      method: "POST",
      body: validBody,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.message).toBe("Registration service unavailable");
  });
});
