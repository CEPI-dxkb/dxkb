import { http, HttpResponse } from "msw";

import { server } from "@/test-helpers/msw-server";
import { GET } from "../route";
import { json, mockNextRequest } from "@/test-helpers/api-route-helpers";

vi.mock("@/lib/env", () => ({
  getRequiredEnv: vi.fn(() => "http://mock-api"),
}));

describe("GET /api/services/taxonomy", () => {
  it("does not require auth", async () => {
    const taxData = { taxon_id: 1 };

    server.use(
      http.get("http://mock-api/taxonomy", () => {
        return HttpResponse.json(taxData);
      }),
    );

    const req = mockNextRequest({
      url: "http://localhost:3019/api/services/taxonomy",
      searchParams: { q: "test" },
    });
    const res = await GET(req);

    expect(res.status).toBe(200);
    // No 401 even though no auth mock
  });

  it("forwards query params to upstream API", async () => {
    let capturedUrl: string | undefined;

    server.use(
      http.get("http://mock-api/taxonomy", ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json([]);
      }),
    );

    const req = mockNextRequest({
      url: "http://localhost:3019/api/services/taxonomy",
      searchParams: { q: "escherichia", limit: "10" },
    });
    await GET(req);

    expect(capturedUrl).toContain("/taxonomy?");
    expect(capturedUrl).toContain("q=escherichia");
    expect(capturedUrl).toContain("limit=10");
  });

  it("returns data on success", async () => {
    const taxData = [{ taxon_id: 123, taxon_name: "E. coli" }];

    server.use(
      http.get("http://mock-api/taxonomy", () => {
        return HttpResponse.json(taxData);
      }),
    );

    const req = mockNextRequest({
      url: "http://localhost:3019/api/services/taxonomy",
      searchParams: { q: "test" },
    });
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual(taxData);
  });

  it("returns upstream error on non-ok response", async () => {
    server.use(
      http.get("http://mock-api/taxonomy", () => {
        return new HttpResponse("err", { status: 502 });
      }),
    );

    const req = mockNextRequest({
      url: "http://localhost:3019/api/services/taxonomy",
      searchParams: { q: "test" },
    });
    const res = await GET(req);

    expect(res.status).toBe(502);
    expect(await json(res)).toEqual(
      expect.objectContaining({
        error: expect.stringContaining("Taxonomy API error"),
      }),
    );
  });

  it("returns 500 on unexpected exception", async () => {
    server.use(
      http.get("http://mock-api/taxonomy", () => {
        return HttpResponse.error();
      }),
    );

    const req = mockNextRequest({
      url: "http://localhost:3019/api/services/taxonomy",
      searchParams: { q: "test" },
    });
    const res = await GET(req);

    expect(res.status).toBe(500);
    expect(await json(res)).toEqual(
      expect.objectContaining({ error: "Internal server error" }),
    );
  });
});
