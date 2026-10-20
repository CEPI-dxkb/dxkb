// `server-only` throws outside Next's bundler; the route reaches it through
// `@/lib/data-api/server-policy` (see the gateway's own route spec).
vi.mock("server-only", () => ({}));

import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import {
  json,
  mockNextRequest,
  setTestSession,
} from "@/test-helpers/api-route-helpers";
import {
  connectTimeout,
  maintenancePage,
  maintenancePageHtml,
  maintenanceSummary,
  neverRespond,
  shortenTimeouts,
} from "@/test-helpers/upstream-failures";
import { allTermSearchTypes } from "@/constants/search-info";

import { POST } from "../route";

const dataApiOrigin = "https://data.test";
const queryUrl = `${dataApiOrigin}/query/`;

// One client IP per test, so the shared rate-limit bucket never spills over.
let nextIpOctet = 40;
function freshIp(): string {
  nextIpOctet += 1;
  return `203.0.113.${String(nextIpOctet)}`;
}

function search(body: unknown, rawBody?: BodyInit) {
  return POST(
    mockNextRequest({
      method: "POST",
      url: "http://localhost:3019/api/data/search",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": freshIp(),
      },
      body,
      rawBody,
    }),
  );
}

interface SeenRequest {
  contentType: string | null;
  authorization: string | null;
  body: Record<string, { dataType: string; accept: string; query: string }>;
}

function captureUpstream(respond: () => Response | Promise<Response>) {
  const seen: SeenRequest[] = [];
  server.use(
    http.post(queryUrl, async ({ request }) => {
      seen.push({
        contentType: request.headers.get("content-type"),
        authorization: request.headers.get("authorization"),
        body: (await request.json()) as SeenRequest["body"],
      });
      return respond();
    }),
  );
  return seen;
}

const envVarNames = ["DATA_API_URL", "NEXT_PUBLIC_DATA_API"] as const;
const originalEnv: Partial<Record<(typeof envVarNames)[number], string>> = {};

beforeEach(() => {
  for (const name of envVarNames) originalEnv[name] = process.env[name];
  process.env.DATA_API_URL = dataApiOrigin;
  delete process.env.NEXT_PUBLIC_DATA_API;
});

afterEach(() => {
  for (const name of envVarNames) {
    if (originalEnv[name] === undefined)
      Reflect.deleteProperty(process.env, name);
    else process.env[name] = originalEnv[name];
  }
  vi.restoreAllMocks();
});

describe("POST /api/data/search", () => {
  it("sends every DXKB type's query as one JSON multi-query and answers its matches", async () => {
    const matches = {
      genome: { result: { response: { docs: [], numFound: 12 } } },
    };
    const seen = captureUpstream(() => HttpResponse.json(matches));

    const response = await search({ keyword: "influenza" });

    expect(response.status).toBe(200);
    await expect(json(response)).resolves.toEqual(matches);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Vary")).toBe("Cookie");
    expect(seen).toHaveLength(1);
    expect(seen[0].contentType).toBe("application/json");
    expect(Object.keys(seen[0].body)).toEqual(
      allTermSearchTypes.map((type) => type.id),
    );
    expect(seen[0].body.taxonomy).toEqual({
      dataType: "taxonomy",
      accept: "application/solr+json",
      query: "keyword(influenza)&gt(genomes,1)&limit(10)&sort(-genomes)",
    });
    // Anonymous: no token is sent.
    expect(seen[0].authorization).toBeNull();
  });

  it("searches with the signed-in user's token, as the lists it links to do", async () => {
    setTestSession({ token: "secret", userId: "alice" });
    const seen = captureUpstream(() => HttpResponse.json({}));

    const response = await search({ keyword: "coli" });

    expect(response.status).toBe(200);
    expect(seen[0].authorization).toBe("secret");
  });

  it.each([
    ["a blank keyword", { keyword: "  " }, "Enter a search term."],
    ["only syntax", { keyword: '""' }, "Enter a search term."],
    [
      "an over-long keyword",
      { keyword: "a".repeat(501) },
      "Search needs a keyword of at most 500 characters.",
    ],
    [
      "no keyword",
      {},
      "Search needs a keyword of at most 500 characters.",
    ],
  ])("rejects %s without calling the Data API", async (_label, body, error) => {
    const seen = captureUpstream(() => HttpResponse.json({}));

    const response = await search(body);

    expect(response.status).toBe(400);
    await expect(json(response)).resolves.toEqual({
      error,
      code: "invalid_request",
    });
    expect(seen).toHaveLength(0);
  });

  it("rejects a body that is not JSON", async () => {
    const response = await search(undefined, "{not json");

    expect(response.status).toBe(400);
    await expect(json(response)).resolves.toEqual({
      error: "Request body must be valid JSON.",
      code: "invalid_request",
    });
  });

  it("answers a connect timeout as a 504 naming the data service", async () => {
    server.use(
      http.post(queryUrl, () => {
        throw connectTimeout();
      }),
    );

    const response = await search({ keyword: "coli" });

    expect(response.status).toBe(504);
    const body = await json<{ error: string; code: string }>(response);
    expect(body.code).toBe("upstream_timeout");
    expect(body.error).toMatch(
      /^The BV-BRC data service did not respond \(connection timed out after 10 s\)/,
    );
  });

  it("bounds a Data API that never answers by the data budget", async () => {
    shortenTimeouts();
    server.use(http.post(queryUrl, neverRespond));

    const response = await search({ keyword: "coli" });

    expect(response.status).toBe(504);
    const body = await json<{ error: string }>(response);
    expect(body.error).toContain("timed out after 20 s");
  });

  it("answers a maintenance page with its title, never its markup", async () => {
    server.use(http.post(queryUrl, () => maintenancePage()));

    const response = await search({ keyword: "coli" });

    expect(response.status).toBe(503);
    const body = await json<{ error: string; code: string }>(response);
    expect(body.code).toBe("service_unavailable");
    expect(body.error).toContain(maintenanceSummary);
    expect(body.error).not.toContain("<");
    expect(body.error).not.toContain(maintenancePageHtml.slice(0, 40));
  });

  it("reports an answer that is not keyed by type as malformed", async () => {
    server.use(http.post(queryUrl, () => HttpResponse.json([])));

    const response = await search({ keyword: "coli" });

    expect(response.status).toBe(502);
    await expect(json(response)).resolves.toEqual({
      error:
        "Malformed search response: expected an object keyed by data type.",
      code: "malformed_response",
    });
  });

  it("says the deployment is not configured, without naming the env var", async () => {
    delete process.env.DATA_API_URL;
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const response = await search({ keyword: "coli" });

    expect(response.status).toBe(500);
    await expect(json(response)).resolves.toEqual({
      error: "The data service is not configured for this deployment.",
      code: "not_configured",
    });
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("DATA_API_URL"),
    );
  });
});
