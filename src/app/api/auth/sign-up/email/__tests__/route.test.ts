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

const signupBody = {
  username: "bob",
  email: "bob@example.com",
  password: "securePass1!",
  password_repeat: "securePass1!",
  first_name: "Bob",
  last_name: "Builder",
};

beforeEach(() => {
  process.env.USER_REGISTER_URL = userRegisterUrl;
  process.env.USER_URL = userUrl;
  mockCookieStore.get.mockReset();
  mockCookieStore.set.mockReset();
});

afterEach(() => {
  delete process.env.USER_REGISTER_URL;
  delete process.env.USER_URL;
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
});
