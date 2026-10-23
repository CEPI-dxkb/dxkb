// `server-only` throws outside Next's bundler; this route reaches it through
// `@/lib/data-api/server-policy` (same neutralization as the Taxa Tree test).
vi.mock("server-only", () => ({}));

import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import {
  clearTestCookies,
  json,
  makeRouteContext,
  mockNextRequest,
  setTestSession,
} from "@/test-helpers/api-route-helpers";
import { genomeBrowserSequenceCache } from "@/lib/genome-browser/server";
import { GET } from "../route";

/** One client IP per call, so the shared rate-limit buckets never spill over. */
let nextIpOctet = 10;

function call(operation: string, query: string, clientIp?: string) {
  nextIpOctet += 1;
  return GET(
    mockNextRequest({
      url: `http://localhost:3019/api/genome-browser/${operation}?${query}`,
      headers: {
        "x-forwarded-for": clientIp ?? `203.0.113.${String(nextIpOctet)}`,
      },
    }),
    makeRouteContext({ operation }),
  );
}

/** Every answer, success or failure, depends on the caller's cookie. */
function expectPrivateNoStore(response: Response) {
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("Vary")).toBe("Cookie");
}

beforeEach(() => {
  process.env.DATA_API_URL = "https://data.test";
  genomeBrowserSequenceCache.clear();
});

afterEach(() => {
  delete process.env.DATA_API_URL;
  delete process.env.E2E_MOCK_ENABLED;
});

describe("genome browser route", () => {
  it("answers a genome's regions, never shared-cached", async () => {
    server.use(
      http.get("https://data.test/genome_sequence/", () =>
        HttpResponse.json([{ sequence_id: "s", accession: "JX869059", length: 30119 }]),
      ),
    );
    const response = await call("regions", "genomeId=1282460.2049");
    expect(response.status).toBe(200);
    expectPrivateNoStore(response);
    expect(await json(response)).toEqual({
      regions: [{ refName: "JX869059", start: 0, end: 30119 }],
    });
  });

  it("answers features for a range", async () => {
    server.use(
      http.get("https://data.test/genome_feature/", () =>
        HttpResponse.json([
          { feature_id: "PATRIC.1", patric_id: "fig|1.peg.1", start: 1, end: 100, strand: "+", feature_type: "CDS" },
        ]),
      ),
    );
    const response = await call(
      "features",
      "genomeId=1282460.2049&refName=JX869059&annotation=PATRIC&start=0&end=100000",
    );
    expect(await json(response)).toEqual({
      features: [
        expect.objectContaining({ uniqueId: "PATRIC.1", start: 0, end: 100, strand: 1 }),
      ],
      truncated: false,
    });
  });

  it("forwards the session token upstream", async () => {
    setTestSession({ token: "un=user@patricbrc.org|sig=x", userId: "user@patricbrc.org" });
    server.use(
      http.get("https://data.test/genome_sequence/", ({ request }) => {
        expect(request.headers.get("Authorization")).toBe("un=user@patricbrc.org|sig=x");
        return HttpResponse.json([{ sequence_id: "s", accession: "A", sequence: "acgtacgt" }]);
      }),
    );
    const response = await call("sequence", "genomeId=1.1&refName=A&start=2&end=5");
    expect(await json(response)).toEqual({ start: 2, end: 5, seq: "gta" });
  });

  it("rejects an invalid request with the validation message", async () => {
    const response = await call("features", "genomeId=1.1&refName=A&annotation=PATRIC&start=5&end=5");
    expect(response.status).toBe(400);
    expectPrivateNoStore(response);
    expect(await json(response)).toEqual({
      error: "end must be greater than start.",
      code: "invalid_request",
    });
  });

  it("names an unknown operation", async () => {
    const response = await call("tracks", "genomeId=1.1");
    expect(response.status).toBe(404);
    expectPrivateNoStore(response);
    expect(await json(response)).toEqual({
      error: "Unsupported genome browser operation: tracks",
      code: "not_found",
    });
  });

  it("passes an upstream outage through as a 503 with its message", async () => {
    server.use(
      http.get("https://data.test/genome_sequence/", () =>
        new HttpResponse("<html><title>Site Maintenance</title></html>", {
          status: 503,
          statusText: "Service Unavailable",
          headers: { "Content-Type": "text/html" },
        }),
      ),
    );
    const response = await call("regions", "genomeId=1.1");
    expect(response.status).toBe(503);
    expectPrivateNoStore(response);
    expect((await json<{ error: string }>(response)).error).toContain("Site Maintenance");
  });

  it("marks an upstream 403 private too, since a token decides it", async () => {
    server.use(
      http.get("https://data.test/genome_sequence/", () =>
        HttpResponse.json({ error: "forbidden" }, { status: 403 }),
      ),
    );
    const response = await call("regions", "genomeId=1.1");
    expect(response.status).toBe(403);
    expectPrivateNoStore(response);
  });

});

describe("genome browser rate limits", () => {
  // Validation fails before any upstream call, so each allowed request spends
  // the bucket without touching the backend.
  it.each([
    ["regions", 60, "198.51.100.7"],
    ["sequence", 60, "198.51.100.21"],
    ["features", 300, "198.51.100.22"],
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
      expect(response.headers.get("Retry-After")).not.toBeNull();
      expect(await json(response)).toEqual({
        error: "Too many Genome Browser requests. Please try again shortly.",
        code: "rate_limited",
      });
    },
  );
});

describe("genome browser sequence loads", () => {
  it("answers 503 past the concurrent whole-contig load cap, privately and with its message", async () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get("https://data.test/genome_sequence/", async ({ request }) => {
        await held;
        const accession = /accession,([^)]+)\)/.exec(
          decodeURIComponent(new URL(request.url).search),
        )?.[1];
        return HttpResponse.json([{ sequence_id: "s", accession, sequence: "acgtacgt" }]);
      }),
    );
    const read = (refName: string) =>
      call("sequence", `genomeId=1.1&refName=${refName}&start=0&end=4`);
    // Four distinct contigs fill the cap; a fifth is refused at once.
    const loading = ["A", "B", "C", "D"].map(read);
    const refused = await read("E");
    expect(refused.status).toBe(503);
    expectPrivateNoStore(refused);
    expect(await json(refused)).toEqual({
      error: "The Genome Browser's sequence service is busy reading other sequences. Please try again shortly.",
      code: "server_busy",
    });

    release();
    for (const response of await Promise.all(loading)) {
      expect(response.status).toBe(200);
    }
    expect((await read("E")).status).toBe(200);
  });
});

describe("genome browser sequence cache scope", () => {
  const sequenceQuery = "genomeId=1.1&refName=A&start=0&end=4";
  const sequenceByToken: Record<string, string> = {
    "token-a": "aaaaaaaa",
    "token-b": "cccccccc",
    anonymous: "gggggggg",
  };
  let upstreamTokens: string[];

  beforeEach(() => {
    upstreamTokens = [];
    server.use(
      http.get("https://data.test/genome_sequence/", ({ request }) => {
        const token = request.headers.get("Authorization") ?? "anonymous";
        upstreamTokens.push(token);
        return HttpResponse.json([
          { sequence_id: "s", accession: "A", sequence: sequenceByToken[token] },
        ]);
      }),
    );
  });

  async function readAs(token: string | null, userId = `user-${token ?? ""}`) {
    clearTestCookies();
    if (token !== null) setTestSession({ token, userId });
    const response = await call("sequence", sequenceQuery);
    return (await json<{ seq: string }>(response)).seq;
  }

  it("keeps one contig cached per caller, never across callers", async () => {
    expect(await readAs("token-a")).toBe("aaaa");
    expect(await readAs("token-b")).toBe("cccc");
    expect(await readAs(null)).toBe("gggg");
    expect(upstreamTokens).toEqual(["token-a", "token-b", "anonymous"]);

    // The same caller again is a cache hit; no further upstream read.
    expect(await readAs("token-a")).toBe("aaaa");
    expect(await readAs(null)).toBe("gggg");
    expect(upstreamTokens).toHaveLength(3);
  });

  it("never answers a cached contig to another token claiming the same user id", async () => {
    // `bvbrc_user_id` is a plain cookie nothing ties to `bvbrc_token`, so a
    // caller can claim any user id. A hit must need the token upstream accepted.
    expect(await readAs("token-a", "victim@patricbrc.org")).toBe("aaaa");
    expect(await readAs("token-b", "victim@patricbrc.org")).toBe("cccc");
    expect(upstreamTokens).toEqual(["token-a", "token-b"]);
  });

  it("never caches during an E2E run", async () => {
    process.env.E2E_MOCK_ENABLED = "1";
    expect(await readAs("token-a")).toBe("aaaa");
    expect(await readAs("token-a")).toBe("aaaa");
    expect(upstreamTokens).toEqual(["token-a", "token-a"]);
  });
});
