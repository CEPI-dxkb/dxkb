// `server-only` throws outside Next's bundler (same neutralization as the Genome Browser route test).
vi.mock("server-only", () => ({}));

import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { json, makeRouteContext, mockNextRequest } from "@/test-helpers/api-route-helpers";
import { GET } from "../route";

let nextIpOctet = 10;

function call(operation: string, query: string, clientIp?: string) {
  nextIpOctet += 1;
  return GET(
    mockNextRequest({
      url: `http://localhost:3019/api/circular-viewer/${operation}?${query}`,
      headers: { "x-forwarded-for": clientIp ?? `203.0.113.${String(nextIpOctet)}` },
    }),
    makeRouteContext({ operation }),
  );
}

function expectPrivateNoStore(response: Response) {
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("Vary")).toBe("Cookie");
}

beforeEach(() => {
  process.env.DATA_API_URL = "https://data.test";
});

afterEach(() => {
  delete process.env.DATA_API_URL;
});

describe("circular viewer route", () => {
  it("answers a genome's sequences, never shared-cached", async () => {
    server.use(
      http.get("https://data.test/genome_sequence/", () =>
        HttpResponse.json([
          { sequence_id: "s1", accession: "NC_000962", length: 4411532, gc_content: 65.61, topology: "circular" },
        ]),
      ),
    );
    const response = await call("contigs", "genomeId=83332.12");
    expect(response.status).toBe(200);
    expectPrivateNoStore(response);
    expect(await json(response)).toEqual({
      contigs: [
        { accession: "NC_000962", sequenceId: "s1", length: 4411532, gcContent: 65.61, topology: "circular" },
      ],
      truncated: false,
    });
  });

  it("answers a specialty-gene track through its features", async () => {
    server.use(
      http.get("https://data.test/sp_gene/", () =>
        HttpResponse.json([
          { id: "a", feature_id: "F1" },
          { id: "b", feature_id: "F1" },
        ]),
      ),
      http.post("https://data.test/genome_feature/", () =>
        HttpResponse.json([
          { feature_id: "F1", accession: "NC_000962", start: 5, end: 50, strand: "-", feature_type: "CDS" },
        ]),
      ),
    );
    const response = await call("track", "genomeId=83332.12&preset=amr");
    expect(await json(response)).toEqual({
      features: [
        { featureId: "F1", accession: "NC_000962", start: 5, end: 50, strand: "-", featureType: "CDS" },
      ],
      truncated: false,
    });
  });

  it("answers a specialty gene listed only by patric_id through a quoted, encoded in(patric_id,…) read", async () => {
    const featureQueries: string[] = [];
    server.use(
      // A CARD row: the gene is named by its patric_id alone.
      http.get("https://data.test/sp_gene/", () =>
        HttpResponse.json([{ id: "card", patric_id: "fig|83332.12.peg.7" }]),
      ),
      http.get("https://data.test/genome_feature/", ({ request }) => {
        featureQueries.push(new URL(request.url).search);
        return HttpResponse.json([
          { feature_id: "F7", patric_id: "fig|83332.12.peg.7", accession: "NC_000962", start: 70, end: 170, strand: "+", feature_type: "CDS" },
        ]);
      }),
    );
    const response = await call("track", "genomeId=83332.12&preset=amr");
    expect(featureQueries).toHaveLength(1);
    expect(featureQueries[0]).toContain(
      "?and(eq(genome_id,83332.12),in(patric_id,(%22fig%7C83332.12.peg.7%22)))&select(",
    );
    expect(decodeURIComponent(featureQueries[0])).toContain(
      'and(eq(genome_id,83332.12),in(patric_id,("fig|83332.12.peg.7")))',
    );
    expect(await json(response)).toEqual({
      features: [
        {
          featureId: "F7",
          patricId: "fig|83332.12.peg.7",
          accession: "NC_000962",
          start: 70,
          end: 170,
          strand: "+",
          featureType: "CDS",
        },
      ],
      truncated: false,
    });
  });

  it("answers GC windows computed from the sequences", async () => {
    server.use(
      http.get("https://data.test/genome_sequence/", () =>
        HttpResponse.json([{ sequence_id: "s1", accession: "A", length: 8, sequence: "GGCCAATT" }]),
      ),
    );
    const response = await call("gc", "genomeId=1.1");
    expect(await json(response)).toEqual({
      windowSize: 20,
      contigs: [{ accession: "A", length: 8, gc: [0.5], skew: [0] }],
    });
  });

  it("answers 422 genome_too_long for a genome over the GC limit, without downloading its sequences", async () => {
    const requested: string[] = [];
    server.use(
      http.get("https://data.test/genome_sequence/", ({ request }) => {
        requested.push(decodeURIComponent(new URL(request.url).search));
        return HttpResponse.json([{ sequence_id: "s1", accession: "A", length: 30_000_001 }]);
      }),
    );
    const response = await call("gc", "genomeId=1.1");
    expect(response.status).toBe(422);
    expectPrivateNoStore(response);
    const body = await json(response);
    expect(body).toEqual(expect.objectContaining({ code: "genome_too_long" }));
    expect(JSON.stringify(body)).toContain("30,000,001 bp long");
    expect(requested).toHaveLength(1);
    expect(requested[0]).toContain("select(sequence_id,accession,length)");
    expect(requested[0]).not.toContain("sequence)");
  });

  it("still answers 422 when the sequences outgrow lengths that fit", async () => {
    server.use(
      http.get("https://data.test/genome_sequence/", () =>
        HttpResponse.json([{ sequence_id: "s1", accession: "A", length: 5, sequence: "A".repeat(30_000_001) }]),
      ),
    );
    const response = await call("gc", "genomeId=1.1");
    expect(response.status).toBe(422);
    expect(JSON.stringify(await json(response))).toContain("30,000,001 bp long");
  });

  it("rejects an invalid custom track with the validation message", async () => {
    const response = await call("custom", "genomeId=1.1&type=CDS&strand=both&keyword=%20");
    expect(response.status).toBe(400);
    expectPrivateNoStore(response);
    expect(await json(response)).toEqual({
      error: "keyword must contain a word to search for.",
      code: "invalid_request",
    });
  });

  it("names an unknown operation", async () => {
    const response = await call("sequence", "genomeId=1.1");
    expect(response.status).toBe(404);
    expectPrivateNoStore(response);
    expect(await json(response)).toEqual({
      error: "Unsupported circular viewer operation: sequence",
      code: "not_found",
    });
  });
});

const gcBudget = 20;

describe("circular viewer rate limits", () => {
  // Validation fails before any upstream call, so each allowed request spends
  // the bucket without touching the backend.
  it.each([
    ["contigs", 60, "198.51.100.7"],
    ["track", 120, "198.51.100.21"],
    ["custom", 30, "198.51.100.22"],
    ["gc", gcBudget, "198.51.100.23"],
  ])(
    "allows %s %i requests a minute per client, then answers 429 privately with Retry-After",
    async (operation, budget, clientIp) => {
      for (let attempt = 0; attempt < budget; attempt += 1) {
        const allowed = await call(operation, "genomeId=bad", clientIp);
        expect(allowed.status).toBe(400);
      }
      const response = await call(operation, "genomeId=bad", clientIp);
      expect(response.status).toBe(429);
      expectPrivateNoStore(response);
      expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
      expect(await json(response)).toEqual({
        error: "Too many Circular Viewer requests. Please try again shortly.",
        code: "rate_limited",
      });
    },
  );

  it("keeps a bucket per operation, so a spent gc budget leaves contigs answering", async () => {
    const clientIp = "198.51.100.24";
    for (let attempt = 0; attempt < gcBudget; attempt += 1) {
      expect((await call("gc", "genomeId=bad", clientIp)).status).toBe(400);
    }
    expect((await call("gc", "genomeId=bad", clientIp)).status).toBe(429);
    expect((await call("contigs", "genomeId=bad", clientIp)).status).toBe(400);
  });
});
