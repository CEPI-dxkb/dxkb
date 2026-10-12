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

describe("POST /api/services/genome/by-ids", () => {
  beforeEach(() => {
    setTestSession();
  });

  it("returns 401 when no auth token", async () => {
    clearTestCookies();

    const req = mockNextRequest({
      method: "POST",
      body: { genome_ids: ["1.1"] },
    });
    const res = await POST(req, {});

    expect(res.status).toBe(401);
    expect(await json(res)).toEqual(
      expect.objectContaining({ error: "Authentication required" }),
    );
  });

  it("returns empty results for empty genome_ids array", async () => {
    const req = mockNextRequest({ method: "POST", body: { genome_ids: [] } });
    const res = await POST(req, {});

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ results: [] });
  });

  it("returns empty results when genome_ids is not an array", async () => {
    const req = mockNextRequest({
      method: "POST",
      body: { genome_ids: "not-an-array" },
    });
    const res = await POST(req, {});

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ results: [] });
  });

  it("returns empty results when all IDs are invalid (non-numeric)", async () => {
    const req = mockNextRequest({
      method: "POST",
      body: { genome_ids: ["abc", "!@#"] },
    });
    const res = await POST(req, {});

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ results: [] });
  });

  it("sanitizes IDs to only digits and dots", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get("http://mock-api/genome/", ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json([]);
      }),
    );

    const req = mockNextRequest({
      method: "POST",
      body: { genome_ids: ["123.45", "abc", "67.89"] },
    });
    await POST(req, {});

    expect(capturedUrl).toContain("in(genome_id,(123.45,67.89))");
  });

  it("adds the requested extra fields to the select, once each", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get("http://mock-api/genome/", ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json([]);
      }),
    );

    const req = mockNextRequest({
      method: "POST",
      body: {
        genome_ids: ["1.1"],
        fields: ["genbank_accessions", "host_name", "strain"],
      },
    });
    await POST(req, {});

    expect(decodeURIComponent(capturedUrl ?? "")).toContain(
      "select(genome_id,genome_name,public,owner,reference_genome,strain,superkingdom,genbank_accessions,host_name)",
    );
  });

  it("drops extra field names that are not plain field identifiers", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get("http://mock-api/genome/", ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json([]);
      }),
    );

    const req = mockNextRequest({
      method: "POST",
      body: {
        genome_ids: ["1.1"],
        fields: ["host_name)&limit(25000", "a,b", 7, "isolation_country"],
      },
    });
    await POST(req, {});

    expect(decodeURIComponent(capturedUrl ?? "")).toContain(
      "select(genome_id,genome_name,public,owner,reference_genome,strain,superkingdom,isolation_country)&",
    );
  });

  it("sets limit to Math.min(ids.length, 100)", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get("http://mock-api/genome/", ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json([]);
      }),
    );

    const ids = Array.from({ length: 3 }, (_, i) => `${String(i)}.1`);
    const req = mockNextRequest({
      method: "POST",
      body: { genome_ids: ids },
    });
    await POST(req, {});

    expect(capturedUrl).toContain("limit(3)");
  });

  it("returns results from array response", async () => {
    const genomes = [{ genome_id: "1.1", genome_name: "Test" }];
    server.use(
      http.get("http://mock-api/genome/", () => {
        return HttpResponse.json(genomes);
      }),
    );

    const req = mockNextRequest({
      method: "POST",
      body: { genome_ids: ["1.1"] },
    });
    const res = await POST(req, {});

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ results: genomes });
  });

  it("returns results from {items} wrapper response", async () => {
    const genomes = [{ genome_id: "2.2", genome_name: "Test2" }];
    server.use(
      http.get("http://mock-api/genome/", () => {
        return HttpResponse.json({ items: genomes });
      }),
    );

    const req = mockNextRequest({
      method: "POST",
      body: { genome_ids: ["2.2"] },
    });
    const res = await POST(req, {});

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ results: genomes });
  });

  it("returns upstream error status on non-ok response", async () => {
    server.use(
      http.get("http://mock-api/genome/", () => {
        return new HttpResponse("error", { status: 502 });
      }),
    );

    const req = mockNextRequest({
      method: "POST",
      body: { genome_ids: ["1.1"] },
    });
    const res = await POST(req, {});

    expect(res.status).toBe(502);
    expect(await json(res)).toEqual(
      expect.objectContaining({ error: expect.stringContaining("failed") as unknown }),
    );
  });
});
