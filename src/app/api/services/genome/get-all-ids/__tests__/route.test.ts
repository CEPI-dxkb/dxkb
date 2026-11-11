import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { POST } from "../route";
import {
  clearTestCookies,
  json,
  mockNextRequest,
  setTestSession,
} from "@/test-helpers/api-route-helpers";
vi.mock("@/lib/env", () => ({
  getRequiredEnv: vi.fn(() => "http://mock-api"),
}));

describe("POST /api/services/genome/get-all-ids", () => {
  beforeEach(() => {
    setTestSession();
  });

  it("returns 401 when no auth token", async () => {
    clearTestCookies();

    const req = mockNextRequest({ method: "POST", body: {} });
    const res = await POST(req, {});

    expect(res.status).toBe(401);
    expect(await json(res)).toEqual(
      expect.objectContaining({ error: "Authentication required" }),
    );
  });

  it("uses default limit of 10000 when no body", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get("http://mock-api/genome/", ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json([]);
      }),
    );

    const req = new (await import("next/server")).NextRequest(
      "http://localhost:3019/api/services/genome/get-all-ids",
      { method: "POST" },
    );
    await POST(req, {});

    expect(capturedUrl).toContain("limit(10000)");
  });

  it("clamps limit below 1 to 1", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get("http://mock-api/genome/", ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json([]);
      }),
    );

    const req = mockNextRequest({ method: "POST", body: { limit: 0 } });
    await POST(req, {});

    expect(capturedUrl).toContain("limit(1)");
  });

  it("clamps limit above 10000 to 10000", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get("http://mock-api/genome/", ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json([]);
      }),
    );

    const req = mockNextRequest({ method: "POST", body: { limit: 99999 } });
    await POST(req, {});

    expect(capturedUrl).toContain("limit(10000)");
  });

  it("returns results on success", async () => {
    const genomes = [{ genome_id: "1.1" }, { genome_id: "2.2" }];
    server.use(
      http.get("http://mock-api/genome/", () => {
        return HttpResponse.json(genomes);
      }),
    );

    const req = mockNextRequest({ method: "POST", body: { limit: 10 } });
    const res = await POST(req, {});

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ results: genomes });
  });

  it("returns empty array when backend responds with null", async () => {
    server.use(
      http.get("http://mock-api/genome/", () => {
        return HttpResponse.json(null);
      }),
    );

    const req = mockNextRequest({ method: "POST", body: {} });
    const res = await POST(req, {});

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ results: [] });
  });

  it("returns results from items envelope when backend wraps response in an object", async () => {
    const genomes = [{ genome_id: "1.1" }];
    server.use(
      http.get("http://mock-api/genome/", () => {
        return HttpResponse.json({ items: genomes });
      }),
    );

    const req = mockNextRequest({ method: "POST", body: {} });
    const res = await POST(req, {});

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ results: genomes });
  });

  it("returns upstream error on non-ok response", async () => {
    server.use(
      http.get("http://mock-api/genome/", () => {
        return new HttpResponse("err", { status: 500 });
      }),
    );

    const req = mockNextRequest({ method: "POST", body: {} });
    const res = await POST(req, {});

    expect(res.status).toBe(500);
    expect(await json(res)).toEqual(
      expect.objectContaining({ error: expect.stringContaining("failed") as unknown }),
    );
  });
});
