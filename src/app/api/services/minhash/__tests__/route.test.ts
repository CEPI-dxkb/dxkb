import { http, HttpResponse } from "msw";
import { NextRequest } from "next/server";
import { server } from "@/test-helpers/msw-server";
import {
  clearTestCookies,
  json,
  setTestSession,
} from "@/test-helpers/api-route-helpers";

describe("POST /api/services/minhash", () => {
  beforeEach(() => {
    vi.resetModules();
    setTestSession();
  });

  it("returns 500 when MINHASH_SERVICE_URL is not set, naming it only in the server log", async () => {
    vi.stubEnv("MINHASH_SERVICE_URL", "");
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { POST } = await import("../route");
    const req = new NextRequest("http://localhost:3019/api/services/minhash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "test" }),
    });
    const res = await POST(req, {});

    expect(res.status).toBe(500);
    const body = await json(res);
    expect(body).toEqual({
      error:
        "Similar Genome Finder is unavailable right now: the search service is not configured on this server.",
      code: "unknown",
    });
    expect(JSON.stringify(body)).not.toContain("MINHASH_SERVICE_URL");
    expect(logged).toHaveBeenCalledWith(
      expect.stringContaining("MINHASH_SERVICE_URL"),
    );
    logged.mockRestore();
  });

  it("returns 400 on malformed JSON body", async () => {
    vi.stubEnv("MINHASH_SERVICE_URL", "http://mock-minhash");

    const { POST } = await import("../route");
    const req = new NextRequest("http://localhost:3019/api/services/minhash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json{{{",
    });
    const res = await POST(req, {});

    expect(res.status).toBe(400);
    expect(await json(res)).toEqual(
      expect.objectContaining({ error: "Malformed JSON" }),
    );
  });

  it("returns 400 when body is not an object", async () => {
    vi.stubEnv("MINHASH_SERVICE_URL", "http://mock-minhash");

    const { POST } = await import("../route");
    const req = new NextRequest("http://localhost:3019/api/services/minhash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify("just a string"),
    });
    const res = await POST(req, {});

    expect(res.status).toBe(400);
    expect(await json(res)).toEqual(
      expect.objectContaining({
        error: "Request body must be a JSON object",
      }),
    );
  });

  it("includes auth header when token is present", async () => {
    vi.stubEnv("MINHASH_SERVICE_URL", "http://mock-minhash");
    setTestSession({ token: "my-token" });

    const { POST } = await import("../route");

    let capturedHeaders: Headers | undefined;
    server.use(
      http.post("http://mock-minhash", ({ request }) => {
        capturedHeaders = request.headers;
        return HttpResponse.json({ result: "ok" });
      }),
    );

    const req = new NextRequest("http://localhost:3019/api/services/minhash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "test" }),
    });
    await POST(req, {});

    expect(capturedHeaders?.get("Authorization")).toBe("my-token");
  });

  it("returns 401 when no auth token", async () => {
    vi.stubEnv("MINHASH_SERVICE_URL", "http://mock-minhash");
    clearTestCookies();

    const { POST } = await import("../route");
    const req = new NextRequest("http://localhost:3019/api/services/minhash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "test" }),
    });
    const res = await POST(req, {});

    expect(res.status).toBe(401);
    expect(await json(res)).toEqual(
      expect.objectContaining({ error: "Authentication required" }),
    );
  });

  it("returns upstream error on non-ok response", async () => {
    vi.stubEnv("MINHASH_SERVICE_URL", "http://mock-minhash");

    const { POST } = await import("../route");

    server.use(
      http.post("http://mock-minhash", () => {
        return HttpResponse.json({ error: "bad request" }, { status: 400 });
      }),
    );

    const req = new NextRequest("http://localhost:3019/api/services/minhash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "test" }),
    });
    const res = await POST(req, {});

    expect(res.status).toBe(400);
    expect(await json(res)).toEqual(
      expect.objectContaining({ error: "bad request" }),
    );
  });

  it("returns data on success", async () => {
    vi.stubEnv("MINHASH_SERVICE_URL", "http://mock-minhash");

    const { POST } = await import("../route");

    const resultData = { result: [{ genome_id: "1.1", distance: 0.1 }] };
    server.use(
      http.post("http://mock-minhash", () => {
        return HttpResponse.json(resultData);
      }),
    );

    const req = new NextRequest("http://localhost:3019/api/services/minhash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "lookup", params: {} }),
    });
    const res = await POST(req, {});

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual(resultData);
  });
});
