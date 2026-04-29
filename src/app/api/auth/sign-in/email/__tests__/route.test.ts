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

const userAuthUrl = "https://auth.test/sign-in";
const userUrl = "https://user.test/user";

beforeEach(() => {
  process.env.USER_AUTH_URL = userAuthUrl;
  process.env.USER_URL = userUrl;
  mockCookieStore.get.mockReset();
  mockCookieStore.set.mockReset();
});

afterEach(() => {
  delete process.env.USER_AUTH_URL;
  delete process.env.USER_URL;
});

function setNamesFromCalls(): string[] {
  return mockCookieStore.set.mock.calls.map((call) => call[0]);
}

describe("POST /api/auth/sign-in/email", () => {
  it("forwards form-encoded credentials to USER_AUTH_URL, fetches the profile from USER_URL with the returned token, writes session cookies, and returns the session envelope", async () => {
    let upstreamAuthBody: string | null = null;
    let upstreamAuthContentType: string | null = null;
    let profileAuthHeader: string | null = null;

    server.use(
      http.post(userAuthUrl, async ({ request }) => {
        upstreamAuthBody = await request.text();
        upstreamAuthContentType = request.headers.get("Content-Type");
        return new HttpResponse("token-abc", {
          headers: { Authorization: "token-abc" },
        });
      }),
      http.get(`${userUrl}/alice`, ({ request }) => {
        profileAuthHeader = request.headers.get("Authorization");
        return HttpResponse.json({
          id: "alice",
          email: "alice@example.com",
          first_name: "Alice",
          last_name: "Tester",
          email_verified: true,
        });
      }),
    );

    const request = mockNextRequest({
      method: "POST",
      body: { username: "alice", password: "password1234" },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(upstreamAuthContentType).toBe("application/x-www-form-urlencoded");
    expect(upstreamAuthBody).toBe("username=alice&password=password1234");
    expect(profileAuthHeader).toBe("token-abc");

    const setNames = setNamesFromCalls();
    expect(setNames).toContain("bvbrc_token");
    expect(setNames).toContain("bvbrc_user_id");
    const tokenCall = mockCookieStore.set.mock.calls.find(
      (call) => call[0] === "bvbrc_token",
    );
    expect(tokenCall?.[1]).toBe("token-abc");
    expect(tokenCall?.[2]).toEqual(
      expect.objectContaining({ httpOnly: true, path: "/", sameSite: "strict" }),
    );
    const userIdCall = mockCookieStore.set.mock.calls.find(
      (call) => call[0] === "bvbrc_user_id",
    );
    expect(userIdCall?.[1]).toBe("alice");

    expect(data.user).toMatchObject({
      id: "alice",
      username: "alice",
      email: "alice@example.com",
      first_name: "Alice",
      last_name: "Tester",
      email_verified: true,
    });
    expect(data.session).toHaveProperty("expiresAt");
    expect(data.session.token).toBe("");
  });

  it("maps upstream 401 to 401 and does not write session cookies", async () => {
    server.use(
      http.post(userAuthUrl, () => new HttpResponse(null, { status: 401 })),
    );

    const request = mockNextRequest({
      method: "POST",
      body: { username: "alice", password: "wrong" },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.message).toMatch(/invalid credentials/i);
    expect(mockCookieStore.set).not.toHaveBeenCalled();
  });

  it("maps upstream 5xx to 503 and does not write session cookies", async () => {
    server.use(
      http.post(userAuthUrl, () => new HttpResponse(null, { status: 500 })),
    );

    const request = mockNextRequest({
      method: "POST",
      body: { username: "alice", password: "password1234" },
    });
    const response = await POST(request);

    expect(response.status).toBe(503);
    expect(mockCookieStore.set).not.toHaveBeenCalled();
  });

  it("returns 400 with a validation message when credentials are missing and never calls upstream", async () => {
    let upstreamCalled = false;
    server.use(
      http.post(userAuthUrl, () => {
        upstreamCalled = true;
        return new HttpResponse("token", { status: 200 });
      }),
    );

    const request = mockNextRequest({
      method: "POST",
      body: { username: "alice" },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toMatch(/username and password are required/i);
    expect(upstreamCalled).toBe(false);
    expect(mockCookieStore.set).not.toHaveBeenCalled();
  });
});
