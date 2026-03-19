import { http, HttpResponse } from "msw";
import { NextRequest } from "next/server";
import { server } from "@/test-helpers/msw-server";
import { json } from "@/test-helpers/api-route-helpers";

vi.mock("@/lib/auth/session", () => ({ getAuthToken: vi.fn() }));

import { getAuthToken } from "@/lib/auth/session";
const mockGetToken = vi.mocked(getAuthToken);

describe("POST /api/services/minhash", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns 500 when MINHASH_SERVICE_URL is not set", async () => {
    vi.stubEnv("MINHASH_SERVICE_URL", "");

    const { POST } = await import("../route");
    const req = new NextRequest("http://localhost:3019/api/services/minhash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "test" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(500);
    expect(await json(res)).toEqual(
      expect.objectContaining({
        error: expect.stringContaining("MINHASH_SERVICE_URL"),
      }),
    );
  });

  it("returns 400 on malformed JSON body", async () => {
    vi.stubEnv("MINHASH_SERVICE_URL", "http://mock-minhash");

    const { POST } = await import("../route");
    const req = new NextRequest("http://localhost:3019/api/services/minhash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json{{{",
    });
    const res = await POST(req);

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
    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(await json(res)).toEqual(
      expect.objectContaining({
        error: "Request body must be a JSON object",
      }),
    );
  });

  it("includes auth header when token is present", async () => {
    vi.stubEnv("MINHASH_SERVICE_URL", "http://mock-minhash");

    const { POST } = await import("../route");
    mockGetToken.mockResolvedValue("my-token");

    let capturedHeaders: Headers | undefined;
    server.use(
      http.post("http://mock-minhash", async ({ request }) => {
        capturedHeaders = request.headers;
        return HttpResponse.json({ result: "ok" });
      }),
    );

    const req = new NextRequest("http://localhost:3019/api/services/minhash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "test" }),
    });
    await POST(req);

    expect(capturedHeaders?.get("Authorization")).toBe("my-token");
  });

  it("omits auth header when token is absent", async () => {
    vi.stubEnv("MINHASH_SERVICE_URL", "http://mock-minhash");

    const { POST } = await import("../route");
    mockGetToken.mockResolvedValue(undefined);

    let capturedHeaders: Headers | undefined;
    server.use(
      http.post("http://mock-minhash", async ({ request }) => {
        capturedHeaders = request.headers;
        return HttpResponse.json({ result: "ok" });
      }),
    );

    const req = new NextRequest("http://localhost:3019/api/services/minhash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "test" }),
    });
    await POST(req);

    expect(capturedHeaders?.get("Authorization")).toBeNull();
  });

  it("returns upstream error on non-ok response", async () => {
    vi.stubEnv("MINHASH_SERVICE_URL", "http://mock-minhash");

    const { POST } = await import("../route");
    mockGetToken.mockResolvedValue("token");

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
    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(await json(res)).toEqual(
      expect.objectContaining({ error: "bad request" }),
    );
  });

  it("returns data on success", async () => {
    vi.stubEnv("MINHASH_SERVICE_URL", "http://mock-minhash");

    const { POST } = await import("../route");
    mockGetToken.mockResolvedValue("token");

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
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual(resultData);
  });
});
