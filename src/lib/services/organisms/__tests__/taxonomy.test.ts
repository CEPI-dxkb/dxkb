import { http, HttpResponse } from "msw";
import type { MockInstance } from "vitest";

import {
  TaxonomyNotFoundError,
  fetchLandingRootTaxonomy,
  fetchOrganismTaxonomy,
  getSharedOrganismTaxonomy,
  isTaxonomyOutage,
  staticLandingRootTaxonomy,
} from "@/lib/services/organisms/taxonomy";
import { UpstreamError } from "@/lib/api/upstream-failure";
import { server } from "@/test-helpers/msw-server";
import { settleBackgroundWork } from "@/test-helpers/settle";
import {
  connectionRefused,
  maintenancePage,
  maintenanceSummary,
} from "@/test-helpers/upstream-failures";

const baseUrl = "https://bvbrc.test/api-for-website";

beforeEach(() => {
  process.env.BVBRC_WEBSITE_API_URL = baseUrl;
});

afterEach(() => {
  delete process.env.BVBRC_WEBSITE_API_URL;
  vi.useRealTimers();
});

function taxonRecord(taxonId: number, taxonName = `Taxon ${String(taxonId)}`) {
  return HttpResponse.json({
    taxon_id: taxonId,
    taxon_name: taxonName,
    lineage_names: [taxonName],
    lineage_ids: [taxonId],
    taxon_rank: "genus",
    genomes: 42,
  });
}

/** Answers every taxonomy lookup with `respond`; the map counts requests per taxon. */
function serveTaxonomy(respond: (taxonId: number) => Response): Map<number, number> {
  const requests = new Map<number, number>();
  server.use(
    http.get(`${baseUrl}/taxonomy/:taxonId`, ({ params }) => {
      const taxonId = Number(params.taxonId);
      requests.set(taxonId, (requests.get(taxonId) ?? 0) + 1);
      return respond(taxonId);
    }),
  );
  return requests;
}

function caught(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => undefined,
    (error: unknown) => error,
  );
}

function advance(ms: number): void {
  vi.setSystemTime(Date.now() + ms);
}

describe("getSharedOrganismTaxonomy", () => {
  let logged: MockInstance<typeof console.error>;

  beforeEach(() => {
    logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  function lookupLogs(): unknown[][] {
    return logged.mock.calls.filter(
      ([message]) =>
        typeof message === "string" && message.endsWith("taxonomy lookup failed"),
    );
  }

  it("sends one request for concurrent lookups and serves the next from memory", async () => {
    const requests = serveTaxonomy((taxonId) => taxonRecord(taxonId, "Bacteria"));

    const [first, second] = await Promise.all([
      getSharedOrganismTaxonomy(2),
      getSharedOrganismTaxonomy(2),
    ]);

    expect(first).toMatchObject({ taxonId: 2, taxonName: "Bacteria", genomes: 42 });
    expect(second).toBe(first);
    await expect(getSharedOrganismTaxonomy(2)).resolves.toBe(first);
    await settleBackgroundWork();
    expect(requests.get(2)).toBe(1);
  });

  it("serves an outage from the cache without a second request", async () => {
    const requests = serveTaxonomy(() => maintenancePage());

    const first = await caught(getSharedOrganismTaxonomy(1773));
    const second = await caught(getSharedOrganismTaxonomy(1773));

    expect(first).toBeInstanceOf(UpstreamError);
    expect(first).toMatchObject({ status: 503, source: "taxonomy/1773" });
    expect(second).toBe(first);
    await settleBackgroundWork();
    expect(requests.get(1773)).toBe(1);
  });

  it("logs one line per failed load, not one per request", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const requests = serveTaxonomy(() => maintenancePage());

    const first = await caught(getSharedOrganismTaxonomy(1773));
    await caught(getSharedOrganismTaxonomy(1773));
    expect(lookupLogs()).toEqual([["taxonomy/1773: taxonomy lookup failed", first]]);

    advance(61_000);
    await caught(getSharedOrganismTaxonomy(1773));
    await vi.waitFor(() => {
      expect(requests.get(1773)).toBe(2);
      expect(lookupLogs()).toHaveLength(2);
    });
    await settleBackgroundWork();
    expect(logged).toHaveBeenCalledTimes(2);
  });

  it("caches a 404 for 60 s without tripping the breaker", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    let appeared = false;
    const requests = serveTaxonomy((taxonId) =>
      taxonId === 2 || (taxonId === 9999 && appeared)
        ? taxonRecord(taxonId)
        : HttpResponse.text("not found", { status: 404 }),
    );

    const missing = await caught(getSharedOrganismTaxonomy(9999));
    expect(missing).toBeInstanceOf(TaxonomyNotFoundError);
    await expect(getSharedOrganismTaxonomy(9998)).rejects.toBeInstanceOf(
      TaxonomyNotFoundError,
    );
    await expect(getSharedOrganismTaxonomy(2)).resolves.toMatchObject({ taxonId: 2 });
    expect(requests.get(2)).toBe(1);

    appeared = true;
    advance(59_000);
    await expect(getSharedOrganismTaxonomy(9999)).rejects.toBe(missing);
    await settleBackgroundWork();
    expect(requests.get(9999)).toBe(1);

    advance(2000);
    await expect(getSharedOrganismTaxonomy(9999)).rejects.toBe(missing);
    await vi.waitFor(async () => {
      await expect(getSharedOrganismTaxonomy(9999)).resolves.toMatchObject({
        taxonId: 9999,
      });
    });
    expect(requests.get(9999)).toBe(2);
    expect(logged).not.toHaveBeenCalled();
  });

  it("keeps a stale taxon through an outage, but a refresh's 404 replaces it for 60 s", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    let answer: "record" | "outage" | "gone" = "record";
    const requests = serveTaxonomy((taxonId) => {
      if (answer === "outage") return maintenancePage();
      if (answer === "gone") return HttpResponse.text("not found", { status: 404 });
      return taxonRecord(taxonId);
    });

    const taxon = await getSharedOrganismTaxonomy(1773);
    expect(taxon).toMatchObject({ taxonId: 1773 });

    answer = "outage";
    advance(60 * 60 * 1000);
    await expect(getSharedOrganismTaxonomy(1773)).resolves.toBe(taxon);
    await vi.waitFor(() => {
      expect(lookupLogs()).toHaveLength(1);
    });
    await expect(getSharedOrganismTaxonomy(1773)).resolves.toBe(taxon);
    await settleBackgroundWork();
    expect(requests.get(1773)).toBe(2);

    answer = "gone";
    advance(60_000);
    await expect(getSharedOrganismTaxonomy(1773)).resolves.toBe(taxon);
    const gone = await vi.waitFor(async () => {
      const error = await caught(getSharedOrganismTaxonomy(1773));
      expect(error).toBeInstanceOf(TaxonomyNotFoundError);
      return error;
    });
    await settleBackgroundWork();
    expect(requests.get(1773)).toBe(3);

    answer = "record";
    advance(59_000);
    await expect(getSharedOrganismTaxonomy(1773)).rejects.toBe(gone);
    await settleBackgroundWork();
    expect(requests.get(1773)).toBe(3);

    advance(1000);
    await expect(getSharedOrganismTaxonomy(1773)).rejects.toBe(gone);
    await vi.waitFor(async () => {
      await expect(getSharedOrganismTaxonomy(1773)).resolves.toMatchObject({
        taxonId: 1773,
      });
    });
    await settleBackgroundWork();
    expect(requests.get(1773)).toBe(4);
    expect(logged).toHaveBeenCalledTimes(1);
  });

  it("does not cache a malformed payload", async () => {
    const requests = serveTaxonomy((taxonId) => HttpResponse.json({ taxon_id: taxonId }));

    await expect(getSharedOrganismTaxonomy(2)).rejects.toThrow(/taxon_name is missing/);
    await expect(getSharedOrganismTaxonomy(2)).rejects.toThrow(/taxon_name is missing/);

    expect(requests.get(2)).toBe(2);
    expect(lookupLogs()).toEqual([]);
  });

  it("does not cache a missing env var", async () => {
    delete process.env.BVBRC_WEBSITE_API_URL;
    await expect(getSharedOrganismTaxonomy(2)).rejects.toThrow(
      "Missing required environment variable: BVBRC_WEBSITE_API_URL",
    );

    process.env.BVBRC_WEBSITE_API_URL = baseUrl;
    const requests = serveTaxonomy((taxonId) => taxonRecord(taxonId, "Bacteria"));

    await expect(getSharedOrganismTaxonomy(2)).resolves.toMatchObject({ taxonName: "Bacteria" });
    expect(requests.get(2)).toBe(1);
  });

  it("fails a distinct taxon fast once two outages opened the breaker", async () => {
    const requests = serveTaxonomy(() => maintenancePage());

    await expect(getSharedOrganismTaxonomy(1773)).rejects.toThrow(/503/);
    const opener = await caught(getSharedOrganismTaxonomy(1774));
    const fastFail = await caught(getSharedOrganismTaxonomy(561));

    expect(fastFail).toBe(opener);
    expect(fastFail).toMatchObject({ status: 503, source: "taxonomy/1774" });
    expect(requests.has(561)).toBe(false);
    expect(lookupLogs()).toHaveLength(2);
  });

  it("opens the breaker on two 500s that each took half the 30 s budget", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const requests = serveTaxonomy(() => {
      advance(15_000);
      return HttpResponse.text("taxonomy unavailable", { status: 500 });
    });

    await expect(getSharedOrganismTaxonomy(1773)).rejects.toThrow("taxonomy unavailable");
    const opener = await caught(getSharedOrganismTaxonomy(1774));
    const fastFail = await caught(getSharedOrganismTaxonomy(561));
    await settleBackgroundWork();

    expect(fastFail).toBe(opener);
    expect(fastFail).toMatchObject({ status: 502, source: "taxonomy/1774" });
    expect(requests.has(561)).toBe(false);
  });

  it("keeps the breaker closed on 500s that answered within half the budget", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const requests = serveTaxonomy((taxonId) => {
      advance(14_999);
      return taxonId === 561
        ? taxonRecord(561)
        : HttpResponse.text("taxonomy unavailable", { status: 500 });
    });

    await expect(getSharedOrganismTaxonomy(1773)).rejects.toThrow("taxonomy unavailable");
    await expect(getSharedOrganismTaxonomy(1774)).rejects.toThrow("taxonomy unavailable");

    await expect(getSharedOrganismTaxonomy(561)).resolves.toMatchObject({ taxonId: 561 });
    expect(requests.get(561)).toBe(1);
  });

  it("does not open the breaker on a generic 500", async () => {
    const requests = serveTaxonomy((taxonId) =>
      taxonId === 561
        ? taxonRecord(561)
        : HttpResponse.text("taxonomy unavailable", { status: 500 }),
    );

    await expect(getSharedOrganismTaxonomy(1773)).rejects.toThrow("taxonomy unavailable");
    await expect(getSharedOrganismTaxonomy(1774)).rejects.toThrow("taxonomy unavailable");
    await expect(getSharedOrganismTaxonomy(1773)).rejects.toThrow("taxonomy unavailable");

    await expect(getSharedOrganismTaxonomy(561)).resolves.toMatchObject({ taxonId: 561 });
    await settleBackgroundWork();
    expect(requests.get(1773)).toBe(1);
  });
});

describe("fetchOrganismTaxonomy", () => {
  it("returns normalized taxonomy header data", async () => {
    server.use(
      http.get(`${baseUrl}/taxonomy/2`, () =>
        HttpResponse.json({
          taxon_id: 2,
          taxon_name: "Bacteria",
          lineage_names: ["cellular organisms", "Bacteria"],
          taxon_rank: "superkingdom",
          genomes: 99,
        }),
      ),
    );

    await expect(fetchOrganismTaxonomy(2)).resolves.toEqual({
      taxonId: 2,
      taxonName: "Bacteria",
      lineageNames: ["cellular organisms", "Bacteria"],
      lineageIds: [],
      lineageRanks: [],
      taxonRank: "superkingdom",
      genomes: 99,
    });
  });

  it("preserves upstream error text", async () => {
    server.use(
      http.get(`${baseUrl}/taxonomy/2`, () =>
        HttpResponse.text("taxonomy unavailable", { status: 500 }),
      ),
    );

    await expect(fetchOrganismTaxonomy(2)).rejects.toThrow("taxonomy unavailable");
  });

  it("throws a 5xx as an UpstreamError in the shared outage wording", async () => {
    server.use(http.get(`${baseUrl}/taxonomy/2`, () => maintenancePage()));

    const error: unknown = await fetchOrganismTaxonomy(2).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(UpstreamError);
    expect(error).toMatchObject({
      status: 503,
      code: "service_unavailable",
      message: `The BV-BRC data service is unavailable (HTTP 503 Service Unavailable: ${maintenanceSummary}).`,
      source: "taxonomy/2",
    });
    expect(isTaxonomyOutage(error)).toBe(true);
    expect(isTaxonomyOutage(new Error("Missing required environment variable: X"))).toBe(false);
  });

  it("throws TaxonomyNotFoundError on 404", async () => {
    server.use(
      http.get(`${baseUrl}/taxonomy/9999`, () =>
        HttpResponse.text("not found", { status: 404 }),
      ),
    );

    const error: unknown = await fetchOrganismTaxonomy(9999).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(TaxonomyNotFoundError);
    expect(error).toMatchObject({ message: "Taxon 9999 was not found.", taxonId: 9999 });
  });

  it("parses numeric lineage_ids returned as numbers", async () => {
    server.use(
      http.get(`${baseUrl}/taxonomy/234`, () =>
        HttpResponse.json({
          taxon_id: 234,
          taxon_name: "Brucella",
          lineage_names: ["cellular organisms", "Bacteria", "Brucella"],
          lineage_ids: [131567, 2, 234],
          taxon_rank: "genus",
          genomes: 1909,
        }),
      ),
    );

    const result = await fetchOrganismTaxonomy(234);
    expect(result.lineageIds).toEqual([131567, 2, 234]);
  });

  it("coerces string lineage_ids to numbers (application/solr+json shape)", async () => {
    server.use(
      http.get(`${baseUrl}/taxonomy/234`, () =>
        HttpResponse.json({
          taxon_id: 234,
          taxon_name: "Brucella",
          lineage_names: ["Bacteria", "Brucella"],
          lineage_ids: ["2", "234"],
          taxon_rank: "genus",
          genomes: 1909,
        }),
      ),
    );

    const result = await fetchOrganismTaxonomy(234);
    expect(result.lineageIds).toEqual([2, 234]);
  });

  it("drops non-numeric lineage_ids entries", async () => {
    server.use(
      http.get(`${baseUrl}/taxonomy/234`, () =>
        HttpResponse.json({
          taxon_id: 234,
          taxon_name: "Brucella",
          lineage_names: ["Bacteria", "Brucella"],
          lineage_ids: [2, "not-a-number", null, 234],
          taxon_rank: "genus",
          genomes: 1909,
        }),
      ),
    );

    const result = await fetchOrganismTaxonomy(234);
    expect(result.lineageIds).toEqual([2, 234]);
  });

  it("keeps lineage_ranks aligned with the lineage, position for position", async () => {
    server.use(
      http.get(`${baseUrl}/taxonomy/562`, () =>
        HttpResponse.json({
          taxon_id: 562,
          taxon_name: "Escherichia coli",
          taxon_rank: "species",
          lineage_ids: [131567, 2, 561, 562],
          lineage_names: ["cellular organisms", "Bacteria", "Escherichia", "Escherichia coli"],
          lineage_ranks: ["cellular root", null, "genus", "species"],
          genomes: 1,
        }),
      ),
    );

    await expect(fetchOrganismTaxonomy(562)).resolves.toMatchObject({
      lineageRanks: ["cellular root", "", "genus", "species"],
    });
  });
});

describe("fetchLandingRootTaxonomy", () => {
  it("returns the fetched record when the lookup succeeds", async () => {
    server.use(
      http.get(`${baseUrl}/taxonomy/2`, () =>
        HttpResponse.json({
          taxon_id: 2,
          taxon_name: "Bacteria",
          lineage_names: ["cellular organisms", "Bacteria"],
          lineage_ids: [131567, 2],
          taxon_rank: "superkingdom",
          genomes: 1337420,
        }),
      ),
    );

    await expect(fetchLandingRootTaxonomy(2)).resolves.toMatchObject({
      taxonId: 2,
      genomes: 1337420,
    });
  });

  it.each([
    ["the maintenance page", () => maintenancePage()],
    [
      "a refused connection",
      () => {
        throw connectionRefused();
      },
    ],
  ])("falls back to the static root on %s", async (_label, respond) => {
    server.use(http.get(`${baseUrl}/taxonomy/10239`, respond));

    await expect(fetchLandingRootTaxonomy(10239)).resolves.toEqual({
      taxonId: 10239,
      taxonName: "Viruses",
      lineageNames: ["Viruses"],
      lineageIds: [10239],
      lineageRanks: ["acellular root"],
      taxonRank: "superkingdom",
      genomes: null,
    });
    expect(console.error).toHaveBeenCalledWith(
      "taxonomy/10239: taxonomy lookup failed",
      expect.any(UpstreamError),
    );
  });

  it("falls back to the static root on a 404, unlogged, and rethrows a 404 for any other taxon", async () => {
    serveTaxonomy(() => HttpResponse.text("not found", { status: 404 }));

    await expect(fetchLandingRootTaxonomy(10239)).resolves.toEqual(
      staticLandingRootTaxonomy(10239),
    );
    await expect(fetchLandingRootTaxonomy(1773)).rejects.toBeInstanceOf(
      TaxonomyNotFoundError,
    );
    expect(console.error).not.toHaveBeenCalled();
  });

  it("falls back to the static root once a refresh's 404 replaced the cached record", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    let gone = false;
    const requests = serveTaxonomy((taxonId) =>
      gone
        ? HttpResponse.text("not found", { status: 404 })
        : taxonRecord(taxonId, "Bacteria"),
    );

    const record = await fetchLandingRootTaxonomy(2);
    expect(record).toMatchObject({ taxonName: "Bacteria", genomes: 42 });

    gone = true;
    advance(60 * 60 * 1000);
    await expect(fetchLandingRootTaxonomy(2)).resolves.toBe(record);
    await vi.waitFor(async () => {
      await expect(fetchLandingRootTaxonomy(2)).resolves.toEqual(
        staticLandingRootTaxonomy(2),
      );
    });
    await settleBackgroundWork();
    expect(requests.get(2)).toBe(2);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("serves the static root at once from a cached outage", async () => {
    const requests = serveTaxonomy(() => maintenancePage());

    await expect(fetchLandingRootTaxonomy(10239)).resolves.toMatchObject({
      taxonName: "Viruses",
      genomes: null,
    });
    await expect(fetchLandingRootTaxonomy(10239)).resolves.toMatchObject({
      taxonName: "Viruses",
      genomes: null,
    });

    await settleBackgroundWork();
    expect(requests.get(10239)).toBe(1);
  });

  it("serves the static root without a request while the breaker is open", async () => {
    const requests = serveTaxonomy(() => maintenancePage());
    await expect(getSharedOrganismTaxonomy(1773)).rejects.toThrow(/503/);
    await expect(getSharedOrganismTaxonomy(1774)).rejects.toThrow(/503/);

    await expect(fetchLandingRootTaxonomy(2)).resolves.toMatchObject({
      taxonName: "Bacteria",
      genomes: null,
    });

    expect(requests.has(2)).toBe(false);
  });

  it("does not hide a configuration error behind the static root", async () => {
    delete process.env.BVBRC_WEBSITE_API_URL;

    await expect(fetchLandingRootTaxonomy(2)).rejects.toThrow(
      "Missing required environment variable: BVBRC_WEBSITE_API_URL",
    );
  });

  it("does not hide a malformed payload behind the static root", async () => {
    server.use(http.get(`${baseUrl}/taxonomy/2`, () => HttpResponse.json({ taxon_id: 2 })));

    await expect(fetchLandingRootTaxonomy(2)).rejects.toThrow(/taxon_name is missing/);
  });

  it("rethrows for a taxon that is not a landing root", async () => {
    server.use(http.get(`${baseUrl}/taxonomy/1773`, () => maintenancePage()));

    await expect(fetchLandingRootTaxonomy(1773)).rejects.toThrow(/503/);
  });
});

describe("staticLandingRootTaxonomy", () => {
  it("knows exactly the three landing roots, and hands out copies", () => {
    expect(staticLandingRootTaxonomy(2)?.lineageIds).toEqual([131567, 2]);
    expect(staticLandingRootTaxonomy(131567)?.lineageNames).toEqual([
      "cellular organisms",
    ]);
    expect(staticLandingRootTaxonomy(1773)).toBeUndefined();

    const first = staticLandingRootTaxonomy(2);
    first?.lineageIds.push(999);
    expect(staticLandingRootTaxonomy(2)?.lineageIds).toEqual([131567, 2]);
  });
});

describe("staticLandingRootTaxonomy", () => {
  it("carries BV-BRC's current ranks for each root", () => {
    expect(staticLandingRootTaxonomy(2)?.lineageRanks).toEqual(["cellular root", "domain"]);
    expect(staticLandingRootTaxonomy(10239)?.lineageRanks).toEqual(["acellular root"]);
    expect(staticLandingRootTaxonomy(131567)?.lineageRanks).toEqual(["cellular root"]);
  });

  it("returns a copy of the ranks", () => {
    staticLandingRootTaxonomy(2)?.lineageRanks?.push("mutated");
    expect(staticLandingRootTaxonomy(2)?.lineageRanks).toEqual(["cellular root", "domain"]);
  });
});
