vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(),
  createSession: vi.fn(),
  createSuBackup: vi.fn(),
  extractRealmFromToken: vi.fn(),
  sessionMaxAge: 3600 * 4,
}));

vi.mock("@/lib/env", () => ({
  getRequiredEnv: vi.fn((key: string) => {
    const envs: Record<string, string> = {
      USER_URL: "http://mock-user-url/user",
      USER_AUTH_URL: "http://mock-user-url/authenticate",
    };
    return envs[key] ?? "";
  }),
}));

import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { NextRequest } from "next/server";
import { POST } from "../route";
import {
  getSession,
  createSession,
  createSuBackup,
  extractRealmFromToken,
} from "@/lib/auth/session";

const mockGetSession = vi.mocked(getSession);
const mockCreateSession = vi.mocked(createSession);
const mockCreateSuBackup = vi.mocked(createSuBackup);
const mockExtractRealmFromToken = vi.mocked(extractRealmFromToken);

function makeRequest(body: Record<string, string>) {
  return new NextRequest("http://localhost/api/auth/su-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/su-login", () => {
  beforeEach(() => {
    mockGetSession.mockResolvedValue({
      token: "admin-token",
      userId: "adminuser",
      realm: "bvbrc.org",
    });
    mockExtractRealmFromToken.mockReturnValue("bvbrc.org");
  });

  it("returns 401 when not authenticated", async () => {
    mockGetSession.mockResolvedValue({
      token: undefined,
      userId: undefined,
      realm: undefined,
    });

    const response = await POST(
      makeRequest({ targetUser: "target", password: "pass" }),
    );

    expect(response.status).toBe(401);
  });

  it("returns 403 when user does not have admin role", async () => {
    server.use(
      http.get("http://mock-user-url/user/adminuser", () =>
        HttpResponse.json({ id: "adminuser", roles: [] }),
      ),
    );

    const response = await POST(
      makeRequest({ targetUser: "target", password: "pass" }),
    );

    expect(response.status).toBe(403);
  });

  it("returns 401 with generic message when sulogin fails", async () => {
    server.use(
      http.get("http://mock-user-url/user/adminuser", () =>
        HttpResponse.json({ id: "adminuser", roles: ["admin"] }),
      ),
      http.post(
        "http://mock-user-url/authenticate/sulogin",
        () => new HttpResponse(null, { status: 401 }),
      ),
    );

    const response = await POST(
      makeRequest({ targetUser: "target", password: "wrongpass" }),
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.message).toBe("Invalid credentials");
  });

  it("backs up admin session and sets target user session on success", async () => {
    server.use(
      http.get("http://mock-user-url/user/adminuser", () =>
        HttpResponse.json({ id: "adminuser", roles: ["admin"] }),
      ),
      http.post("http://mock-user-url/authenticate/sulogin", () =>
        HttpResponse.text("target-user-token-value"),
      ),
      http.get("http://mock-user-url/user/targetuser", () =>
        HttpResponse.json({
          id: "targetuser",
          email: "target@example.com",
          first_name: "Target",
          last_name: "User",
          email_verified: true,
          roles: [],
        }),
      ),
    );

    const response = await POST(
      makeRequest({ targetUser: "targetuser", password: "adminpass" }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockCreateSuBackup).toHaveBeenCalledWith(
      "admin-token",
      "adminuser",
      "bvbrc.org",
    );
    expect(mockCreateSession).toHaveBeenCalledWith(
      "target-user-token-value",
      "targetuser",
      "bvbrc.org",
    );
    expect(data.user.username).toBe("targetuser");
    expect(data.user.isImpersonating).toBe(true);
    expect(data.user.originalUsername).toBe("adminuser");
  });

  it("returns 400 when targetUser or password is missing", async () => {
    const response = await POST(
      makeRequest({ targetUser: "", password: "pass" }),
    );

    expect(response.status).toBe(400);
  });
});
