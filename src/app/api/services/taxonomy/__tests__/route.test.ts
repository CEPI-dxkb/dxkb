import { http, HttpResponse } from "msw";

import { UpstreamError } from "@/lib/api/upstream-failure";
import { server } from "@/test-helpers/msw-server";
import { settleBackgroundWork } from "@/test-helpers/settle";
import {
  connectTimeout,
  maintenancePage,
  neverRespond,
  shortenTimeouts,
} from "@/test-helpers/upstream-failures";
import { GET } from "../route";
import { json, mockNextRequest } from "@/test-helpers/api-route-helpers";

const originalWebsiteApiUrl = process.env.BVBRC_WEBSITE_API_URL;

function searchRequest() {
  return mockNextRequest({
    url: "http://localhost:3019/api/services/taxonomy",
    searchParams: { q: "test" },
  });
}

function taxonomyRequest(query: string) {
  return mockNextRequest({
    url: `http://localhost:3019/api/services/taxonomy?${query}`,
  });
}

/** Answers every upstream search with `respond`; returns each query string it received, in order. */
function serveSearches(respond: (params: URLSearchParams) => Response): string[] {
  const queries: string[] = [];
  server.use(
    http.get("http://mock-api/taxonomy", ({ request }) => {
      const url = new URL(request.url);
      queries.push(url.search.slice(1));
      return respond(url.searchParams);
    }),
  );
  return queries;
}

function advance(ms: number): void {
  vi.setSystemTime(Date.now() + ms);
}

beforeEach(() => {
  process.env.BVBRC_WEBSITE_API_URL = "http://mock-api";
});

afterEach(() => {
  if (originalWebsiteApiUrl === undefined) delete process.env.BVBRC_WEBSITE_API_URL;
  else process.env.BVBRC_WEBSITE_API_URL = originalWebsiteApiUrl;
  vi.useRealTimers();
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
    // A healthy upstream, so only the missing variable can fail the request.
    serveSearches(() => HttpResponse.json([]));
    delete process.env.BVBRC_WEBSITE_API_URL;

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

    expect(res.status).toBe(502);
    expect(await json(res)).toEqual(
      expect.objectContaining({ error: expect.any(String) as unknown }),
    );
  });
});

describe("GET /api/services/taxonomy error contract", () => {
  it.each([
    [503, 503, "upstream", "is unavailable (HTTP 503 Service Unavailable: down)."],
    [500, 502, "upstream", "is unavailable (HTTP 500 Internal Server Error: down)."],
    [400, 400, "validation", "rejected the request (HTTP 400 Bad Request: down)."],
    [404, 404, "not_found", "rejected the request (HTTP 404 Not Found: down)."],
  ])(
    "answers an upstream %i with status %i, code %s and the cause",
    async (upstreamStatus, status, code, cause) => {
      serveSearches(() => new HttpResponse("down", { status: upstreamStatus }));

      const res = await GET(searchRequest(), {});

      expect(res.status).toBe(status);
      expect(await json(res)).toEqual({
        error: `The BV-BRC taxonomy service ${cause}`,
        code,
      });
    },
  );
});

describe("GET /api/services/taxonomy shared cache", () => {
  function routeLogs(): unknown[][] {
    return vi
      .mocked(console.error)
      .mock.calls.filter(([message]) => message === "Taxonomy search failed:");
  }

  it("sends one upstream request for the same parameters in any order", async () => {
    const queries = serveSearches(() => HttpResponse.json([{ taxon_id: 561 }]));

    const first = await GET(taxonomyRequest("q=escherichia&fl=taxon_id"), {});
    const second = await GET(taxonomyRequest("fl=taxon_id&q=escherichia"), {});
    await settleBackgroundWork();

    expect(await json(first)).toEqual([{ taxon_id: 561 }]);
    expect(await json(second)).toEqual([{ taxon_id: 561 }]);
    expect(queries).toEqual(["fl=taxon_id&q=escherichia"]);
  });

  it("sends a request with any parameter the forms do not use upstream every time", async () => {
    const queries = serveSearches(() => HttpResponse.json([]));

    await GET(taxonomyRequest("q=*:*&rows=25000"), {});
    await GET(taxonomyRequest("q=*:*&rows=25000"), {});
    await GET(taxonomyRequest("q=coli&x=1"), {});
    await GET(taxonomyRequest("q=coli&x=1"), {});

    expect(queries).toEqual([
      "q=*%3A*&rows=25000",
      "q=*%3A*&rows=25000",
      "q=coli&x=1",
      "q=coli&x=1",
    ]);
  });

  it("caches a plain fl field list and sends an aliased, transformed or computed fl upstream every time", async () => {
    const queries = serveSearches(() => HttpResponse.json([]));
    const uncached = [
      "q=coli&fl=a:lineage_names,b:lineage_names",
      "q=coli&fl=taxon_id,[explain]",
      "q=coli&fl=sum(taxon_id,taxon_id)",
      "q=coli&fl=taxon_id&fl=a:taxon_name",
    ];

    for (const query of ["q=coli&fl=taxon_id,taxon_name", ...uncached]) {
      await GET(taxonomyRequest(query), {});
      await GET(taxonomyRequest(query), {});
    }
    await settleBackgroundWork();

    expect(queries).toEqual([
      "fl=taxon_id%2Ctaxon_name&q=coli",
      "fl=a%3Alineage_names%2Cb%3Alineage_names&q=coli",
      "fl=a%3Alineage_names%2Cb%3Alineage_names&q=coli",
      "fl=taxon_id%2C%5Bexplain%5D&q=coli",
      "fl=taxon_id%2C%5Bexplain%5D&q=coli",
      "fl=sum%28taxon_id%2Ctaxon_id%29&q=coli",
      "fl=sum%28taxon_id%2Ctaxon_id%29&q=coli",
      "fl=taxon_id&fl=a%3Ataxon_name&q=coli",
      "fl=taxon_id&fl=a%3Ataxon_name&q=coli",
    ]);
  });

  it("keeps repeated parameters in their relative order", async () => {
    const queries = serveSearches(() => HttpResponse.json([]));

    await GET(taxonomyRequest("q=coli&fq=species&fq=bacteria"), {});

    expect(queries).toEqual(["fq=species&fq=bacteria&q=coli"]);
  });

  it("caches a query up to 2048 characters and sends a longer one every time", async () => {
    const queries = serveSearches(() => HttpResponse.json([]));
    const longest = `q=${"a".repeat(2046)}`;
    const tooLong = `q=${"b".repeat(2047)}`;

    await GET(taxonomyRequest(longest), {});
    await GET(taxonomyRequest(longest), {});
    await GET(taxonomyRequest(tooLong), {});
    await GET(taxonomyRequest(tooLong), {});
    await settleBackgroundWork();

    expect(queries).toEqual([longest, tooLong, tooLong]);
  });

  it("answers a 503 from the cache for 60 s, then asks again", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const queries = serveSearches(() => maintenancePage());

    const first = await GET(searchRequest(), {});
    const firstBody = await json(first);
    advance(59_000);
    const second = await GET(searchRequest(), {});
    await settleBackgroundWork();

    expect(second.status).toBe(503);
    expect(await json(second)).toEqual(firstBody);
    expect(queries).toHaveLength(1);

    advance(2000);
    const stale = await GET(searchRequest(), {});
    expect(stale.status).toBe(503);
    await vi.waitFor(() => {
      expect(queries).toHaveLength(2);
      expect(routeLogs()).toHaveLength(2);
    });
  });

  it("answers a 500 as 502 from the cache for 60 s without opening the breaker", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const queries = serveSearches(() => new HttpResponse("down", { status: 500 }));

    const first = await GET(taxonomyRequest("q=escherichia"), {});
    advance(59_000);
    const second = await GET(taxonomyRequest("q=escherichia"), {});
    await settleBackgroundWork();

    const body = {
      error:
        "The BV-BRC taxonomy service is unavailable (HTTP 500 Internal Server Error: down).",
      code: "upstream",
    };
    expect(second.status).toBe(502);
    expect(await json(first)).toEqual(body);
    expect(await json(second)).toEqual(body);
    expect(queries).toEqual(["q=escherichia"]);

    await GET(taxonomyRequest("q=salmonella"), {});
    await GET(taxonomyRequest("q=listeria"), {});

    expect(queries).toEqual(["q=escherichia", "q=salmonella", "q=listeria"]);
  });

  it("opens the breaker on two 500s that each took half the 20 s budget", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const queries = serveSearches(() => {
      advance(10_000);
      return new HttpResponse("down", { status: 500 });
    });

    await GET(taxonomyRequest("q=escherichia"), {});
    const opener = await GET(taxonomyRequest("q=salmonella"), {});
    const fastFail = await GET(taxonomyRequest("q=listeria"), {});
    await settleBackgroundWork();

    expect(fastFail.status).toBe(502);
    expect(await json(fastFail)).toEqual(await json(opener));
    expect(queries).toEqual(["q=escherichia", "q=salmonella"]);
  });

  it("keeps the breaker closed on 500s that answered within half the budget", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const queries = serveSearches((params) => {
      advance(9_999);
      return params.get("q") === "listeria"
        ? HttpResponse.json([{ taxon_id: 1637 }])
        : new HttpResponse("down", { status: 500 });
    });

    await GET(taxonomyRequest("q=escherichia"), {});
    await GET(taxonomyRequest("q=salmonella"), {});
    const third = await GET(taxonomyRequest("q=listeria"), {});

    expect(third.status).toBe(200);
    expect(await json(third)).toEqual([{ taxon_id: 1637 }]);
    expect(queries).toEqual(["q=escherichia", "q=salmonella", "q=listeria"]);
  });

  it("keeps the breaker closed when a fast 500 falls between two slow ones", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const elapsedMs = new Map([
      ["escherichia", 10_000],
      ["salmonella", 9_999],
      ["shigella", 10_000],
    ]);
    const queries = serveSearches((params) => {
      const q = params.get("q") ?? "";
      advance(elapsedMs.get(q) ?? 0);
      return q === "listeria"
        ? HttpResponse.json([{ taxon_id: 1637 }])
        : new HttpResponse("down", { status: 500 });
    });

    for (const q of ["escherichia", "salmonella", "shigella"]) {
      expect((await GET(taxonomyRequest(`q=${q}`), {})).status).toBe(502);
    }
    const next = await GET(taxonomyRequest("q=listeria"), {});
    await settleBackgroundWork();

    expect(next.status).toBe(200);
    expect(queries).toEqual([
      "q=escherichia",
      "q=salmonella",
      "q=shigella",
      "q=listeria",
    ]);
  });

  it("answers an unreachable host from the cache for 60 s", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const queries = serveSearches(() => HttpResponse.error());

    const first = await GET(searchRequest(), {});
    advance(59_000);
    const second = await GET(searchRequest(), {});
    await settleBackgroundWork();

    expect(second.status).toBe(502);
    expect(await json(second)).toEqual(await json(first));
    expect(queries).toHaveLength(1);
  });

  it("fails a different query at once after two outages", async () => {
    const queries = serveSearches(() => maintenancePage());

    await GET(taxonomyRequest("q=escherichia"), {});
    const opener = await GET(taxonomyRequest("q=salmonella"), {});
    const fastFail = await GET(taxonomyRequest("q=listeria"), {});

    expect(fastFail.status).toBe(503);
    expect(await json(fastFail)).toEqual(await json(opener));
    expect(queries).toEqual(["q=escherichia", "q=salmonella"]);
  });

  it("neither caches a 400 nor counts it as an outage", async () => {
    const queries = serveSearches(
      () => new HttpResponse("undefined field", { status: 400 }),
    );

    const first = await GET(taxonomyRequest("fl=no_such_field"), {});
    const second = await GET(taxonomyRequest("fl=no_such_field"), {});
    const third = await GET(taxonomyRequest("fl=other_field"), {});

    expect(first.status).toBe(400);
    expect(await json(second)).toEqual(await json(first));
    expect(third.status).toBe(400);
    expect(queries).toEqual([
      "fl=no_such_field",
      "fl=no_such_field",
      "fl=other_field",
    ]);
  });

  it("logs each failed load once, and nothing for a cached failure or a fast-fail", async () => {
    serveSearches((params) =>
      params.get("q") === "salmonella" ? HttpResponse.error() : maintenancePage(),
    );

    await GET(taxonomyRequest("q=escherichia"), {});
    await GET(taxonomyRequest("q=escherichia"), {});
    await GET(taxonomyRequest("q=salmonella"), {});
    await GET(taxonomyRequest("q=listeria"), {});
    await settleBackgroundWork();

    expect(routeLogs()).toEqual([
      ["Taxonomy search failed:", expect.any(UpstreamError)],
      ["Taxonomy search failed:", expect.any(UpstreamError)],
    ]);
  });

  it("logs a foreground 4xx once, from the handler", async () => {
    serveSearches(() => new HttpResponse("bad", { status: 400 }));

    const res = await GET(taxonomyRequest("q=a&x=1"), {});
    await settleBackgroundWork();

    expect(res.status).toBe(400);
    expect(routeLogs()).toHaveLength(1);
    expect(routeLogs()[0]).toEqual([
      "Taxonomy search failed:",
      expect.objectContaining({
        message: expect.stringContaining("rejected the request") as unknown,
      }),
    ]);
  });

  it("logs a foreground 4xx on the cached path once", async () => {
    serveSearches(() => new HttpResponse("bad", { status: 400 }));

    const res = await GET(taxonomyRequest("fl=no_such_field"), {});
    await settleBackgroundWork();

    expect(res.status).toBe(400);
    expect(vi.mocked(console.error).mock.calls).toHaveLength(1);
  });

  it("logs a failure shared by concurrent requests once", async () => {
    const queries = serveSearches(() => new HttpResponse("bad", { status: 400 }));

    const [first, second] = await Promise.all([
      GET(taxonomyRequest("fl=no_such_field"), {}),
      GET(taxonomyRequest("fl=no_such_field"), {}),
    ]);
    await settleBackgroundWork();

    expect(first.status).toBe(400);
    expect(second.status).toBe(400);
    expect(queries).toHaveLength(1);
    expect(vi.mocked(console.error).mock.calls).toHaveLength(1);
  });

  it("logs a missing upstream URL once, from the handler", async () => {
    // A healthy upstream, so only the missing variable can fail the request.
    serveSearches(() => HttpResponse.json([]));
    delete process.env.BVBRC_WEBSITE_API_URL;

    const res = await GET(taxonomyRequest("q=noenv"), {});
    await settleBackgroundWork();

    expect(res.status).toBe(500);
    expect(routeLogs()).toHaveLength(1);
  });

  it("logs a non-JSON 200 body once, from the handler", async () => {
    serveSearches(
      () => new HttpResponse("not json", { headers: { "Content-Type": "text/plain" } }),
    );

    const res = await GET(taxonomyRequest("q=notjson"), {});
    await settleBackgroundWork();

    expect(res.status).toBe(500);
    expect(await json(res)).toEqual({ error: "Internal server error", code: "unknown" });
    expect(routeLogs()).toHaveLength(1);
  });

  it("logs a background-refresh 4xx once, from the cache", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    let fail = false;
    serveSearches(() =>
      fail ? new HttpResponse("bad", { status: 400 }) : HttpResponse.json([]),
    );

    await GET(taxonomyRequest("q=refresh400"), {});
    fail = true;
    advance(61 * 60 * 1000);
    const stale = await GET(taxonomyRequest("q=refresh400"), {});
    expect(stale.status).toBe(200);
    await vi.waitFor(() => {
      expect(vi.mocked(console.error).mock.calls).toHaveLength(1);
    });
    await settleBackgroundWork();

    expect(vi.mocked(console.error).mock.calls).toHaveLength(1);
    expect(vi.mocked(console.error).mock.calls[0]?.[0]).toEqual(
      expect.stringContaining("refresh of"),
    );
  });

  it("logs a foreground outage once and a cached outage never", async () => {
    serveSearches(() => maintenancePage());

    await GET(taxonomyRequest("q=out1"), {});
    await GET(taxonomyRequest("q=out1"), {});
    await settleBackgroundWork();

    expect(vi.mocked(console.error).mock.calls).toHaveLength(1);
  });

  it("logs nothing for a breaker fast-fail", async () => {
    serveSearches(() => maintenancePage());
    await GET(taxonomyRequest("q=out1"), {});
    await GET(taxonomyRequest("q=out2"), {});
    const before = vi.mocked(console.error).mock.calls.length;

    const fastFail = await GET(taxonomyRequest("q=out3"), {});
    await settleBackgroundWork();

    expect(fastFail.status).toBe(503);
    expect(vi.mocked(console.error).mock.calls).toHaveLength(before);
  });
});
