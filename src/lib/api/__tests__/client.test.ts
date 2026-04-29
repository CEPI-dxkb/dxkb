import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { apiCall, apiGet } from "../client";
import { ApiCallError } from "../types";
import { createAuthStore, setActiveAuthStore } from "@/lib/auth/store";
import { httpAuthAdapter } from "@/lib/auth/adapters/http";

function installAuthStore(
  user = { username: "u", email: "u@example.com", token: "t" },
) {
  const store = createAuthStore({ port: httpAuthAdapter(), initialUser: user });
  setActiveAuthStore(store);
  return store;
}

afterEach(() => setActiveAuthStore(null));

describe("apiCall", () => {
  it("sends a POST with credentials and JSON content-type", async () => {
    let capturedHeaders: Headers | undefined;

    server.use(
      http.post("/api/test", async ({ request }) => {
        capturedHeaders = request.headers;
        const body = await request.json();
        return HttpResponse.json({ result: body });
      }),
    );

    const result = await apiCall<{ result: { foo: string } }>("/api/test", {
      foo: "bar",
    });

    expect(result).toEqual({ result: { foo: "bar" } });
    expect(capturedHeaders?.get("content-type")).toBe("application/json");
  });

  it("throws ApiCallError on non-ok response with error body", async () => {
    server.use(
      http.post("/api/test", () => {
        return HttpResponse.json(
          { error: "Bad request", code: -32602 },
          { status: 400 },
        );
      }),
    );

    try {
      await apiCall("/api/test", {});
    } catch (e) {
      expect(e).toBeInstanceOf(ApiCallError);
      const err = e as ApiCallError;
      expect(err.status).toBe(400);
      expect(err.code).toBe("validation");
      expect(err.message).toBe("Bad request");
    }
  });

  it("throws ApiCallError with statusText when body has no error field", async () => {
    server.use(
      http.post("/api/test", () => {
        return new HttpResponse(null, {
          status: 500,
          statusText: "Internal Server Error",
        });
      }),
    );

    try {
      await apiCall("/api/test", {});
    } catch (e) {
      const err = e as ApiCallError;
      expect(err.status).toBe(500);
      expect(err.code).toBe("upstream");
    }
  });

  it("retries once on 401 when an auth store is active", async () => {
    let apiCallCount = 0;
    let sessionCallCount = 0;

    server.use(
      http.post("/api/test", () => {
        apiCallCount++;
        if (apiCallCount === 1) {
          return HttpResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        return HttpResponse.json({ ok: true });
      }),
      http.get("/api/auth/get-session", () => {
        sessionCallCount++;
        return HttpResponse.json({
          user: {
            id: "u",
            username: "u",
            email: "u@example.com",
          },
          session: { token: "", expiresAt: new Date().toISOString() },
        });
      }),
    );

    installAuthStore();

    const result = await apiCall<{ ok: boolean }>("/api/test", {});
    expect(result).toEqual({ ok: true });
    expect(apiCallCount).toBe(2);
    expect(sessionCallCount).toBe(1);
  });

  it("coalesces concurrent 401 refreshes into a single refresh call", async () => {
    let apiCallCount = 0;
    let sessionCallCount = 0;

    server.use(
      http.post("/api/test", () => {
        apiCallCount++;
        if (apiCallCount <= 2) {
          return HttpResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        return HttpResponse.json({ ok: true, call: apiCallCount });
      }),
      http.get("/api/auth/get-session", () => {
        sessionCallCount++;
        return HttpResponse.json({
          user: { id: "u", username: "u", email: "u@example.com" },
          session: { token: "", expiresAt: new Date().toISOString() },
        });
      }),
    );

    installAuthStore();

    const [r1, r2] = await Promise.all([
      apiCall<{ ok: boolean }>("/api/test", { id: 1 }),
      apiCall<{ ok: boolean }>("/api/test", { id: 2 }),
    ]);

    expect(r1).toMatchObject({ ok: true });
    expect(r2).toMatchObject({ ok: true });
    expect(sessionCallCount).toBe(1);
  });

  it("returns the 401 response when no auth store is active", async () => {
    server.use(
      http.post("/api/test", () => {
        return HttpResponse.json({ error: "Unauthorized" }, { status: 401 });
      }),
    );

    setActiveAuthStore(null);

    try {
      await apiCall("/api/test", {});
    } catch (e) {
      const err = e as ApiCallError;
      expect(err.status).toBe(401);
      expect(err.code).toBe("unauthenticated");
    }
  });
});

describe("apiGet", () => {
  it("sends a GET with credentials and query params", async () => {
    server.use(
      http.get("/api/search", ({ request }) => {
        const url = new URL(request.url);
        return HttpResponse.json({
          q: url.searchParams.get("q"),
          limit: url.searchParams.get("limit"),
        });
      }),
    );

    const result = await apiGet<{ q: string; limit: string }>("/api/search", {
      q: "test",
      limit: 25,
    });

    expect(result).toEqual({ q: "test", limit: "25" });
  });

  it("omits undefined params", async () => {
    server.use(
      http.get("/api/search", ({ request }) => {
        const url = new URL(request.url);
        return HttpResponse.json({
          hasQ: url.searchParams.has("q"),
          hasLimit: url.searchParams.has("limit"),
        });
      }),
    );

    const result = await apiGet<{ hasQ: boolean; hasLimit: boolean }>(
      "/api/search",
      { q: "test", limit: undefined },
    );

    expect(result).toEqual({ hasQ: true, hasLimit: false });
  });

  it("forwards AbortSignal", async () => {
    server.use(
      http.get("/api/slow", async () => {
        await new Promise((r) => setTimeout(r, 5000));
        return HttpResponse.json({});
      }),
    );

    const controller = new AbortController();
    controller.abort();

    await expect(
      apiGet("/api/slow", undefined, { signal: controller.signal }),
    ).rejects.toThrow();
  });
});
