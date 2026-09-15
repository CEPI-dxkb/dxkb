import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ readSession: vi.fn() }));
vi.mock("@/lib/auth/server/session", () => ({
  readSession: mocks.readSession,
}));

import { GET, POST } from "../route";

const originalFetch = global.fetch;

function context(resource = "genome") {
  return { params: Promise.resolve({ resource }) };
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
});
