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
import { rateLimit } from "@/lib/rate-limit";
import { anonymousMemberRevalidateSeconds } from "@/lib/data-api/server-policy";

import { GET, POST } from "../route";

const dataApiOrigin = "https://data.test";

/**
 * Each test uses its own client IP so the shared in-memory rate-limit bucket
 * from one case never spills into the next — the same convention
 * `/api/taxonomy-tree/[operation]`'s spec uses.
 */
let nextIpOctet = 20;
function freshIp(): string {
  nextIpOctet += 1;
  return `203.0.113.${String(nextIpOctet)}`;
}

function get(
  resource = "genome",
  searchParams: Record<string, string> = {},
  headers: Record<string, string> = {},
) {
  return GET(
    mockNextRequest({
      url: `http://localhost:3019/api/data/${resource}`,
      searchParams,
      headers: { "x-forwarded-for": freshIp(), ...headers },
    }),
    makeRouteContext({ resource }),
  );
}

function post(
  opts: {
    resource?: string;
    body?: unknown;
    rawBody?: BodyInit;
    headers?: Record<string, string>;
  } = {},
) {
  const { resource = "genome", body, rawBody, headers = {} } = opts;
  return POST(
    mockNextRequest({
      method: "POST",
      url: `http://localhost:3019/api/data/${resource}`,
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": freshIp(),
        ...headers,
      },
      body,
      rawBody,
    }),
    makeRouteContext({ resource }),
  );
}

/**
 * Registers an upstream handler and records what the gateway actually sent.
 * A real MSW handler rather than a `fetch` stub: the request travels through
 * `ServerDataRepository`'s own header, Range and serialization code, so these
 * tests exercise the server boundary instead of a mock of it.
 */
function captureUpstream(resource: string, respond: () => Response) {
  const seen: { authorization: string | null; body: string }[] = [];
  server.use(
    http.all(`${dataApiOrigin}/${resource}/`, async ({ request }) => {
      seen.push({
        authorization: request.headers.get("Authorization"),
        body: await request.text(),
      });
      return respond();
    }),
  );
  return seen;
}

/**
 * A ReadableStream that only produces the next chunk when pulled, so tests
 * can prove a byte-capped reader gave up partway through instead of quietly
 * draining the whole thing first. `getPullCount` reports how many chunks were
 * actually produced; `wasCancelled` reports whether the consumer cancelled
 * the stream instead of reading it to completion.
 */
function createLazyStream(chunkCount: number, chunkSize: number) {
  let pullCount = 0;
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      pullCount += 1;
      if (pullCount > chunkCount) {
        controller.close();
        return;
      }
      controller.enqueue(new Uint8Array(chunkSize).fill(97));
    },
    cancel() {
      cancelled = true;
    },
  });
  return {
    stream,
    getPullCount: () => pullCount,
    wasCancelled: () => cancelled,
  };
}

const envVarNames = [
  "DATA_API_URL",
  "NEXT_PUBLIC_DATA_API",
  "E2E_MOCK_ENABLED",
] as const;
const originalEnv: Partial<Record<(typeof envVarNames)[number], string>> = {};

beforeEach(() => {
  for (const name of envVarNames) originalEnv[name] = process.env[name];
  process.env.DATA_API_URL = dataApiOrigin;
  delete process.env.NEXT_PUBLIC_DATA_API;
  delete process.env.E2E_MOCK_ENABLED;
});

afterEach(() => {
  for (const name of envVarNames) {
    if (originalEnv[name] === undefined)
      Reflect.deleteProperty(process.env, name);
    else process.env[name] = originalEnv[name];
  }
});

/**
 * The gateway's cache contract is its `Cache-Control` header. The upstream
 * `cache`/`next.revalidate` init is decided by the same `sharedCache` flag in
 * `resolveServerDataRepository` and asserted there (`server-policy.test.ts`,
 * through the repository's fetch seam) — Next's `next.revalidate` extension
 * does not survive the trip into a `Request`, so it is not observable from an
 * MSW handler. Consolidating the two made that split safe: one flag now drives
 * both, so the route's answer to a client cannot disagree with its request to
 * the upstream.
 */
const sharedMemberCacheControl = `public, max-age=0, s-maxage=${String(anonymousMemberRevalidateSeconds)}`;

describe("data gateway cache policy", () => {
  it("shares an anonymous member response for five minutes, with no token upstream", async () => {
    const seen = captureUpstream("genome", () =>
      HttpResponse.json([{ genome_id: "1.1" }]),
    );

    const response = await get("genome", { operation: "member", id: "1.1" });

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      sharedMemberCacheControl,
    );
    expect(response.headers.get("Vary")).toBe("Cookie");
    expect(seen).toEqual([
      expect.objectContaining({ authorization: null }),
    ]);
  });

  // The policy decision this task settled. A collection URL carries filters,
  // sort, page and keyword, so caching it would fill Next's data cache with
  // near-unique entries at a low hit rate — unlike a member URL, which is
  // keyed by one ID. An anonymous collection therefore gets the *private*
  // header even though nothing about the caller is private. A test that
  // passed under both policies would prove nothing, so this asserts the
  // header for an anonymous caller specifically.
  it("does not share an anonymous collection response", async () => {
    captureUpstream("genome", () =>
      HttpResponse.json({ response: { numFound: 0, docs: [] } }),
    );

    const response = await get("genome", { operation: "collection" });

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Vary")).toBe("Cookie");
  });

  it.each([
    ["member", { operation: "member", id: "1.1" }],
    ["collection", { operation: "collection" }],
  ])(
    "forwards the session token and marks an authenticated %s response private",
    async (_label, searchParams) => {
      setTestSession({ token: "secret", userId: "alice" });
      const seen = captureUpstream("genome", () =>
        HttpResponse.json(
          searchParams.operation === "member"
            ? [{ genome_id: "1.1" }]
            : { response: { numFound: 0, docs: [] } },
        ),
      );

      const response = await get("genome", searchParams);

      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      expect(seen).toEqual([
        expect.objectContaining({ authorization: "secret" }),
      ]);
    },
  );

  // The second half of the disagreement this task closed: the page factory
  // honoured `E2E_MOCK_ENABLED` and this route ignored it entirely, so the
  // same anonymous member read was cached on one path and not the other during
  // an E2E run. E2E responses are per-run fixture data and must never be
  // shared across runs.
  it("never shares a response during an E2E run, even an anonymous member one", async () => {
    process.env.E2E_MOCK_ENABLED = "1";
    captureUpstream("genome", () => HttpResponse.json([{ genome_id: "1.1" }]));

    const response = await get("genome", { operation: "member", id: "1.1" });

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
});

describe("data gateway admission and errors", () => {
  it("rejects an unknown resource before any upstream call", async () => {
    const response = await get("arbitrary");

    expect(response.status).toBe(404);
    await expect(json(response)).resolves.toMatchObject({ code: "not_found" });
  });

  it("rejects transport RQL that exceeds the validated bounds", async () => {
    const response = await get("genome", {
      operation: "collection",
      rql: "limit(999999)",
    });

    expect(response.status).toBe(400);
    await expect(json(response)).resolves.toMatchObject({
      code: "invalid_request",
    });
  });

  it("propagates safe upstream authorization errors", async () => {
    server.use(
      http.all(`${dataApiOrigin}/genome/`, () =>
        HttpResponse.json({ error: { msg: "Access denied" } }, { status: 403 }),
      ),
    );

    const response = await get("genome", {
      operation: "member",
      id: "private",
    });

    expect(response.status).toBe(403);
    await expect(json(response)).resolves.toEqual({
      error: "Access denied",
      code: "forbidden",
    });
  });

  it("names the missing configuration instead of the generic failure", async () => {
    delete process.env.DATA_API_URL;
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const response = await get("ppi", { operation: "collection" });

    // A misconfigured deployment used to reach the client as "The data service
    // request failed." from the catch-all, with nothing to act on. It now gets
    // its own stable message and `not_configured` code — distinct enough to act
    // on — while the env var name that names the actual fix goes to the
    // operator's log instead of to every unauthenticated caller.
    expect(response.status).toBe(500);
    const body = await json<{ error: string; code: string }>(response);
    expect(body).toEqual({
      error: "The data service is not configured for this deployment.",
      code: "not_configured",
    });
    expect(body.error).not.toContain("DATA_API_URL");
    expect(consoleError).toHaveBeenCalledWith(
      "Data API gateway is not configured: set DATA_API_URL (or NEXT_PUBLIC_DATA_API).",
    );
  });

  it("checks the rate limit before doing any GET work", async () => {
    const ip = freshIp();
    for (let i = 0; i < 120; i++) {
      rateLimit(`data:${ip}:genome`, 120, 60_000);
    }
    // A handler for the Data API origin, not a fetch stub: if the route
    // incorrectly proceeds past the rate limiter, this proves it by recording
    // the otherwise-unexpected upstream call. If it were missing entirely,
    // the shared MSW server's strict mode would already fail an unhandled
    // request to this origin — registering it here just makes the "backend
    // was never reached" assertion explicit.
    const backendHit = vi.fn();
    server.use(
      http.all(`${dataApiOrigin}/*`, () => {
        backendHit();
        return HttpResponse.json({});
      }),
    );

    const response = await GET(
      mockNextRequest({
        url: "http://localhost:3019/api/data/genome",
        searchParams: { operation: "collection" },
        headers: { "x-forwarded-for": ip },
      }),
      makeRouteContext({ resource: "genome" }),
    );

    expect(response.status).toBe(429);
    await expect(json(response)).resolves.toMatchObject({
      code: "rate_limited",
    });
    expect(backendHit).not.toHaveBeenCalled();
  });
});

describe("data gateway POST", () => {
  it("accepts bounded selected-row requests and serializes them as RQL", async () => {
    const seen = captureUpstream("genome", () =>
      HttpResponse.json([{ genome_id: "1.1" }]),
    );

    const response = await post({
      body: { operation: "selected", ids: ["1.1"] },
    });

    expect(response.status).toBe(200);
    await expect(json(response)).resolves.toEqual({
      rows: [{ genome_id: "1.1" }],
    });
    expect(seen).toEqual([
      expect.objectContaining({ body: "in(genome_id,(1.1))" }),
    ]);
  });

  it("rejects an unsupported POST operation", async () => {
    const response = await post({ body: { operation: "collection" } });

    expect(response.status).toBe(400);
    await expect(json(response)).resolves.toEqual({
      error: "POST supports selected and export operations only.",
      code: "invalid_request",
    });
  });

  const oversizedBodyContract = {
    error: "Request body is too large.",
    code: "invalid_request",
  };

  it("rejects a declared oversized POST body by Content-Length, without reading it", async () => {
    const stream = new ReadableStream<Uint8Array>({
      pull() {
        throw new Error(
          "body must not be read once Content-Length already exceeds the cap",
        );
      },
    });

    const response = await post({
      headers: { "content-length": "40000" },
      rawBody: stream,
    });

    expect(response.status).toBe(413);
    await expect(json(response)).resolves.toEqual(oversizedBodyContract);
  });

  it("rejects a chunked body over the cap with no Content-Length header, without fully consuming it", async () => {
    // 10 chunks of 5,000 bytes = 50,000 bytes, well over the 32,000 byte cap,
    // and no Content-Length header at all (as with chunked transfer).
    const { stream, getPullCount, wasCancelled } = createLazyStream(10, 5_000);

    const response = await post({ rawBody: stream });

    expect(response.status).toBe(413);
    await expect(json(response)).resolves.toEqual(oversizedBodyContract);
    // The reader gave up partway through and cancelled the stream instead of
    // draining all 10 chunks.
    expect(getPullCount()).toBeLessThan(10);
    expect(wasCancelled()).toBe(true);
  });

  it("rejects an understated Content-Length whose actual body exceeds the cap, with the same contract", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(40_000).fill(98));
        controller.close();
      },
    });

    const response = await post({
      headers: { "content-length": "10" }, // lies — real body is 40,000 bytes
      rawBody: stream,
    });

    expect(response.status).toBe(413);
    await expect(json(response)).resolves.toEqual(oversizedBodyContract);
  });

  it("checks the rate limit before reading the POST body", async () => {
    const ip = freshIp();
    // Exhaust the same bucket `limited()` will look up for this IP + resource.
    for (let i = 0; i < 120; i++) {
      rateLimit(`data:${ip}:genome`, 120, 60_000);
    }
    const stream = new ReadableStream<Uint8Array>({
      pull() {
        throw new Error(
          "POST body must not be read once the rate limit already rejected the request",
        );
      },
    });

    const response = await POST(
      mockNextRequest({
        method: "POST",
        url: "http://localhost:3019/api/data/genome",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": ip,
        },
        rawBody: stream,
      }),
      makeRouteContext({ resource: "genome" }),
    );

    expect(response.status).toBe(429);
    await expect(json(response)).resolves.toMatchObject({
      code: "rate_limited",
    });
  });

  it("still reports malformed JSON as a 400 after the byte-capped read", async () => {
    const response = await post({ rawBody: "{not valid json" });

    expect(response.status).toBe(400);
    await expect(json(response)).resolves.toEqual({
      error: "Request body must be valid JSON.",
      code: "invalid_request",
    });
  });
});
