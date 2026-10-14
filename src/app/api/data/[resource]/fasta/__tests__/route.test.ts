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
import { rateLimit } from "@/lib/rate-limit";

import { POST } from "../route";

const dataApiOrigin = "https://data.test";
const record =
  ">fig|644340.17.peg.16| Flagellar biosynthesis protein FliQ\nMNEADALDIV\n";

/** One client IP per test, so rate-limit buckets never spill between cases. */
let nextIpOctet = 20;
function freshIp(): string {
  nextIpOctet += 1;
  return `198.51.100.${String(nextIpOctet)}`;
}

function post(
  opts: {
    resource?: string;
    body?: unknown;
    rawBody?: BodyInit;
    headers?: Record<string, string>;
  } = {},
) {
  const { resource = "genome_feature", body, rawBody, headers = {} } = opts;
  return POST(
    mockNextRequest({
      method: "POST",
      url: `http://localhost:3019/api/data/${resource}/fasta`,
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

/** A real upstream handler, so the request goes through the repository. */
function captureUpstream(resource: string, respond: () => Response) {
  const seen: {
    accept: string | null;
    authorization: string | null;
    body: string;
  }[] = [];
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

describe("POST /api/data/[resource]/fasta", () => {
  it("streams the upstream FASTA back as a private text download", async () => {
    const seen = captureUpstream(
      "genome_feature",
      () => new Response(record),
    );

    const response = await post({
      body: { type: "protein", ids: ["PATRIC.1", "PATRIC.1", "PATRIC.2"] },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "text/x-fasta; charset=utf-8",
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Vary")).toBe("Cookie");
    expect(await response.text()).toBe(record);
    // Validation dropped the duplicate before it reached the upstream.
    expect(seen).toEqual([
      {
        accept: "application/protein+fasta",
        authorization: null,
        body: "in(feature_id,(PATRIC.1,PATRIC.2))",
      },
    ]);
  });

  it("forwards the signed-in user's token, so private genomes download", async () => {
    setTestSession({ token: "secret", userId: "alice" });
    const seen = captureUpstream(
      "genome_sequence",
      () => new Response(">accn|X\nACGT\n"),
    );

    const response = await post({
      resource: "genome_sequence",
      body: { type: "dna", ids: ["1.1.con.0001"] },
    });

    expect(response.status).toBe(200);
    expect(seen).toEqual([
      expect.objectContaining({
        accept: "application/dna+fasta",
        authorization: "secret",
      }),
    ]);
  });

  it("answers an empty match with an empty body, leaving the message to the client", async () => {
    captureUpstream(
      "genome_feature",
      () => new Response("", { headers: { "Content-Range": "items 0-0/0" } }),
    );

    const response = await post({ body: { type: "dna", ids: ["missing"] } });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
  });

  it("rejects a resource with no FASTA before rate limiting or reading the body", async () => {
    const hit = forbidUpstream();

    const response = await post({
      resource: "genome",
      body: { type: "dna", ids: ["1.1"] },
    });

    expect(response.status).toBe(404);
    await expect(json(response)).resolves.toEqual({
      error: "FASTA downloads are not available for genome.",
      code: "not_found",
    });
    expect(hit).not.toHaveBeenCalled();
  });

  it("rejects a sequence type the resource cannot serve", async () => {
    const hit = forbidUpstream();

    const response = await post({
      resource: "genome_sequence",
      body: { type: "protein", ids: ["1.1.con.0001"] },
    });

    expect(response.status).toBe(400);
    await expect(json(response)).resolves.toEqual({
      error: "Protein FASTA is not available for genome_sequence.",
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

  it("rejects a declared oversized body without reading it", async () => {
    const stream = new ReadableStream<Uint8Array>({
      pull() {
        throw new Error("body must not be read past a declared oversize");
      },
    });

    const response = await post({
      headers: { "content-length": "40000" },
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
          controller.enqueue(new Uint8Array(40_000).fill(98));
          controller.close();
        },
      }),
    });

    expect(response.status).toBe(413);
  });

  it("checks its own rate limit before doing any work", async () => {
    const ip = freshIp();
    for (let i = 0; i < 30; i++) rateLimit(`data-fasta:${ip}:genome_feature`, 30, 60_000);
    const hit = forbidUpstream();

    const response = await POST(
      mockNextRequest({
        method: "POST",
        url: "http://localhost:3019/api/data/genome_feature/fasta",
        headers: { "x-forwarded-for": ip },
        body: { type: "dna", ids: ["PATRIC.1"] },
      }),
      makeRouteContext({ resource: "genome_feature" }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toMatch(/^\d+$/);
    await expect(json(response)).resolves.toEqual({
      error: "Too many sequence downloads. Please try again shortly.",
      code: "rate_limited",
    });
    expect(hit).not.toHaveBeenCalled();
  });

  it("keeps the upstream's own error message", async () => {
    captureUpstream("genome_feature", () =>
      HttpResponse.json({ error: "Invalid query near feature_id" }, {
        status: 400,
      }),
    );

    const response = await post({ body: { type: "dna", ids: ["PATRIC.1"] } });

    expect(response.status).toBe(502);
    await expect(json(response)).resolves.toEqual({
      error: "Invalid query near feature_id",
      code: "upstream_error",
    });
  });

  it("reports a missing Data API configuration without naming the env var", async () => {
    delete process.env.DATA_API_URL;
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const response = await post({ body: { type: "dna", ids: ["PATRIC.1"] } });

    expect(response.status).toBe(500);
    await expect(json(response)).resolves.toEqual({
      error: "The data service is not configured for this deployment.",
      code: "not_configured",
    });
    expect(consoleError).toHaveBeenCalledWith(
      "FASTA download gateway is not configured: set DATA_API_URL (or NEXT_PUBLIC_DATA_API).",
    );
    consoleError.mockRestore();
  });
});
