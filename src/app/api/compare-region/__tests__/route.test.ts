vi.mock("server-only", () => ({}));

import { delay, http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import {
  clearTestCookies,
  json,
  mockNextRequest,
  setTestSession,
} from "@/test-helpers/api-route-helpers";

const serviceUrl = "http://compare-region.test/services/compare_regions";

const rawRow = {
  beg: 0,
  end: 10000,
  genome_id: "1.1",
  org_name: "(0) Test genome",
  contig_length: 20000,
  pinned_peg: "fig|1.1.peg.1",
  pinned_peg_strand: "+",
  features: [
    { fid: "fig|1.1.peg.1", type: "peg", beg: 4000, end: 5000, strand: "+", reference_point: 5000 },
  ],
};

function request(searchParams: Record<string, string>, signal?: AbortSignal) {
  return mockNextRequest({
    url: "http://localhost:3019/api/compare-region",
    searchParams,
    signal,
  });
}

function rowsAnswer() {
  return HttpResponse.json({ jsonrpc: "2.0", id: 1, result: [[rawRow]] });
}

function rpcFailure(message: string) {
  return HttpResponse.json(
    { jsonrpc: "2.0", id: 1, error: { code: -32603, message } },
    { status: 500 },
  );
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("COMPARE_REGION_SERVICE_URL", serviceUrl);
  setTestSession({ token: "test-token" });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/compare-region", () => {
  it("answers the rows, privately", async () => {
    let authorization: string | null = null;
    server.use(
      http.post(serviceUrl, ({ request: upstream }) => {
        authorization = upstream.headers.get("Authorization");
        return HttpResponse.json({ jsonrpc: "2.0", id: 1, result: [[rawRow]] });
      }),
    );
    const { GET } = await import("../route");

    const res = await GET(request({ peg: "fig|1.1.peg.1" }));

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("Vary")).toBe("Cookie");
    const body = await json<{ rows: { genomeName: string }[] }>(res);
    expect(body.rows.map((row) => row.genomeName)).toEqual(["Test genome"]);
    expect(authorization).toBe("test-token");
  });

  it("calls anonymously without a session", async () => {
    clearTestCookies();
    let authorization: string | null = "unset";
    server.use(
      http.post(serviceUrl, ({ request: upstream }) => {
        authorization = upstream.headers.get("Authorization");
        return HttpResponse.json({ jsonrpc: "2.0", id: 1, result: [[rawRow]] });
      }),
    );
    const { GET } = await import("../route");

    expect((await GET(request({ peg: "fig|1.1.peg.1" }))).status).toBe(200);
    expect(authorization).toBeNull();
  });

  it("refuses an invalid request before calling the service", async () => {
    const { GET } = await import("../route");

    const res = await GET(request({ peg: "fig|1.1.peg.1", genomes: "7" }));

    expect(res.status).toBe(400);
    expect(await json(res)).toEqual({
      error: "Invalid compare region request.",
      code: "invalid_request",
    });
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("refuses a group filter to a caller who is not signed in", async () => {
    clearTestCookies();
    let called = false;
    server.use(
      http.post(serviceUrl, () => {
        called = true;
        return rowsAnswer();
      }),
    );
    const { GET } = await import("../route");
    const res = await GET(
      request({ peg: "fig|1.1.peg.1", filter: "genomeGroup", group: "/u@bvbrc/home/Genome Groups/G1" }),
    );
    expect(res.status).toBe(401);
    expect(await json(res)).toEqual({
      error: "Sign in to compare against a workspace group.",
      code: "unauthorized",
    });
    expect(called).toBe(false);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("passes a signed-in caller's group to the service", async () => {
    let options: unknown = null;
    server.use(
      http.post(serviceUrl, async ({ request: upstream }) => {
        options = ((await upstream.json()) as { params: unknown[] }).params.at(5);
        return rowsAnswer();
      }),
    );
    const { GET } = await import("../route");
    const res = await GET(
      request({ peg: "fig|1.1.peg.1", filter: "featureGroup", group: "/u@bvbrc/home/Feature Groups/F1" }),
    );
    expect(res.status).toBe(200);
    expect(options).toEqual({ feature_group: "/u@bvbrc/home/Feature Groups/F1" });
  });

  it("answers 400 for a group without a group filter", async () => {
    const { GET } = await import("../route");
    const res = await GET(request({ peg: "fig|1.1.peg.1", filter: "all", group: "/u@bvbrc/home/x" }));
    expect(res.status).toBe(400);
    expect(await json(res)).toEqual({
      error: "Invalid compare region request.",
      code: "invalid_request",
    });
  });

  it("answers an invalid group as invalid before asking a signed-out caller to sign in", async () => {
    clearTestCookies();
    const { GET } = await import("../route");
    const res = await GET(request({ peg: "fig|1.1.peg.1", filter: "genomeGroup", group: "relative/x" }));
    expect(res.status).toBe(400);
    expect(await json(res)).toEqual({
      error: "Invalid compare region request.",
      code: "invalid_request",
    });
  });

  it("passes the service's own error message through", async () => {
    server.use(http.post(serviceUrl, () => rpcFailure("peg not found in Solr")));
    const { GET } = await import("../route");

    const res = await GET(request({ peg: "fig|1.1.peg.1" }));

    expect(res.status).toBe(500);
    expect(await json(res)).toEqual({
      error: "peg not found in Solr",
      code: "upstream",
    });
  });

  it("answers 503 server_busy when too many requests are in line", async () => {
    server.use(
      http.post(serviceUrl, async () => {
        await delay(20);
        return rowsAnswer();
      }),
    );
    const { GET } = await import("../route");

    const responses = await Promise.all(
      Array.from({ length: 5 }, () => GET(request({ peg: "fig|1.1.peg.1" }))),
    );

    expect(responses.map((res) => res.status)).toEqual([200, 200, 200, 200, 503]);
    const refused = responses[4];
    expect(await json(refused)).toEqual({
      error:
        "The compare region service is busy with other requests. Please try again in a minute.",
      code: "server_busy",
    });
    expect(refused.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("answers 429 past ten requests a minute from one client", async () => {
    server.use(http.post(serviceUrl, () => rowsAnswer()));
    const { GET } = await import("../route");

    for (let call = 0; call < 10; call += 1) {
      expect((await GET(request({ peg: "fig|1.1.peg.1" }))).status).toBe(200);
    }
    const res = await GET(request({ peg: "fig|1.1.peg.1" }));

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toMatch(/^\d+$/);
    expect(await json(res)).toEqual({
      error: "Too many Compare Region requests. Please try again shortly.",
      code: "rate_limited",
    });
  });

  it("logs the requested gene on one line, whatever it holds", async () => {
    server.use(http.post(serviceUrl, () => rpcFailure("peg not found in Solr")));
    const { GET } = await import("../route");

    await GET(request({ peg: "fig|1.1.peg.1\r\nforged log line" }));

    expect(vi.mocked(console.error)).toHaveBeenCalledWith(
      'compare-region "fig|1.1.peg.1\\r\\nforged log line":',
      expect.anything(),
    );
  });

  it("logs nothing for a caller that left while it waited", async () => {
    server.use(
      http.post(serviceUrl, async () => {
        await delay(20);
        return rowsAnswer();
      }),
    );
    const { GET } = await import("../route");
    const leaving = new AbortController();

    const first = GET(request({ peg: "fig|1.1.peg.1" }));
    const second = GET(request({ peg: "fig|1.1.peg.2" }, leaving.signal));
    leaving.abort();

    expect((await first).status).toBe(200);
    expect((await second).status).toBe(500);
    expect(vi.mocked(console.error)).not.toHaveBeenCalled();
  });

  it("explains an unconfigured service without naming its variable", async () => {
    vi.stubEnv("COMPARE_REGION_SERVICE_URL", "");
    const { GET } = await import("../route");

    const res = await GET(request({ peg: "fig|1.1.peg.1" }));
    const body = await json<{ error: string }>(res);

    expect(res.status).toBe(503);
    expect(body.error).toBe(
      "The Compare Region Viewer is not configured on this server.",
    );
    expect(JSON.stringify(body)).not.toContain("COMPARE_REGION_SERVICE_URL");
  });
});
