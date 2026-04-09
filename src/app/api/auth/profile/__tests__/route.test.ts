const { mockCookieStore } = vi.hoisted(() => ({
  mockCookieStore: { get: vi.fn(), set: vi.fn() },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

vi.mock("@/lib/auth/session", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/auth/session")>();
  return {
    ...actual,
    requireAuth: vi.fn(),
  };
});

import { NextResponse } from "next/server";
import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { mockNextRequest } from "@/test-helpers/api-route-helpers";
import { GET, POST } from "../route";
import { requireAuth } from "@/lib/auth/session";

const mockRequireAuth = vi.mocked(requireAuth);

const userUrl = "http://mock-user-url";

beforeEach(() => {
  process.env.USER_URL = userUrl;
});

afterEach(() => {
  delete process.env.USER_URL;
});

/** Helper — configure mock cookies so serverAuthenticatedFetch works */
function setAuthCookies(token: string, userId: string) {
  mockCookieStore.get.mockImplementation((name: string) => {
    if (name === "bvbrc_token") return { value: token };
    if (name === "bvbrc_user_id") return { value: userId };
    return undefined;
  });
}

describe("GET /api/auth/profile", () => {
  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ message: "Authentication required" }, { status: 401 }),
    );

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.message).toBe("Authentication required");
  });

  it("returns profile data when authenticated", async () => {
    const profile = { id: "user1", email: "test@example.com", first_name: "Test" };
    mockRequireAuth.mockResolvedValue({ token: "tok", userId: "user1", realm: "bvbrc" });
    setAuthCookies("tok", "user1");

    server.use(
      http.get(`${userUrl}/user1`, () => HttpResponse.json(profile)),
    );

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(profile);
  });

  it("passes encoded userId in the URL", async () => {
    mockRequireAuth.mockResolvedValue({ token: "tok", userId: "user@realm.org", realm: "bvbrc" });
    setAuthCookies("tok", "user@realm.org");

    let capturedUrl: string | null = null;
    server.use(
      http.get(`${userUrl}/:userId`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({});
      }),
    );

    await GET();

    expect(capturedUrl).toBe(`${userUrl}/user%40realm.org`);
  });

  it("returns upstream status when fetch fails", async () => {
    mockRequireAuth.mockResolvedValue({ token: "tok", userId: "user1", realm: "bvbrc" });
    setAuthCookies("tok", "user1");

    server.use(
      http.get(`${userUrl}/user1`, () =>
        new HttpResponse(null, { status: 404 }),
      ),
    );

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.message).toBe("Failed to fetch profile");
  });

  it("returns 500 when an exception is thrown", async () => {
    mockRequireAuth.mockResolvedValue({ token: "tok", userId: "user1", realm: "bvbrc" });
    setAuthCookies("tok", "user1");

    server.use(
      http.get(`${userUrl}/user1`, () => HttpResponse.error()),
    );

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.message).toBe("Internal server error");
  });
});

describe("POST /api/auth/profile", () => {
  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ message: "Authentication required" }, { status: 401 }),
    );

    const request = mockNextRequest({
      method: "POST",
      body: [{ op: "replace", path: "/email", value: "new@example.com" }],
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.message).toBe("Authentication required");
  });

  it("forwards JSON Patch body to upstream", async () => {
    mockRequireAuth.mockResolvedValue({ token: "the-token", userId: "user1", realm: "bvbrc" });
    setAuthCookies("the-token", "user1");

    const patchOps = [{ op: "replace", path: "/email", value: "new@example.com" }];
    let capturedBody: string | null = null;
    let capturedContentType: string | null = null;
    let capturedAuthorization: string | null = null;

    server.use(
      http.post(`${userUrl}/user1`, async ({ request }) => {
        capturedBody = await request.text();
        capturedContentType = request.headers.get("Content-Type");
        capturedAuthorization = request.headers.get("Authorization");
        return HttpResponse.json({ success: true });
      }),
    );

    const request = mockNextRequest({
      method: "POST",
      body: patchOps,
    });

    await POST(request);

    expect(capturedBody).toBe(JSON.stringify(patchOps));
    expect(capturedContentType).toBe("application/json-patch+json");
    expect(capturedAuthorization).toBe("the-token");
  });

  it("returns success when upstream succeeds", async () => {
    mockRequireAuth.mockResolvedValue({ token: "the-token", userId: "user1", realm: "bvbrc" });
    setAuthCookies("the-token", "user1");

    server.use(
      http.post(`${userUrl}/user1`, () =>
        HttpResponse.json({ ok: true }),
      ),
    );

    const request = mockNextRequest({
      method: "POST",
      body: [{ op: "replace", path: "/first_name", value: "New" }],
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("returns upstream status when upstream fails", async () => {
    mockRequireAuth.mockResolvedValue({ token: "the-token", userId: "user1", realm: "bvbrc" });
    setAuthCookies("the-token", "user1");

    server.use(
      http.post(`${userUrl}/user1`, () =>
        new HttpResponse("Bad Request", { status: 400 }),
      ),
    );

    const request = mockNextRequest({
      method: "POST",
      body: [{ op: "replace", path: "/email", value: "bad" }],
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe("Bad Request");
  });

  it("returns fallback message when upstream error body is empty", async () => {
    mockRequireAuth.mockResolvedValue({ token: "the-token", userId: "user1", realm: "bvbrc" });
    setAuthCookies("the-token", "user1");

    server.use(
      http.post(`${userUrl}/user1`, () =>
        new HttpResponse("", { status: 422 }),
      ),
    );

    const request = mockNextRequest({
      method: "POST",
      body: [{ op: "replace", path: "/email", value: "bad" }],
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.message).toBe("Failed to update profile");
  });

  it("returns 500 when an exception is thrown", async () => {
    mockRequireAuth.mockResolvedValue({ token: "the-token", userId: "user1", realm: "bvbrc" });
    setAuthCookies("the-token", "user1");

    server.use(
      http.post(`${userUrl}/user1`, () => HttpResponse.error()),
    );

    const request = mockNextRequest({
      method: "POST",
      body: [{ op: "replace", path: "/email", value: "new@example.com" }],
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.message).toBe("Internal server error");
  });
});
