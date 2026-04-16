import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { apiCall, apiGet, setAuthRefreshCallback } from "../client";
import { ApiCallError } from "../types";

describe("apiCall", () => {
  it("sends a POST with credentials and JSON content-type", async () => {
    let capturedHeaders: Headers | null = null;

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
        return new HttpResponse(null, { status: 500, statusText: "Internal Server Error" });
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

  it("retries once on 401 if refreshAuth is registered", async () => {
    let callCount = 0;
    server.use(
      http.post("/api/test", () => {
        callCount++;
        if (callCount === 1) {
          return HttpResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        return HttpResponse.json({ ok: true });
      }),
    );

    const mockRefresh = vi.fn().mockResolvedValue(undefined);
    setAuthRefreshCallback(mockRefresh);

    const result = await apiCall<{ ok: boolean }>("/api/test", {});
    expect(result).toEqual({ ok: true });
    expect(mockRefresh).toHaveBeenCalledOnce();
    expect(callCount).toBe(2);

    setAuthRefreshCallback(null);
  });

  it("throws on 401 if retry also fails", async () => {
    server.use(
      http.post("/api/test", () => {
        return HttpResponse.json({ error: "Unauthorized" }, { status: 401 });
      }),
    );

    const mockRefresh = vi.fn().mockResolvedValue(undefined);
    setAuthRefreshCallback(mockRefresh);

    await expect(apiCall("/api/test", {})).rejects.toThrow(ApiCallError);

    setAuthRefreshCallback(null);
  });

  it("coalesces concurrent 401 refreshes into a single call", async () => {
    let callCount = 0;
    server.use(
      http.post("/api/test", () => {
        callCount++;
        // First two calls return 401, retries succeed
        if (callCount <= 2) {
          return HttpResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        return HttpResponse.json({ ok: true, call: callCount });
      }),
    );

    const mockRefresh = vi.fn().mockResolvedValue(undefined);
    setAuthRefreshCallback(mockRefresh);

    const [r1, r2] = await Promise.all([
      apiCall<{ ok: boolean }>("/api/test", { id: 1 }),
      apiCall<{ ok: boolean }>("/api/test", { id: 2 }),
    ]);

    expect(r1).toEqual({ ok: true, call: 3 });
    expect(r2).toEqual({ ok: true, call: 4 });
    // The key assertion: refresh was called only once despite two concurrent 401s
    expect(mockRefresh).toHaveBeenCalledOnce();

    setAuthRefreshCallback(null);
  });

  it("throws on 401 without retry if no refreshAuth registered", async () => {
    server.use(
      http.post("/api/test", () => {
        return HttpResponse.json({ error: "Unauthorized" }, { status: 401 });
      }),
    );

    setAuthRefreshCallback(null);

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
