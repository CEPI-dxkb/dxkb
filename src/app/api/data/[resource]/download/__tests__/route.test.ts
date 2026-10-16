// `server-only` throws outside Next's bundler; this route reaches it through
// `@/lib/data-api/server-policy`. Same neutralization as the gateway's spec.
vi.mock("server-only", () => ({}));

import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import {
  json,
  makeRouteContext,
  mockNextRequest,
  setTestSession,
} from "@/test-helpers/api-route-helpers";
import { maxDownloadRequestBytes } from "@/lib/data-api/downloads";
import { rateLimit } from "@/lib/rate-limit";

import { POST } from "../route";

const dataApiOrigin = "https://data.test";
const tsv = "Genome ID\tGenome Name\n1.1\tOne\n";

/** One client IP per test, so rate-limit buckets never spill between cases. */
let nextIpOctet = 20;
function freshIp(): string {
  nextIpOctet += 1;
  return `198.51.100.${String(nextIpOctet)}`;
}

const selection = {
  format: "tsv",
  scope: { kind: "selected", ids: ["1.1", "1.2"] },
  fileNameBase: "genome-selected",
  total: 2,
};

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
      url: `http://localhost:3019/api/data/${resource}/download`,
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

/** The native transport's form body: one `request` field holding the JSON. */
function formBody(value: unknown): string {
  return new URLSearchParams({ request: JSON.stringify(value) }).toString();
}

function captureUpstream(resource: string, respond: () => Response) {
  const seen: { accept: string | null; authorization: string | null; body: string }[] =
    [];
  server.use(
    http.post(`${dataApiOrigin}/${resource}/`, async ({ request }) => {
      seen.push({
        accept: request.headers.get("Accept"),
        authorization: request.headers.get("Authorization"),
        body: await request.text(),
      });
      return respond();
    }),
  );
  return seen;
}

/** Fails the test if the route reaches the upstream at all. */
function forbidUpstream() {
  const hit = vi.fn();
  server.use(
    http.all(`${dataApiOrigin}/*`, () => {
      hit();
      return HttpResponse.json({});
    }),
  );
  return hit;
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

describe("POST /api/data/[resource]/download", () => {
  it("streams the upstream file back as a private attachment", async () => {
    const seen = captureUpstream("genome", () => new Response(tsv));

    const response = await post({ body: selection });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "text/plain; charset=utf-8",
    );
    expect(response.headers.get("Content-Disposition")).toBe(
      `attachment; filename="genome-selected.txt"; filename*=UTF-8''genome-selected.txt`,
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Vary")).toBe("Cookie");
    // No nonce, no cookie: the buffered path does not poll for one.
    expect(response.headers.get("Set-Cookie")).toBeNull();
    expect(await response.text()).toBe(tsv);
    expect(seen).toEqual([
      {
        accept: "text/tsv",
        authorization: null,
        body: "in(genome_id,(1.1,1.2))&sort(+genome_id)&limit(2)",
      },
    ]);
  });

  it("passes a streamed body through without reading it first", async () => {
    let pulled = 0;
    captureUpstream(
      "genome",
      () =>
        new Response(
          new ReadableStream<Uint8Array>({
            pull(controller) {
              pulled += 1;
              controller.enqueue(new TextEncoder().encode(`row ${String(pulled)}\n`));
              if (pulled === 3) controller.close();
            },
          }),
        ),
    );

    const response = await post({ body: selection });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("row 1\nrow 2\nrow 3\n");
  });

  it("names the file in both header forms, keeping a non-ASCII name exact", async () => {
    captureUpstream("genome", () => new Response(tsv));

    const response = await post({
      body: { ...selection, format: "xlsx", fileNameBase: "génomes (2)" },
    });

    expect(response.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(response.headers.get("Content-Disposition")).toBe(
      `attachment; filename="g_nomes (2).xlsx"; filename*=UTF-8''g%C3%A9nomes%20%282%29.xlsx`,
    );
  });

  it("accepts the native transport's form and echoes its nonce in a cookie", async () => {
    setTestSession({ token: "secret", userId: "alice" });
    // The repository counts a query again before downloading it.
    server.use(
      http.get(`${dataApiOrigin}/genome/`, () =>
        HttpResponse.json({ response: { numFound: 20_000, docs: [] } }),
      ),
    );
    const seen = captureUpstream("genome", () => new Response(tsv));

    const response = await post({
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      rawBody: formBody({
        format: "csv",
        scope: { kind: "query", rql: "eq(genome_status,Complete)" },
        fileNameBase: "genome",
        total: 20_000,
        nonce: "abcdef0123456789",
      }),
    });

    expect(response.status).toBe(200);
    // Readable by script (no HttpOnly), short-lived, and never sent cross-site.
    const cookie = response.headers.get("Set-Cookie") ?? "";
    expect(cookie).toMatch(/^dxkb-download=abcdef0123456789; Path=\/;/);
    expect(cookie).toContain("Max-Age=60");
    expect(cookie).toContain("SameSite=strict");
    expect(cookie).not.toContain("HttpOnly");
    expect(seen).toEqual([
      {
        accept: "text/csv",
        // The form reaches the route with the session cookie, so the token
        // goes upstream from the server, never through the page.
        authorization: "secret",
        body: "eq(genome_status,Complete)&sort(+genome_id)&limit(2500000)",
      },
    ]);
  });

  it("answers a form's error as text, so the iframe can read it back", async () => {
    const hit = forbidUpstream();

    const response = await post({
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      rawBody: formBody({ ...selection, format: "protein-fasta" }),
    });

    expect(response.status).toBe(400);
    expect(response.headers.get("Content-Type")).toBe(
      "text/plain; charset=utf-8",
    );
    expect(JSON.parse(await response.text())).toEqual({
      error: "Protein FASTA downloads are not available for genome.",
      code: "invalid_request",
    });
    expect(hit).not.toHaveBeenCalled();
  });

  it("answers a genome selection with no contigs as an error, not an empty file", async () => {
    // Whole contigs stream through the form, which saves whatever it is sent.
    captureUpstream("genome_sequence", () => new Response(""));

    const response = await post({
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      rawBody: formBody({
        ...selection,
        format: "dna-fasta",
        nonce: "abcdef0123456789",
      }),
    });

    expect(response.status).toBe(404);
    expect(response.headers.get("Set-Cookie")).toBeNull();
    expect(JSON.parse(await response.text())).toEqual({
      error: "No DNA sequence is available for the requested records.",
      code: "not_found",
    });
  });

  it("rejects a form without its request field", async () => {
    const response = await post({
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      rawBody: "other=1",
    });

    expect(response.status).toBe(400);
    expect(JSON.parse(await response.text())).toEqual({
      error: "Request form must carry a request field.",
      code: "invalid_request",
    });
  });

  it("rejects an unknown resource before rate limiting or reading the body", async () => {
    const hit = forbidUpstream();

    const response = await post({ resource: "nope", body: selection });

    expect(response.status).toBe(404);
    await expect(json(response)).resolves.toEqual({
      error: "Unsupported data resource: nope",
      code: "not_found",
    });
    expect(hit).not.toHaveBeenCalled();
  });

  it("refuses visible columns the data service cannot select, rather than widening the file", async () => {
    const hit = forbidUpstream();

    const response = await post({
      resource: "strain",
      body: {
        ...selection,
        scope: { kind: "query" },
        fields: ["strain", "1_pb2"],
        fileNameBase: "strain",
      },
    });

    expect(response.status).toBe(400);
    await expect(json(response)).resolves.toEqual({
      error:
        "The data service cannot select 1_pb2; download every field instead.",
      code: "invalid_request",
    });
    expect(hit).not.toHaveBeenCalled();
  });

  it("answers an over-limit request with the reason the tile shows", async () => {
    const hit = forbidUpstream();

    const response = await post({
      body: { ...selection, format: "xlsx", scope: { kind: "query" }, total: 2_000_000 },
    });

    expect(response.status).toBe(400);
    await expect(json(response)).resolves.toEqual({
      error: "Over Excel's 1,048,576-row limit.",
      code: "invalid_request",
    });
    expect(hit).not.toHaveBeenCalled();
  });

  it("rejects a malformed JSON body", async () => {
    const response = await post({ rawBody: "{not json" });

    expect(response.status).toBe(400);
    await expect(json(response)).resolves.toEqual({
      error: "Request body must be valid JSON.",
      code: "invalid_request",
    });
  });

  it("admits a 10,000-id selection, over the other routes' caps, as one request", async () => {
    const seen = captureUpstream("genome_feature", () => new Response(">a\nACGT\n"));
    const ids = Array.from(
      { length: 10_000 },
      (_, index) => `PATRIC.11320.104417.MK788327.CDS.26.1726.fwd.${String(index)}`,
    );

    const response = await post({
      resource: "genome_feature",
      body: {
        format: "dna-fasta",
        scope: { kind: "selected", ids },
        fileNameBase: "genome_feature-selected",
        total: ids.length,
      },
    });

    expect(response.status).toBe(200);
    expect(seen).toHaveLength(1);
    expect(seen[0].body).toMatch(/^in\(feature_id,\(/);
    expect(seen[0].body).toContain(`${ids[9_999]}))&sort(+feature_id)&limit(10000)`);
  });

  it("rejects a declared oversized body without reading it", async () => {
    const stream = new ReadableStream<Uint8Array>({
      pull() {
        throw new Error("body must not be read past a declared oversize");
      },
    });

    const response = await post({
      headers: { "content-length": String(maxDownloadRequestBytes + 1) },
      rawBody: stream,
    });

    expect(response.status).toBe(413);
    await expect(json(response)).resolves.toEqual({
      error: "Request body is too large.",
      code: "invalid_request",
    });
  });

  it("rejects a body that exceeds the cap while streaming", async () => {
    const response = await post({
      rawBody: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(maxDownloadRequestBytes + 1).fill(98));
          controller.close();
        },
      }),
    });

    expect(response.status).toBe(413);
  });

  it("checks its own rate limit before doing any work", async () => {
    const ip = freshIp();
    for (let i = 0; i < 20; i++) rateLimit(`data-download:${ip}:genome`, 20, 60_000);
    const hit = forbidUpstream();

    const response = await POST(
      mockNextRequest({
        method: "POST",
        url: "http://localhost:3019/api/data/genome/download",
        headers: { "x-forwarded-for": ip },
        body: selection,
      }),
      makeRouteContext({ resource: "genome" }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toMatch(/^\d+$/);
    await expect(json(response)).resolves.toEqual({
      error: "Too many downloads. Please try again shortly.",
      code: "rate_limited",
    });
    expect(hit).not.toHaveBeenCalled();
  });

  it("puts a form's Retry-After in its text body, where the iframe can read it", async () => {
    const ip = freshIp();
    for (let i = 0; i < 20; i++) rateLimit(`data-download:${ip}:genome`, 20, 60_000);
    forbidUpstream();

    const response = await post({
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "x-forwarded-for": ip,
      },
      rawBody: formBody(selection),
    });

    expect(response.status).toBe(429);
    expect(response.headers.get("Content-Type")).toBe(
      "text/plain; charset=utf-8",
    );
    const retryAfter = Number(response.headers.get("Retry-After"));
    expect(retryAfter).toBeGreaterThan(0);
    expect(JSON.parse(await response.text())).toEqual({
      error: "Too many downloads. Please try again shortly.",
      code: "rate_limited",
      retryAfterMs: retryAfter * 1_000,
    });
  });

  it("keeps the upstream's own error message", async () => {
    captureUpstream("genome", () =>
      HttpResponse.json(
        { error: "Illegal character in query string" },
        { status: 400 },
      ),
    );

    const response = await post({ body: selection });

    expect(response.status).toBe(502);
    await expect(json(response)).resolves.toEqual({
      error: "Illegal character in query string",
      code: "upstream_error",
    });
  });

  it("reports a missing Data API configuration without naming the env var", async () => {
    delete process.env.DATA_API_URL;
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const response = await post({ body: selection });

    expect(response.status).toBe(500);
    await expect(json(response)).resolves.toEqual({
      error: "The data service is not configured for this deployment.",
      code: "not_configured",
    });
    expect(consoleError).toHaveBeenCalledWith(
      "Download gateway is not configured: set DATA_API_URL (or NEXT_PUBLIC_DATA_API).",
    );
    consoleError.mockRestore();
  });
});
