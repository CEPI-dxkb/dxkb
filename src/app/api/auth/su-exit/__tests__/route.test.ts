vi.mock("@/lib/auth/session", () => ({
  restoreSuBackup: vi.fn(),
  sessionMaxAge: 3600 * 4,
}));

vi.mock("@/lib/env", () => ({
  getRequiredEnv: vi.fn(() => "http://mock-user-url/user"),
}));

import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { POST } from "../route";
import { restoreSuBackup } from "@/lib/auth/session";

const mockRestoreSuBackup = vi.mocked(restoreSuBackup);

describe("POST /api/auth/su-exit", () => {
  it("restores admin session and returns admin user data", async () => {
    mockRestoreSuBackup.mockResolvedValue({
      token: "admin-token",
      userId: "adminuser",
      realm: "bvbrc.org",
    });

    server.use(
      http.get("http://mock-user-url/user/adminuser", () =>
        HttpResponse.json({
          id: "adminuser",
          email: "admin@example.com",
          first_name: "Admin",
          last_name: "User",
          email_verified: true,
          roles: ["admin"],
        }),
      ),
    );

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user.username).toBe("adminuser");
    expect(data.user.roles).toEqual(["admin"]);
    expect(data.user.isImpersonating).toBeUndefined();
  });

  it("returns 400 when no SU backup exists", async () => {
    mockRestoreSuBackup.mockResolvedValue({
      token: undefined,
      userId: undefined,
      realm: undefined,
    });

    const response = await POST();

    expect(response.status).toBe(400);
  });

  it("returns user data with defaults when profile fetch fails", async () => {
    mockRestoreSuBackup.mockResolvedValue({
      token: "admin-token",
      userId: "adminuser",
      realm: "bvbrc.org",
    });

    server.use(
      http.get("http://mock-user-url/user/adminuser", () =>
        new HttpResponse(null, { status: 500 }),
      ),
    );

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user.username).toBe("adminuser");
    expect(data.user.email).toBe("");
  });
});
