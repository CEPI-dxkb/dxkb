import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { GET } from "../route";
import { json, mockNextRequest } from "@/test-helpers/api-route-helpers";

vi.mock("@/lib/auth", () => ({ getBvbrcAuthToken: vi.fn() }));
vi.mock("@/lib/env", () => ({
  getRequiredEnv: vi.fn(() => "http://mock-api"),
}));

import { getBvbrcAuthToken } from "@/lib/auth";
const mockGetToken = vi.mocked(getBvbrcAuthToken);

describe("GET /api/services/genome/search", () => {
  it("returns 401 when no auth token", async () => {
    mockGetToken.mockResolvedValue(undefined);

    const req = mockNextRequest({
      url: "http://localhost:3019/api/services/genome/search",
      searchParams: { q: "test" },
    });
    const res = await GET(req);

    expect(res.status).toBe(401);
    expect(await json(res)).toEqual(
      expect.objectContaining({ error: "Authentication required" }),
    );
  });

  it("returns all genomes (no wildcard filter) when query is blank", async () => {
    mockGetToken.mockResolvedValue("token");

    let capturedUrl: string | undefined;
    server.use(
      http.get("http://mock-api/genome/", ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json([]);
      }),
    );

    const req = mockNextRequest({
      url: "http://localhost:3019/api/services/genome/search",
      searchParams: { q: "" },
    });
    await GET(req);

    expect(capturedUrl).not.toContain("genome_name,*");
    expect(capturedUrl).toContain("or(eq(public,true),eq(public,false))");
  });

  it("sanitizes special characters from query", async () => {
    mockGetToken.mockResolvedValue("token");

    let capturedUrl: string | undefined;
    server.use(
      http.get("http://mock-api/genome/", ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json([]);
      }),
    );

    const req = mockNextRequest({
      url: "http://localhost:3019/api/services/genome/search",
      searchParams: { q: "test@#$123" },
    });
    await GET(req);

    expect(capturedUrl).toContain("*test123*");
  });

  it("returns empty results when query is only special chars (sanitized to empty)", async () => {
    mockGetToken.mockResolvedValue("token");

    let handlerCalled = false;
    server.use(
      http.get("http://mock-api/genome/", () => {
        handlerCalled = true;
        return HttpResponse.json([]);
      }),
    );

    const req = mockNextRequest({
      url: "http://localhost:3019/api/services/genome/search",
      searchParams: { q: "@#$%^" },
    });
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ results: [] });
    expect(handlerCalled).toBe(false);
  });

  it("clamps limit to 1-50 range with default 25", async () => {
    mockGetToken.mockResolvedValue("token");

    const capturedUrls: string[] = [];
    server.use(
      http.get("http://mock-api/genome/", ({ request }) => {
        capturedUrls.push(request.url);
        return HttpResponse.json([]);
      }),
    );

    // Default limit
    const req1 = mockNextRequest({
      url: "http://localhost:3019/api/services/genome/search",
      searchParams: { q: "test" },
    });
    await GET(req1);
    expect(capturedUrls[0]).toContain("limit(25)");

    // Below min
    const req2 = mockNextRequest({
      url: "http://localhost:3019/api/services/genome/search",
      searchParams: { q: "test", limit: "0" },
    });
    await GET(req2);
    expect(capturedUrls[1]).toContain("limit(1)");

    // Above max
    const req3 = mockNextRequest({
      url: "http://localhost:3019/api/services/genome/search",
      searchParams: { q: "test", limit: "100" },
    });
    await GET(req3);
    expect(capturedUrls[2]).toContain("limit(50)");
  });

  it("wraps sanitized query with wildcards", async () => {
    mockGetToken.mockResolvedValue("token");

    let capturedUrl: string | undefined;
    server.use(
      http.get("http://mock-api/genome/", ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json([]);
      }),
    );

    const req = mockNextRequest({
      url: "http://localhost:3019/api/services/genome/search",
      searchParams: { q: "ecoli" },
    });
    await GET(req);

    expect(capturedUrl).toContain("*ecoli*");
  });

  it("returns results on success", async () => {
    mockGetToken.mockResolvedValue("token");

    const genomes = [{ genome_id: "1.1", genome_name: "E. coli" }];
    server.use(
      http.get("http://mock-api/genome/", () => {
        return HttpResponse.json(genomes);
      }),
    );

    const req = mockNextRequest({
      url: "http://localhost:3019/api/services/genome/search",
      searchParams: { q: "ecoli" },
    });
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ results: genomes });
  });

  it("handles {items} wrapper response", async () => {
    mockGetToken.mockResolvedValue("token");

    const genomes = [{ genome_id: "2.2" }];
    server.use(
      http.get("http://mock-api/genome/", () => {
        return HttpResponse.json({ items: genomes });
      }),
    );

    const req = mockNextRequest({
      url: "http://localhost:3019/api/services/genome/search",
      searchParams: { q: "test" },
    });
    const res = await GET(req);

    expect(await json(res)).toEqual({ results: genomes });
  });

  it("returns upstream error status on non-ok response", async () => {
    mockGetToken.mockResolvedValue("token");

    server.use(
      http.get("http://mock-api/genome/", () => {
        return new HttpResponse("error", { status: 503 });
      }),
    );

    const req = mockNextRequest({
      url: "http://localhost:3019/api/services/genome/search",
      searchParams: { q: "test" },
    });
    const res = await GET(req);

    expect(res.status).toBe(503);
    expect(await json(res)).toEqual(
      expect.objectContaining({ error: expect.stringContaining("failed") }),
    );
  });
});
