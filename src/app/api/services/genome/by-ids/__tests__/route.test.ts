import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { POST } from "../route";
import { mockNextRequest } from "@/test-helpers/api-route-helpers";

vi.mock("@/lib/auth", () => ({ getBvbrcAuthToken: vi.fn() }));
vi.mock("@/lib/env", () => ({
  getRequiredEnv: vi.fn(() => "http://mock-api"),
}));

async function json(res: Response) {
  return res.json();
}

describe("POST /api/services/genome/by-ids", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no auth token", async () => {
    const { getBvbrcAuthToken } = await import("@/lib/auth");
    vi.mocked(getBvbrcAuthToken).mockResolvedValue(undefined);

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
    const { getBvbrcAuthToken } = await import("@/lib/auth");
    vi.mocked(getBvbrcAuthToken).mockResolvedValue("token");

    const req = mockNextRequest({ method: "POST", body: { genome_ids: [] } });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ results: [] });
  });

  it("returns empty results when genome_ids is not an array", async () => {
    const { getBvbrcAuthToken } = await import("@/lib/auth");
    vi.mocked(getBvbrcAuthToken).mockResolvedValue("token");

    const req = mockNextRequest({
      method: "POST",
      body: { genome_ids: "not-an-array" },
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ results: [] });
  });

  it("returns empty results when all IDs are invalid (non-numeric)", async () => {
    const { getBvbrcAuthToken } = await import("@/lib/auth");
    vi.mocked(getBvbrcAuthToken).mockResolvedValue("token");

    const req = mockNextRequest({
      method: "POST",
      body: { genome_ids: ["abc", "!@#"] },
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ results: [] });
  });

  it("sanitizes IDs to only digits and dots", async () => {
    const { getBvbrcAuthToken } = await import("@/lib/auth");
    vi.mocked(getBvbrcAuthToken).mockResolvedValue("token");

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
    const { getBvbrcAuthToken } = await import("@/lib/auth");
    vi.mocked(getBvbrcAuthToken).mockResolvedValue("token");

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
    const { getBvbrcAuthToken } = await import("@/lib/auth");
    vi.mocked(getBvbrcAuthToken).mockResolvedValue("token");

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
    const { getBvbrcAuthToken } = await import("@/lib/auth");
    vi.mocked(getBvbrcAuthToken).mockResolvedValue("token");

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
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { getBvbrcAuthToken } = await import("@/lib/auth");
    vi.mocked(getBvbrcAuthToken).mockResolvedValue("token");

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
