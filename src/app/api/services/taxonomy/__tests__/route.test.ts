import { http, HttpResponse } from "msw";

import { getRequiredEnv } from "@/lib/env";
import { server } from "@/test-helpers/msw-server";
import {
  connectTimeout,
  maintenancePage,
  neverRespond,
  shortenTimeouts,
} from "@/test-helpers/upstream-failures";
import { GET } from "../route";
import { json, mockNextRequest } from "@/test-helpers/api-route-helpers";

vi.mock("@/lib/env", () => ({
  getRequiredEnv: vi.fn(() => "http://mock-api"),
}));

function searchRequest() {
  return mockNextRequest({
    url: "http://localhost:3019/api/services/taxonomy",
    searchParams: { q: "test" },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

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
    const res = await GET(req, {});

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
    await GET(req, {});

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
    const res = await GET(req, {});

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
    const res = await GET(req, {});

    expect(res.status).toBe(502);
    expect(await json(res)).toEqual({
      error: "The BV-BRC taxonomy service is unavailable (HTTP 502 Bad Gateway: err).",
      code: "upstream",
    });
  });

  it("answers the maintenance page with its status and title, never its HTML", async () => {
    server.use(http.get("http://mock-api/taxonomy", () => maintenancePage()));

    const res = await GET(searchRequest(), {});

    expect(res.status).toBe(503);
    const body = await json<{ error: string }>(res);
    expect(body.error).toBe(
      "The BV-BRC taxonomy service is unavailable (HTTP 503 Service Unavailable: Site Maintenance — We’ll be back soon!).",
    );
    expect(body.error).not.toContain("<");
  });

  it("answers 504 when the upstream never responds, within its budget", async () => {
    shortenTimeouts();
    server.use(http.get("http://mock-api/taxonomy", neverRespond));

    const res = await GET(searchRequest(), {});

    expect(res.status).toBe(504);
    expect(await json(res)).toEqual(
      expect.objectContaining({
        error: "The BV-BRC taxonomy service did not respond (timed out after 20 s).",
      }),
    );
  });

  it("names the cause of a connect timeout instead of 'fetch failed'", async () => {
    server.use(
      http.get("http://mock-api/taxonomy", () => {
        throw connectTimeout();
      }),
    );

    const res = await GET(searchRequest(), {});

    expect(res.status).toBe(504);
    expect((await json<{ error: string }>(res)).error).toMatch(
      /did not respond \(connection timed out after 10 s\)/,
    );
  });

  it("never puts a configuration error's env var name in the body", async () => {
    vi.mocked(getRequiredEnv).mockImplementationOnce(() => {
      throw new Error("Missing required environment variable: BVBRC_WEBSITE_API_URL");
    });

    const res = await GET(searchRequest(), {});

    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toContain("BVBRC_WEBSITE_API_URL");
    expect(JSON.parse(text)).toEqual({ error: "Internal server error", code: "unknown" });
  });

  it("returns 502 when the upstream cannot be reached", async () => {
    server.use(
      http.get("http://mock-api/taxonomy", () => {
        return HttpResponse.error();
      }),
    );

    const req = mockNextRequest({
      url: "http://localhost:3019/api/services/taxonomy",
      searchParams: { q: "test" },
    });
    const res = await GET(req, {});

    // A network failure is an unreachable upstream, not a server bug.
    expect(res.status).toBe(502);
    expect(await json(res)).toEqual(
      expect.objectContaining({ error: expect.any(String) as unknown }),
    );
  });
});
