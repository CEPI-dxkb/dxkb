import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { POST } from "../route";
import { json, mockNextRequest } from "@/test-helpers/api-route-helpers";

vi.mock("@/lib/auth", () => ({ getBvbrcAuthToken: vi.fn() }));
vi.mock("@/lib/env", () => ({
  getRequiredEnv: vi.fn(() => "http://mock-api"),
}));

import { getBvbrcAuthToken } from "@/lib/auth";
const mockGetToken = vi.mocked(getBvbrcAuthToken);

describe("POST /api/services/genome/by-ids", () => {
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

  it("returns empty results for empty genome_ids array", async () => {
    mockGetToken.mockResolvedValue("token");

    const req = mockNextRequest({ method: "POST", body: { genome_ids: [] } });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ results: [] });
  });

  it("returns empty results when genome_ids is not an array", async () => {
    mockGetToken.mockResolvedValue("token");

    const req = mockNextRequest({
      method: "POST",
      body: { genome_ids: "not-an-array" },
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ results: [] });
  });

  it("returns empty results when all IDs are invalid (non-numeric)", async () => {
    mockGetToken.mockResolvedValue("token");

    const req = mockNextRequest({
      method: "POST",
      body: { genome_ids: ["abc", "!@#"] },
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ results: [] });
  });

  it("sanitizes IDs to only digits and dots", async () => {
    mockGetToken.mockResolvedValue("token");

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
    await POST(req);

    expect(capturedUrl).toContain("in(genome_id,(123.45,67.89))");
  });

  it("sets limit to Math.min(ids.length, 100)", async () => {
    mockGetToken.mockResolvedValue("token");

    let capturedUrl: string | undefined;
    server.use(
      http.get("http://mock-api/genome/", ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json([]);
      }),
    );

    const ids = Array.from({ length: 3 }, (_, i) => `${i}.1`);
    const req = mockNextRequest({
      method: "POST",
      body: { genome_ids: ids },
    });
    await POST(req);

    expect(capturedUrl).toContain("limit(3)");
  });

  it("returns results from array response", async () => {
    mockGetToken.mockResolvedValue("token");

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
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ results: genomes });
  });

  it("returns results from {items} wrapper response", async () => {
    mockGetToken.mockResolvedValue("token");

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
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ results: genomes });
  });

  it("returns upstream error status on non-ok response", async () => {
    mockGetToken.mockResolvedValue("token");

    server.use(
      http.get("http://mock-api/genome/", () => {
        return new HttpResponse("error", { status: 502 });
      }),
    );

    const req = mockNextRequest({
      method: "POST",
      body: { genome_ids: ["1.1"] },
    });
    const res = await POST(req);

    expect(res.status).toBe(502);
    expect(await json(res)).toEqual(
      expect.objectContaining({ error: expect.stringContaining("failed") }),
    );
  });
});
