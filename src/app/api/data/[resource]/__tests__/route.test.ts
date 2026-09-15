import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { mockNextRequest } from "@/test-helpers/api-route-helpers";
import { rateLimit } from "@/lib/rate-limit";

const mocks = vi.hoisted(() => ({ readSession: vi.fn() }));
vi.mock("@/lib/auth/server/session", () => ({
  readSession: mocks.readSession,
}));

import { GET, POST } from "../route";

const originalFetch = global.fetch;

function context(resource = "genome") {
  return { params: Promise.resolve({ resource }) };
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

beforeEach(() => {
  process.env.DATA_API_URL = "https://data.test";
  mocks.readSession.mockResolvedValue(null);
});

afterEach(() => {
  global.fetch = originalFetch;
  delete process.env.DATA_API_URL;
});

describe("data gateway route", () => {
  it("caches anonymous members for five minutes", async () => {
    global.fetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify([{ genome_id: "1.1" }]), {
        headers: { "Content-Type": "application/json" },
      }),
    );
    const response = await GET(
      new NextRequest(
        "http://localhost/api/data/genome?operation=member&id=1.1",
        {
          headers: { "x-forwarded-for": "203.0.113.21" },
        },
      ),
      context(),
    );

    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=0, s-maxage=300",
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        cache: "force-cache",
        next: { revalidate: 300 },
      }),
    );
  });

  it("forwards authenticated sessions and prevents caching", async () => {
    mocks.readSession.mockResolvedValue({ token: "secret", userId: "alice" });
    global.fetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ response: { numFound: 0, docs: [] } })),
      );
    const response = await GET(
      new NextRequest("http://localhost/api/data/genome", {
        headers: { "x-forwarded-for": "203.0.113.22" },
      }),
      context(),
    );

    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const init = vi.mocked(global.fetch).mock.calls[0][1];
    expect(new Headers(init?.headers).get("Authorization")).toBe("secret");
    expect(init?.cache).toBe("no-store");
  });

  it("rejects unknown resources and transport RQL", async () => {
    const unknown = await GET(
      new NextRequest("http://localhost/api/data/arbitrary", {
        headers: { "x-forwarded-for": "203.0.113.23" },
      }),
      context("arbitrary"),
    );
    expect(unknown.status).toBe(404);

    const invalid = await GET(
      new NextRequest(
        "http://localhost/api/data/genome?operation=collection&rql=limit(999999)",
        { headers: { "x-forwarded-for": "203.0.113.24" } },
      ),
      context(),
    );
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toMatchObject({
      code: "invalid_request",
    });
  });

  it("propagates safe upstream authorization errors", async () => {
    global.fetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ error: { msg: "Access denied" } }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const response = await GET(
      new NextRequest(
        "http://localhost/api/data/genome?operation=member&id=private",
        { headers: { "x-forwarded-for": "203.0.113.26" } },
      ),
      context(),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Access denied",
      code: "forbidden",
    });
  });

  it("names the missing configuration instead of the generic failure", async () => {
    delete process.env.DATA_API_URL;
    delete process.env.NEXT_PUBLIC_DATA_API;
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const response = await GET(
      new NextRequest("http://localhost/api/data/ppi?operation=collection", {
        headers: { "x-forwarded-for": "203.0.113.27" },
      }),
      context("ppi"),
    );

    // A misconfigured deployment used to reach the client as "The data service
    // request failed." from the catch-all, with nothing to act on. It now gets
    // its own stable message and `not_configured` code — distinct enough to act
    // on — while the env var name that names the actual fix goes to the
    // operator's log instead of to every unauthenticated caller.
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "The data service is not configured for this deployment.",
      code: "not_configured",
    });
    expect(consoleError).toHaveBeenCalledWith(
      "Data API gateway is not configured: set DATA_API_URL (or NEXT_PUBLIC_DATA_API).",
    );
  });

  it("accepts bounded selected-row POST requests", async () => {
    global.fetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify([{ genome_id: "1.1" }])));
    const response = await POST(
      new NextRequest("http://localhost/api/data/genome", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "203.0.113.25",
        },
        body: JSON.stringify({ operation: "selected", ids: ["1.1"] }),
      }),
      context(),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ rows: [{ genome_id: "1.1" }] });
    expect(vi.mocked(global.fetch).mock.calls[0][1]?.body).toBe(
      "in(genome_id,(1.1))",
    );
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
    const response = await POST(
      mockNextRequest({
        method: "POST",
        url: "http://localhost/api/data/genome",
        headers: {
          "Content-Type": "application/json",
          "content-length": "40000",
          "x-forwarded-for": "203.0.113.40",
        },
        rawBody: stream,
      }),
      context(),
    );
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual(oversizedBodyContract);
  });

  it("rejects a chunked body over the cap with no Content-Length header, without fully consuming it", async () => {
    // 10 chunks of 5,000 bytes = 50,000 bytes, well over the 32,000 byte cap,
    // and no Content-Length header at all (as with chunked transfer).
    const { stream, getPullCount, wasCancelled } = createLazyStream(10, 5_000);
    const response = await POST(
      mockNextRequest({
        method: "POST",
        url: "http://localhost/api/data/genome",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "203.0.113.41",
        },
        rawBody: stream,
      }),
      context(),
    );
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual(oversizedBodyContract);
    // The reader gave up partway through and cancelled the stream instead of
    // draining all 10 chunks.
    expect(getPullCount()).toBeLessThan(10);
    expect(wasCancelled()).toBe(true);
  });

  it("rejects an understated Content-Length whose actual body exceeds the cap, with the same contract", async () => {
    const bytes = new Uint8Array(40_000).fill(98);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    });
    const response = await POST(
      mockNextRequest({
        method: "POST",
        url: "http://localhost/api/data/genome",
        headers: {
          "Content-Type": "application/json",
          "content-length": "10", // lies — real body is 40,000 bytes
          "x-forwarded-for": "203.0.113.42",
        },
        rawBody: stream,
      }),
      context(),
    );
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual(oversizedBodyContract);
  });

  it("checks the rate limit before reading the POST body", async () => {
    const ip = "203.0.113.43";
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
        url: "http://localhost/api/data/genome",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": ip,
        },
        rawBody: stream,
      }),
      context(),
    );
    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({
      code: "rate_limited",
    });
  });

  it("checks the rate limit before doing any GET work", async () => {
    const ip = "203.0.113.44";
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
      http.all("https://data.test/*", () => {
        backendHit();
        return HttpResponse.json({});
      }),
    );
    const response = await GET(
      mockNextRequest({
        url: "http://localhost/api/data/genome",
        searchParams: { operation: "collection" },
        headers: { "x-forwarded-for": ip },
      }),
      context(),
    );
    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({
      code: "rate_limited",
    });
    expect(backendHit).not.toHaveBeenCalled();
  });

  it("still reports malformed JSON as a 400 after the byte-capped read", async () => {
    const response = await POST(
      mockNextRequest({
        method: "POST",
        url: "http://localhost/api/data/genome",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "203.0.113.45",
        },
        rawBody: "{not valid json",
      }),
      context(),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Request body must be valid JSON.",
      code: "invalid_request",
    });
  });
});
