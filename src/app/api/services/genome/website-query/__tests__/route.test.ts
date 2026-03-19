import { http, HttpResponse } from "msw";

import { server } from "@/test-helpers/msw-server";
import { POST } from "../route";
import { json, mockNextRequest } from "@/test-helpers/api-route-helpers";

vi.hoisted(() => {
  process.env.BVBRC_WEBSITE_API_URL = "http://mock-website-api";
});

vi.mock("@/lib/auth/session", () => ({ getAuthToken: vi.fn() }));

vi.mock("csv-parse/sync", () => ({
  parse: vi.fn(() => [{ genome_id: "1", genome_name: "test" }]),
}));

import { getAuthToken } from "@/lib/auth/session";
const mockGetToken = vi.mocked(getAuthToken);

describe("POST /api/services/genome/website-query", () => {
  beforeEach(() => {
    vi.stubEnv("BVBRC_WEBSITE_API_URL", "http://mock-website-api");
  });

  it("returns 401 when no auth token", async () => {
    mockGetToken.mockResolvedValue(undefined);

    const req = mockNextRequest({
      method: "POST",
      body: { genome_ids: ["1.1"] },
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
    expect(await json(res)).toEqual(
      expect.objectContaining({ error: "Authentication required" }),
    );
  });

  it("returns empty results when genome_ids is empty", async () => {
    mockGetToken.mockResolvedValue("token");

    const req = mockNextRequest({ method: "POST", body: { genome_ids: [] } });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ results: [] });
  });

  it("escapes Solr special characters in IDs", async () => {
    mockGetToken.mockResolvedValue("token");

    let capturedBody: string | undefined;

    server.use(
      http.post("http://mock-website-api/genome/", async ({ request }) => {
        capturedBody = await request.text();
        return HttpResponse.json([]);
      }),
    );

    const req = mockNextRequest({
      method: "POST",
      body: { genome_ids: ["test+id"] },
    });
    await POST(req);

    // The + should be escaped
    expect(capturedBody).toContain("test%5C%2Bid");
  });

  it("caps rows to maxRows (25000)", async () => {
    mockGetToken.mockResolvedValue("token");

    let capturedBody: string | undefined;

    server.use(
      http.post("http://mock-website-api/genome/", async ({ request }) => {
        capturedBody = await request.text();
        return HttpResponse.json([]);
      }),
    );

    // Create more IDs than maxRows
    const manyIds = Array.from({ length: 30000 }, (_, i) => `${i}`);
    const req = mockNextRequest({
      method: "POST",
      body: { genome_ids: manyIds },
    });
    await POST(req);

    const params = new URLSearchParams(capturedBody ?? "");
    expect(params.get("rows")).toBe("25000");
  });

  it("returns results from JSON content-type response", async () => {
    mockGetToken.mockResolvedValue("token");

    const genomes = [{ genome_id: "1.1", genome_name: "G1" }];

    server.use(
      http.post("http://mock-website-api/genome/", () => {
        return HttpResponse.json(genomes);
      }),
    );

    const req = mockNextRequest({
      method: "POST",
      body: { genome_ids: ["1.1"] },
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ results: genomes });
  });

  it("returns results from CSV content-type response", async () => {
    mockGetToken.mockResolvedValue("token");

    server.use(
      http.post("http://mock-website-api/genome/", () => {
        return new HttpResponse("genome_id,genome_name\n1,test", {
          headers: { "content-type": "text/csv" },
        });
      }),
    );

    const req = mockNextRequest({
      method: "POST",
      body: { genome_ids: ["1"] },
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    // csv-parse/sync is mocked to return [{ genome_id: "1", genome_name: "test" }]
    expect(await json(res)).toEqual({
      results: [{ genome_id: "1", genome_name: "test" }],
    });
  });

  it("handles empty CSV response", async () => {
    mockGetToken.mockResolvedValue("token");

    const { parse } = await import("csv-parse/sync");
    vi.mocked(parse).mockReturnValue([]);

    server.use(
      http.post("http://mock-website-api/genome/", () => {
        return new HttpResponse("", {
          headers: { "content-type": "text/csv" },
        });
      }),
    );

    const req = mockNextRequest({
      method: "POST",
      body: { genome_ids: ["1"] },
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ results: [] });
  });

  it("returns upstream error on non-ok response", async () => {
    mockGetToken.mockResolvedValue("token");

    server.use(
      http.post("http://mock-website-api/genome/", () => {
        return new HttpResponse("err", { status: 503 });
      }),
    );

    const req = mockNextRequest({
      method: "POST",
      body: { genome_ids: ["1.1"] },
    });
    const res = await POST(req);

    expect(res.status).toBe(503);
    expect(await json(res)).toEqual(
      expect.objectContaining({ error: expect.stringContaining("failed") }),
    );
  });

  it("returns 500 on unexpected exception", async () => {
    mockGetToken.mockResolvedValue("token");

    server.use(
      http.post("http://mock-website-api/genome/", () => {
        return HttpResponse.error();
      }),
    );

    const req = mockNextRequest({
      method: "POST",
      body: { genome_ids: ["1.1"] },
    });
    const res = await POST(req);

    expect(res.status).toBe(500);
    expect(await json(res)).toEqual(
      expect.objectContaining({ error: "Internal server error" }),
    );
  });
});
