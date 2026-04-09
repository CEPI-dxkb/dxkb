import { NextResponse } from "next/server";
import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { POST } from "../route";
import { json, mockNextRequest } from "@/test-helpers/api-route-helpers";

vi.mock("@/lib/auth/session", () => ({ requireAuthToken: vi.fn() }));
vi.mock("@/lib/env", () => ({
  getRequiredEnv: vi.fn(() => "http://mock-api"),
}));

import { requireAuthToken } from "@/lib/auth/session";
const mockRequireAuthToken = vi.mocked(requireAuthToken);

describe("POST /api/services/genome/validate-viral", () => {
  it("returns 401 when no auth token", async () => {
    mockRequireAuthToken.mockResolvedValue(
      NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    );

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
    mockRequireAuthToken.mockResolvedValue("token");

    const req = mockNextRequest({ method: "POST", body: { genome_ids: [] } });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ results: [] });
  });

  it("returns empty results when all IDs are invalid", async () => {
    mockRequireAuthToken.mockResolvedValue("token");

    const req = mockNextRequest({
      method: "POST",
      body: { genome_ids: ["abc", "xyz"] },
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ results: [] });
  });

  it("sanitizes IDs to digits and dots only", async () => {
    mockRequireAuthToken.mockResolvedValue("token");

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

  it("selects viral-specific fields", async () => {
    mockRequireAuthToken.mockResolvedValue("token");

    let capturedUrl: string | undefined;
    server.use(
      http.get("http://mock-api/genome/", ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json([]);
      }),
    );

    const req = mockNextRequest({
      method: "POST",
      body: { genome_ids: ["1.1"] },
    });
    await POST(req);

    expect(capturedUrl).toContain("select(genome_id,superkingdom,genome_length,contigs)");
  });

  it("sets limit to Math.min(ids.length, 5000)", async () => {
    mockRequireAuthToken.mockResolvedValue("token");

    let capturedUrl: string | undefined;
    server.use(
      http.get("http://mock-api/genome/", ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json([]);
      }),
    );

    const req = mockNextRequest({
      method: "POST",
      body: { genome_ids: ["1.1", "2.2", "3.3"] },
    });
    await POST(req);

    expect(capturedUrl).toContain("limit(3)");
  });

  it("returns results on success", async () => {
    mockRequireAuthToken.mockResolvedValue("token");

    const results = [
      { genome_id: "1.1", superkingdom: "Viruses", genome_length: 30000, contigs: 1 },
    ];
    server.use(
      http.get("http://mock-api/genome/", () => {
        return HttpResponse.json(results);
      }),
    );

    const req = mockNextRequest({
      method: "POST",
      body: { genome_ids: ["1.1"] },
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ results });
  });

  it("returns upstream error on non-ok response", async () => {
    mockRequireAuthToken.mockResolvedValue("token");

    server.use(
      http.get("http://mock-api/genome/", () => {
        return new HttpResponse("err", { status: 500 });
      }),
    );

    const req = mockNextRequest({
      method: "POST",
      body: { genome_ids: ["1.1"] },
    });
    const res = await POST(req);

    expect(res.status).toBe(500);
    expect(await json(res)).toEqual(
      expect.objectContaining({ error: expect.stringContaining("validation failed") }),
    );
  });
});
