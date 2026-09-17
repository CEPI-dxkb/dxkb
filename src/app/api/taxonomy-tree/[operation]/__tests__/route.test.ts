// `server-only` throws unconditionally outside Next's bundler (it relies on a
// webpack alias swap that only exists in the real build); this route reaches it
// through `@/lib/data-api/server-policy`, so the guard is neutralized the same
// way `src/lib/phylogeny/__tests__/dataset-store.test.ts` does.
vi.mock("server-only", () => ({}));

import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import {
  json,
  makeRouteContext,
  mockNextRequest,
  setTestSession,
} from "@/test-helpers/api-route-helpers";

import { GET } from "../route";

const taxonomyUrl = "https://data.test/taxonomy/";

/**
 * Each test uses its own client IP so the shared in-memory rate-limit bucket
 * from one case never spills into the next.
 */
let nextIpOctet = 10;

function request(operation: string, query = "") {
  nextIpOctet += 1;
  return {
    request: mockNextRequest({
      url: `http://localhost:3019/api/taxonomy-tree/${operation}${query}`,
      headers: { "x-forwarded-for": `203.0.113.${String(nextIpOctet)}` },
    }),
    context: makeRouteContext({ operation }),
  };
}

function call(operation: string, query = "") {
  const built = request(operation, query);
  return GET(built.request, built.context);
}

beforeEach(() => {
  process.env.DATA_API_URL = "https://data.test";
});

afterEach(() => {
  delete process.env.DATA_API_URL;
});

describe("taxonomy tree route", () => {
  it("returns normalized rows for the children operation", async () => {
    server.use(
      http.get(taxonomyUrl, () =>
        HttpResponse.json(
          [{ taxon_id: 235, taxon_name: "Brucella abortus", genomes: 581 }],
          { headers: { "Content-Range": "items 0-0/1" } },
        ),
      ),
    );

    const response = await call("children", "?parentId=234");

    expect(response.status).toBe(200);
    await expect(json(response)).resolves.toEqual({
      rows: [{ taxon_id: "235", taxon_name: "Brucella abortus", genomes: 581 }],
    });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Vary")).toBe("Cookie");
  });

  it("returns normalized counts for the child-counts operation", async () => {
    server.use(
      http.get(
        taxonomyUrl,
        () =>
          new HttpResponse("[]", {
            headers: {
              facet_counts: JSON.stringify({
                facet_fields: { parent_id: ["235", 3] },
              }),
            },
          }),
      ),
    );

    const response = await call(
      "child-counts",
      "?parentId=235&parentId=236",
    );

    expect(response.status).toBe(200);
    await expect(json(response)).resolves.toEqual({ counts: { 235: 3 } });
  });

  it("forwards the session token to the upstream request", async () => {
    setTestSession({ token: "bvbrc-token" });
    let authorization: string | null = null;
    server.use(
      http.get(taxonomyUrl, ({ request: upstream }) => {
        authorization = upstream.headers.get("Authorization");
        return HttpResponse.json([], {
          headers: { "Content-Range": "items 0-0/0" },
        });
      }),
    );

    await call("children", "?parentId=234");

    expect(authorization).toBe("bvbrc-token");
  });

  it("rejects an unknown operation before it can mint a rate-limit bucket", async () => {
    const response = await call("children-of-children", "?parentId=234");

    expect(response.status).toBe(404);
    await expect(json(response)).resolves.toEqual({
      error: "Unsupported taxonomy tree operation: children-of-children",
      code: "not_found",
    });
  });

  it.each([
    ["missing", ""],
    ["non-numeric", "?parentId=abc"],
    ["zero", "?parentId=0"],
    ["negative", "?parentId=-4"],
    ["fractional", "?parentId=2.5"],
    ["wider than a safe integer", "?parentId=1234567890123456789"],
  ])("rejects a %s parentId", async (_case, query) => {
    const response = await call("children", query);

    expect(response.status).toBe(400);
    await expect(json(response)).resolves.toEqual({
      error: "parentId must be a positive integer.",
      code: "invalid_request",
    });
  });

  it("rejects child-counts with no parents", async () => {
    const response = await call("child-counts");

    expect(response.status).toBe(400);
    await expect(json(response)).resolves.toEqual({
      error: "At least one parentId is required.",
      code: "invalid_request",
    });
  });

  it("rejects more parents than the upstream in(...) clause accepts", async () => {
    const query = Array.from(
      { length: 501 },
      (_value, index) => `parentId=${String(index + 1)}`,
    ).join("&");

    const response = await call("child-counts", `?${query}`);

    expect(response.status).toBe(400);
    await expect(
      json<{ error: string }>(response),
    ).resolves.toMatchObject({
      error: "Child counts are limited to 500 parents per request.",
    });
  });

  it("passes a malformed facet payload through as a 502 with its own detail", async () => {
    server.use(
      http.get(taxonomyUrl, () => new HttpResponse("[]")),
    );

    const response = await call("child-counts", "?parentId=235");

    expect(response.status).toBe(502);
    await expect(json(response)).resolves.toEqual({
      error: "missing facet_counts header",
      code: "malformed_response",
    });
  });

  it("passes an unexpected facet parent through as a 502", async () => {
    server.use(
      http.get(
        taxonomyUrl,
        () =>
          new HttpResponse("[]", {
            headers: {
              facet_counts: JSON.stringify({
                facet_fields: { parent_id: ["999", 1] },
              }),
            },
          }),
      ),
    );

    const response = await call("child-counts", "?parentId=235");

    expect(response.status).toBe(502);
    await expect(json(response)).resolves.toEqual({
      error: "unexpected parent id 999",
      code: "malformed_response",
    });
  });

  it("keeps the upstream message instead of a generic failure", async () => {
    server.use(
      http.get(taxonomyUrl, () =>
        HttpResponse.json({ message: "viral branch unavailable" }, {
          status: 500,
        }),
      ),
    );

    const response = await call("children", "?parentId=10239");

    expect(response.status).toBe(502);
    await expect(json(response)).resolves.toEqual({
      error: "viral branch unavailable",
      code: "upstream_error",
    });
  });

  it("reports an aborted request as 499", async () => {
    server.use(http.get(taxonomyUrl, () => HttpResponse.json([])));
    nextIpOctet += 1;
    const controller = new AbortController();
    const nextRequest = mockNextRequest({
      url: "http://localhost:3019/api/taxonomy-tree/children?parentId=234",
      headers: { "x-forwarded-for": `203.0.113.${String(nextIpOctet)}` },
    });
    Object.defineProperty(nextRequest, "signal", {
      value: controller.signal,
    });
    controller.abort();

    const response = await GET(nextRequest, makeRouteContext({ operation: "children" }));

    expect(response.status).toBe(499);
    await expect(json(response)).resolves.toEqual({
      error: "Data request was aborted.",
      code: "aborted",
    });
  });

  it("names the missing configuration instead of the generic failure", async () => {
    delete process.env.DATA_API_URL;
    delete process.env.NEXT_PUBLIC_DATA_API;
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const response = await call("children", "?parentId=234");

    expect(response.status).toBe(500);
    await expect(json(response)).resolves.toEqual({
      error: "The data service is not configured for this deployment.",
      code: "not_configured",
    });
    // The env var name names the actual fix, so it goes to the operator's log
    // rather than to every unauthenticated caller — and the log names this
    // route, not the gateway, so an operator knows which one is unconfigured.
    expect(consoleError).toHaveBeenCalledWith(
      "Taxa Tree route is not configured: set DATA_API_URL (or NEXT_PUBLIC_DATA_API).",
    );
  });

  it("rate-limits a client that exceeds the per-minute budget", async () => {
    server.use(
      http.get(taxonomyUrl, () =>
        HttpResponse.json([], {
          headers: { "Content-Range": "items 0-0/0" },
        }),
      ),
    );
    const ip = "198.51.100.7";
    const fire = () =>
      GET(
        mockNextRequest({
          url: "http://localhost:3019/api/taxonomy-tree/children?parentId=234",
          headers: { "x-forwarded-for": ip },
        }),
        makeRouteContext({ operation: "children" }),
      );

    let last = await fire();
    for (let attempt = 1; attempt < 121 && last.status !== 429; attempt++) {
      last = await fire();
    }

    expect(last.status).toBe(429);
    expect(last.headers.get("Retry-After")).toBeTruthy();
    await expect(json(last)).resolves.toEqual({
      error: "Too many taxonomy requests. Please try again shortly.",
      code: "rate_limited",
    });
  });
});
