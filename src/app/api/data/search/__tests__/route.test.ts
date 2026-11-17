// `server-only` throws outside Next's bundler (see the gateway's route spec).
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
    expect(seen[0].body.genome).toEqual({
      dataType: "genome",
      accept: "application/solr+json",
      query:
        "keyword(influenza)&ne(genome_status,Deprecated)&limit(10)&sort(-score)",
    });
    expect(seen[0].authorization).toBeNull();
  });

  it("searches with the signed-in user's token, as the lists it links to do", async () => {
    setTestSession({ token: "secret", userId: "alice" });
    const seen = captureUpstream(() => HttpResponse.json({}));

    const response = await search({ keyword: "coli" });

    expect(response.status).toBe(200);
    expect(seen[0].authorization).toBe("secret");
  });

  it("adds the Taxonomy header's genome count for each taxon hit, in a second query", async () => {
    const taxonomy = {
      result: {
        response: {
          numFound: 2,
          docs: [
            { taxon_id: 11118, taxon_name: "Coronaviridae", genomes: 9_500_742 },
            { taxon_id: "11118" },
          ],
        },
      },
    };
    let calls = 0;
    const seen = captureUpstream(() => {
      calls += 1;
      return calls === 1
        ? HttpResponse.json({ taxonomy })
        : HttpResponse.json({
            "taxonGenomes:11118": {
              result: { response: { numFound: 9_471_991, docs: [] } },
            },
          });
    });

    const response = await search({ keyword: "Coronaviridae" });
    const body = await json<Record<string, unknown>>(response);

    expect(response.status).toBe(200);
    expect(seen).toHaveLength(2);
    expect(seen[1].body).toEqual({
      "taxonGenomes:11118": {
        dataType: "genome",
        accept: "application/solr+json",
        query:
          "and(eq(taxon_lineage_ids,11118),ne(genome_status,Deprecated))&select(genome_id)&limit(1)",
      },
    });
    expect(body).toEqual({
      taxonomy,
      "taxonGenomes:11118": {
        result: { response: { numFound: 9_471_991, docs: [] } },
      },
    });
  });

  it("never puts a taxon ID that is not all digits, or from a null doc, into the count query", async () => {
    let calls = 0;
    const seen = captureUpstream(() => {
      calls += 1;
      return calls === 1
        ? HttpResponse.json({
            taxonomy: {
              result: {
                response: {
                  numFound: 3,
                  docs: [
                    { taxon_id: "1),eq(genome_id,*" },
                    null,
                    { taxon_name: "No ID" },
                    { taxon_id: 694009 },
                  ],
                },
              },
            },
          })
        : HttpResponse.json({});
    });

    await search({ keyword: "corona" });

    expect(seen).toHaveLength(2);
    expect(Object.keys(seen[1].body)).toEqual(["taxonGenomes:694009"]);
  });

  it("still answers the type matches when the count query fails, leaving the counts out", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    let calls = 0;
    captureUpstream(() => {
      calls += 1;
      return calls === 1
        ? HttpResponse.json({
            taxonomy: {
              result: { response: { numFound: 1, docs: [{ taxon_id: 11118 }] } },
            },
          })
        : new HttpResponse("boom", { status: 500 });
    });

    const response = await search({ keyword: "Coronaviridae" });

    expect(response.status).toBe(200);
    expect(Object.keys(await json<object>(response))).toEqual(["taxonomy"]);
    expect(consoleError).toHaveBeenCalledWith(
      "search: taxon genome counts failed",
      expect.objectContaining({ status: 502 }),
    );
  });

  it("answers without the counts when the count query outlasts its short budget", async () => {
    shortenTimeouts();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    let calls = 0;
    const seen = captureUpstream(() => {
      calls += 1;
      return calls === 1
        ? HttpResponse.json({
            taxonomy: {
              result: { response: { numFound: 1, docs: [{ taxon_id: 11118 }] } },
            },
          })
        : neverRespond();
    });

    const response = await search({ keyword: "Coronaviridae" });

    expect(response.status).toBe(200);
    expect(seen).toHaveLength(2);
    expect(Object.keys(await json<object>(response))).toEqual(["taxonomy"]);
    expect(consoleError).toHaveBeenCalledWith(
      "search: taxon genome counts failed",
      expect.objectContaining({
        message: expect.stringContaining("timed out after 5 s") as unknown,
      }),
    );
  });

  it("keeps only count entries from the count answer, never replacing a type match", async () => {
    const taxonomy = {
      result: { response: { numFound: 1, docs: [{ taxon_id: 11118 }] } },
    };
    let calls = 0;
    captureUpstream(() => {
      calls += 1;
      return calls === 1
        ? HttpResponse.json({ taxonomy })
        : HttpResponse.json({
            taxonomy: { result: { response: { numFound: 0, docs: [] } } },
            "taxonGenomes:11118": {
              result: { response: { numFound: 7, docs: [] } },
            },
          });
    });

    const response = await search({ keyword: "Coronaviridae" });

    await expect(json(response)).resolves.toEqual({
      taxonomy,
      "taxonGenomes:11118": { result: { response: { numFound: 7, docs: [] } } },
    });
  });

  it("answers an aborted search as aborted even when only the count query is cut off", async () => {
    const controller = new AbortController();
    let calls = 0;
    captureUpstream(() => {
      calls += 1;
      if (calls === 2) controller.abort();
      return calls === 1
        ? HttpResponse.json({
            taxonomy: {
              result: { response: { numFound: 1, docs: [{ taxon_id: 11118 }] } },
            },
          })
        : neverRespond();
    });

    const response = await POST(
      mockNextRequest({
        method: "POST",
        url: "http://localhost:3019/api/data/search",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": freshIp(),
        },
        body: { keyword: "Coronaviridae" },
        signal: controller.signal,
      }),
    );

    expect(response.status).toBe(499);
    await expect(json(response)).resolves.toEqual({
      error: "Data request was aborted.",
      code: "aborted",
    });
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

  it("answers a gateway 504 as a 504, not a 502", async () => {
    server.use(
      http.post(
        queryUrl,
        () =>
          new HttpResponse(
            "<html><title>504 Gateway Time-out</title></html>",
            {
              status: 504,
              statusText: "Gateway Timeout",
              headers: { "Content-Type": "text/html" },
            },
          ),
      ),
    );

    const response = await search({ keyword: "coli" });

    expect(response.status).toBe(504);
    const body = await json<{ error: string; code: string }>(response);
    expect(body.code).toBe("upstream_timeout");
    expect(body.error).toContain("504 Gateway Time-out");
    expect(body.error).not.toContain("<");
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
