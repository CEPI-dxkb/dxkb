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

const userRegisterUrl = "https://auth.test/register";
const userUrl = "https://user.test/user";
const workspaceApiUrl = "https://workspace.test/Workspace";

const signupBody = {
  username: "bob",
  email: "bob@example.com",
  password: "securePass1!",
  password_repeat: "securePass1!",
  first_name: "Bob",
  last_name: "Builder",
};

/**
 * Default workspace mock — returns "User lacks permission" for ls (so
 * `ensureUserWorkspace` decides the workspace is missing) and `[[]]` for
 * each `Workspace.create` call. Tests that need to assert on workspace
 * behavior install their own handler before calling POST.
 */
function installDefaultWorkspaceHandler() {
  server.use(
    http.post(workspaceApiUrl, async ({ request }) => {
      const body = (await request.json()) as { method: string };
      if (body.method === "Workspace.ls") {
        return HttpResponse.json(
          {
            id: 1,
            jsonrpc: "2.0",
            error: { message: "_ERROR_User lacks permission" },
          },
          { status: 500 },
        );
      }
      return HttpResponse.json({ id: 1, jsonrpc: "2.0", result: [[]] });
    }),
  );
}

beforeEach(() => {
  process.env.USER_REGISTER_URL = userRegisterUrl;
  process.env.USER_URL = userUrl;
  process.env.WORKSPACE_API_URL = workspaceApiUrl;
  process.env.DEFAULT_REALM = "bvbrc";
  mockCookieStore.get.mockReset();
  mockCookieStore.set.mockReset();
  installDefaultWorkspaceHandler();
});

afterEach(() => {
  delete process.env.USER_REGISTER_URL;
  delete process.env.USER_URL;
  delete process.env.WORKSPACE_API_URL;
  delete process.env.DEFAULT_REALM;
});

describe("POST /api/auth/sign-up/email", () => {
  it("forwards form-encoded sign-up body to USER_REGISTER_URL, fetches the new profile, writes session cookies, and returns the session envelope", async () => {
    let upstreamRegisterBody: string | null = null;
    let upstreamRegisterContentType: string | null = null;

    server.use(
      http.post(userRegisterUrl, async ({ request }) => {
        upstreamRegisterBody = await request.text();
        upstreamRegisterContentType = request.headers.get("Content-Type");
        return new HttpResponse("token-bob", {
          headers: { Authorization: "token-bob" },
        });
      }),
      http.get(`${userUrl}/bob`, () =>
        HttpResponse.json({
          id: "bob",
          email: "bob@example.com",
          first_name: "Bob",
          last_name: "Builder",
          email_verified: false,
        }),
      ),
    );

    const request = mockNextRequest({ method: "POST", body: signupBody });
    const response = await POST(request, {});
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(upstreamRegisterContentType).toBe("application/x-www-form-urlencoded");
    expect(upstreamRegisterBody).toContain("username=bob");
    expect(upstreamRegisterBody).toContain(
      `email=${encodeURIComponent("bob@example.com")}`,
    );
    expect(upstreamRegisterBody).toContain("password=securePass1%21");
    expect(upstreamRegisterBody).toContain("password_repeat=securePass1%21");

    const setNames = mockCookieStore.set.mock.calls.map((call) => call[0]);
    expect(setNames).toContain("bvbrc_token");
    expect(setNames).toContain("bvbrc_user_id");
    const tokenCall = mockCookieStore.set.mock.calls.find(
      (call) => call[0] === "bvbrc_token",
    );
    expect(tokenCall?.[1]).toBe("token-bob");

    expect(data.user).toMatchObject({
      id: "bob",
      username: "bob",
      email: "bob@example.com",
      first_name: "Bob",
      last_name: "Builder",
      email_verified: false,
    });
    expect(data.session).toHaveProperty("expiresAt");
    expect(data.session.token).toBe("");
  });

  it("returns 400 when passwords do not match without calling upstream and without writing cookies", async () => {
    let upstreamCalled = false;
    server.use(
      http.post(userRegisterUrl, () => {
        upstreamCalled = true;
        return HttpResponse.text("token");
      }),
    );

    const request = mockNextRequest({
      method: "POST",
      body: { ...signupBody, password_repeat: "different" },
    });
    const response = await POST(request, {});
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toMatch(/passwords do not match/i);
    expect(upstreamCalled).toBe(false);
    expect(mockCookieStore.set).not.toHaveBeenCalled();
  });

  it("propagates the upstream message and status when registration fails (409 conflict) and writes no cookies", async () => {
    server.use(
      http.post(userRegisterUrl, () =>
        HttpResponse.json(
          { message: "Username already taken" },
          { status: 409 },
        ),
      ),
    );

    const request = mockNextRequest({ method: "POST", body: signupBody });
    const response = await POST(request, {});
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.message).toBe("Username already taken");
    expect(mockCookieStore.set).not.toHaveBeenCalled();
  });

  it("triggers workspace provisioning with the new session token after successful registration", async () => {
    let lsAuth: string | null = null;
    const createCalls: string[] = [];

    server.use(
      http.post(userRegisterUrl, () =>
        new HttpResponse("token-bob", {
          headers: { Authorization: "token-bob" },
        }),
      ),
      http.get(`${userUrl}/bob`, () =>
        HttpResponse.json({ id: "bob", email: "bob@example.com" }),
      ),
      http.post(workspaceApiUrl, async ({ request }) => {
        const body = (await request.json()) as { method: string; params: unknown[] };
        if (body.method === "Workspace.ls") {
          lsAuth = request.headers.get("Authorization");
          return HttpResponse.json(
            {
              id: 1,
              jsonrpc: "2.0",
              error: { message: "_ERROR_User lacks permission" },
            },
            { status: 500 },
          );
        }
        if (body.method === "Workspace.create") {
          const objects = (body.params[0] as { objects: unknown[][] }).objects;
          for (const obj of objects) {
            if (typeof obj[0] === "string") createCalls.push(obj[0]);
          }
        }
        return HttpResponse.json({ id: 1, jsonrpc: "2.0", result: [[]] });
      }),
    );

    const response = await POST(
      mockNextRequest({ method: "POST", body: signupBody }),
      {},
    );

    expect(response.status).toBe(200);
    expect(lsAuth).toBe("token-bob");
    expect(createCalls).toEqual(
      expect.arrayContaining([
        "/bob@bvbrc/home/",
        "/bob@bvbrc/home/Genome Groups",
        "/bob@bvbrc/home/Feature Groups",
        "/bob@bvbrc/home/Experiments",
        "/bob@bvbrc/home/Experiment Groups",
      ]),
    );
  });

  it("returns 200 even when workspace provisioning throws (best-effort)", async () => {
    server.use(
      http.post(userRegisterUrl, () =>
        new HttpResponse("token-bob", {
          headers: { Authorization: "token-bob" },
        }),
      ),
      http.get(`${userUrl}/bob`, () =>
        HttpResponse.json({ id: "bob", email: "bob@example.com" }),
      ),
      http.post(workspaceApiUrl, () =>
        new HttpResponse("Workspace API down", { status: 503 }),
      ),
    );

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await POST(
      mockNextRequest({ method: "POST", body: signupBody }),
      {},
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user).toMatchObject({ username: "bob" });

    // Cookies must still be set so the user is signed in even though the
    // workspace setup failed — Path C is the recovery mechanism on first
    // workspace visit.
    const setNames = mockCookieStore.set.mock.calls.map((call) => call[0]);
    expect(setNames).toContain("bvbrc_token");
    expect(setNames).toContain("bvbrc_user_id");

    consoleErrorSpy.mockRestore();
  });
});
