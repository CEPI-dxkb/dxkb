import { http, HttpResponse } from "msw";
import type { MockInstance } from "vitest";

import {
  experimentalStructureRql,
  fetchExperimentalStructureCount,
  getSharedExperimentalStructureCount,
} from "@/lib/services/organisms/structure-count";
import { organismJoinFetchTimeoutMs } from "@/lib/services/organisms/utils";
import { server } from "@/test-helpers/msw-server";
import { settleBackgroundWork } from "@/test-helpers/settle";

const baseUrl = "https://bvbrc.test/api-for-website";

beforeEach(() => {
  process.env.BVBRC_WEBSITE_API_URL = baseUrl;
});

afterEach(() => {
  delete process.env.BVBRC_WEBSITE_API_URL;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const experimentalStructureQuery =
  "and(ne(method,Predicted),eq(genome_id,*),genome(and(eq(taxon_lineage_ids,2),ne(genome_status,Deprecated))))";

describe("experimentalStructureRql", () => {
  it("counts structures linked to a non-Deprecated genome of the taxon's lineage, like the Protein Structures tab", () => {
    expect(experimentalStructureRql(2)).toBe(experimentalStructureQuery);
  });
});

describe("fetchExperimentalStructureCount", () => {
  it("returns numFound of the experimental-structure query", async () => {
    let seenQuery = "";
    server.use(
      http.get(`${baseUrl}/protein_structure/`, ({ request }) => {
        seenQuery = decodeURIComponent(new URL(request.url).search);
        return HttpResponse.json({ response: { numFound: 68_899, docs: [] } });
      }),
    );

    await expect(fetchExperimentalStructureCount(2)).resolves.toBe(68_899);
    expect(seenQuery).toContain(experimentalStructureQuery);
    expect(seenQuery).toContain("limit(1)");
    expect(seenQuery).toContain("select(pdb_id)");
  });

  it("gives the cross-collection join the long fetch budget", async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    server.use(
      http.get(`${baseUrl}/protein_structure/`, () =>
        HttpResponse.json({ response: { numFound: 257, docs: [] } }),
      ),
    );

    await fetchExperimentalStructureCount(2);

    expect(timeoutSpy).toHaveBeenCalledWith(60_000);
    expect(timeoutSpy).toHaveBeenCalledWith(organismJoinFetchTimeoutMs);
  });

  it("throws on a response without numFound", async () => {
    server.use(
      http.get(`${baseUrl}/protein_structure/`, () =>
        HttpResponse.json({ response: {} }),
      ),
    );

    await expect(fetchExperimentalStructureCount(2)).rejects.toThrow(
      "Unexpected SOLR response shape — missing response.numFound",
    );
  });

  it("throws the original upstream text on non-2xx", async () => {
    server.use(
      http.get(`${baseUrl}/protein_structure/`, () =>
        HttpResponse.text("BV-BRC overloaded", { status: 503 }),
      ),
    );

    await expect(fetchExperimentalStructureCount(2)).rejects.toMatchObject({
      message:
        "The BV-BRC data service is unavailable (HTTP 503 Service Unavailable: BV-BRC overloaded).",
      source: "protein_structure count",
    });
  });

  it("does not swallow abort errors", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      fetchExperimentalStructureCount(2, { signal: controller.signal }),
    ).rejects.toThrow();
  });
});

function caught(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => undefined,
    (error: unknown) => error,
  );
}

function advance(ms: number): void {
  vi.setSystemTime(Date.now() + ms);
}

/** The taxon id in a structure-count request's genome clause. */
function requestedTaxon(request: Request): number {
  const search = decodeURIComponent(new URL(request.url).search);
  return Number(/eq\(taxon_lineage_ids,(\d+)\)/.exec(search)?.[1]);
}

describe("getSharedExperimentalStructureCount", () => {
  let logged: MockInstance<typeof console.error>;

  beforeEach(() => {
    logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  function countLogs(): unknown[][] {
    return logged.mock.calls.filter(
      ([message]) =>
        typeof message === "string" && message.endsWith(": count failed"),
    );
  }

  it("asks the upstream once for repeated reads of one taxon, without a token", async () => {
    let calls = 0;
    let authorization: string | null = "unset";
    server.use(
      http.get(`${baseUrl}/protein_structure/`, ({ request }) => {
        calls += 1;
        authorization = request.headers.get("Authorization");
        return HttpResponse.json({ response: { numFound: 257, docs: [] } });
      }),
    );

    await expect(getSharedExperimentalStructureCount(9000001)).resolves.toBe(257);
    await expect(getSharedExperimentalStructureCount(9000001)).resolves.toBe(257);
    await settleBackgroundWork();

    expect(calls).toBe(1);
    expect(authorization).toBeNull();
  });

  it("keeps taxa apart", async () => {
    server.use(
      http.get(`${baseUrl}/protein_structure/`, ({ request }) => {
        const count = requestedTaxon(request) === 9000002 ? 5 : 7;
        return HttpResponse.json({ response: { numFound: count, docs: [] } });
      }),
    );

    await expect(getSharedExperimentalStructureCount(9000002)).resolves.toBe(5);
    await expect(getSharedExperimentalStructureCount(9000003)).resolves.toBe(7);
  });

  it("serves a cached outage with its original message for the retry window instead of re-asking", async () => {
    let calls = 0;
    server.use(
      http.get(`${baseUrl}/protein_structure/`, () => {
        calls += 1;
        return HttpResponse.text("BV-BRC overloaded", { status: 503 });
      }),
    );

    const first = await caught(getSharedExperimentalStructureCount(9000004));
    const second = await caught(getSharedExperimentalStructureCount(9000004));
    await settleBackgroundWork();

    expect(first).toMatchObject({
      message:
        "The BV-BRC data service is unavailable (HTTP 503 Service Unavailable: BV-BRC overloaded).",
      source: "protein_structure count",
    });
    expect(second).toBe(first);
    expect(calls).toBe(1);
    expect(countLogs()).toEqual([
      ["protein-structure-count/9000004: count failed", first],
    ]);
  });

  it("does not cache or log a malformed response", async () => {
    let calls = 0;
    server.use(
      http.get(`${baseUrl}/protein_structure/`, () => {
        calls += 1;
        return HttpResponse.json({ response: {} });
      }),
    );

    await expect(getSharedExperimentalStructureCount(9000005)).rejects.toThrow(
      "Unexpected SOLR response shape — missing response.numFound",
    );
    await expect(getSharedExperimentalStructureCount(9000005)).rejects.toThrow(
      "Unexpected SOLR response shape — missing response.numFound",
    );

    expect(calls).toBe(2);
    expect(countLogs()).toEqual([]);
  });

  it("does not cache a missing env var", async () => {
    delete process.env.BVBRC_WEBSITE_API_URL;
    await expect(getSharedExperimentalStructureCount(9000006)).rejects.toThrow(
      "Missing required environment variable: BVBRC_WEBSITE_API_URL",
    );

    process.env.BVBRC_WEBSITE_API_URL = baseUrl;
    let calls = 0;
    server.use(
      http.get(`${baseUrl}/protein_structure/`, () => {
        calls += 1;
        return HttpResponse.json({ response: { numFound: 3, docs: [] } });
      }),
    );

    await expect(getSharedExperimentalStructureCount(9000006)).resolves.toBe(3);
    expect(calls).toBe(1);
  });

  it("opens the breaker on two 500s that each took half the 60 s join budget", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const requested: number[] = [];
    server.use(
      http.get(`${baseUrl}/protein_structure/`, ({ request }) => {
        requested.push(requestedTaxon(request));
        advance(organismJoinFetchTimeoutMs / 2);
        return HttpResponse.text("structures unavailable", { status: 500 });
      }),
    );

    await expect(getSharedExperimentalStructureCount(9000007)).rejects.toThrow(
      "structures unavailable",
    );
    const opener = await caught(getSharedExperimentalStructureCount(9000008));
    const fastFail = await caught(getSharedExperimentalStructureCount(9000009));
    await settleBackgroundWork();

    expect(fastFail).toBe(opener);
    expect(requested).not.toContain(9000009);
  });

  it("keeps the breaker closed on 500s that took half the 30 s default budget, short of half the join budget", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const requested: number[] = [];
    server.use(
      http.get(`${baseUrl}/protein_structure/`, ({ request }) => {
        const taxonId = requestedTaxon(request);
        requested.push(taxonId);
        advance(organismJoinFetchTimeoutMs / 2 - 1);
        return taxonId === 9000012
          ? HttpResponse.json({ response: { numFound: 9, docs: [] } })
          : HttpResponse.text("structures unavailable", { status: 500 });
      }),
    );

    await expect(getSharedExperimentalStructureCount(9000010)).rejects.toThrow(
      "structures unavailable",
    );
    await expect(getSharedExperimentalStructureCount(9000011)).rejects.toThrow(
      "structures unavailable",
    );

    await expect(getSharedExperimentalStructureCount(9000012)).resolves.toBe(9);
    expect(requested).toContain(9000012);
  });
});
