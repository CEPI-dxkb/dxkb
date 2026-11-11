// `server-only` throws outside Next's bundler; the data repository reaches it.
vi.mock("server-only", () => ({}));

import { http, HttpResponse } from "msw";
import { cookies } from "next/headers";
import type { MockInstance } from "vitest";

import { setTestSession } from "@/test-helpers/api-route-helpers";
import { server } from "@/test-helpers/msw-server";
import { settleBackgroundWork } from "@/test-helpers/settle";
import { maintenancePage } from "@/test-helpers/upstream-failures";

import { loadLineageCrumbs } from "../lineage-server";

beforeEach(() => {
  process.env.DATA_API_URL = "https://data.test";
});

afterEach(() => {
  delete process.env.DATA_API_URL;
  vi.useRealTimers();
});

function strainRow(taxonId: string) {
  return {
    taxon_id: Number(taxonId),
    taxon_name: `Strain ${taxonId}`,
    lineage_ids: [1224, 562, Number(taxonId)],
    lineage_names: ["Pseudomonadota", "Escherichia coli", `Strain ${taxonId}`],
    lineage_ranks: ["phylum", "species", "strain"],
  };
}

interface TaxonomyRequest {
  taxonId: string;
  authorization: string | null;
}

/** Answers every taxonomy lookup with `respond` and records each request. */
function serveTaxonomy(
  respond: (taxonId: string) => Response,
): TaxonomyRequest[] {
  const requests: TaxonomyRequest[] = [];
  server.use(
    http.get("https://data.test/taxonomy/", ({ request }) => {
      const taxonId =
        /eq\(taxon_id,(\d+)\)/.exec(decodeURIComponent(request.url))?.[1] ??
        "";
      requests.push({
        taxonId,
        authorization: request.headers.get("Authorization"),
      });
      return respond(taxonId);
    }),
  );
  return requests;
}

function requestsFor(requests: TaxonomyRequest[], taxonId: string): number {
  return requests.filter((request) => request.taxonId === taxonId).length;
}

function names(crumbs: { name: string }[]): string[] {
  return crumbs.map(({ name }) => name);
}

function advance(ms: number): void {
  vi.setSystemTime(Date.now() + ms);
}

describe("loadLineageCrumbs", () => {
  let logged: MockInstance<typeof console.error>;

  beforeEach(() => {
    logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  function logLines(): unknown[] {
    return logged.mock.calls.map(([message]: unknown[]) => message);
  }

  it("reads the whole taxonomy record, so lineage_ranks is never projected away", async () => {
    const urls: string[] = [];
    server.use(
      http.get("https://data.test/taxonomy/", ({ request }) => {
        urls.push(decodeURIComponent(request.url));
        return HttpResponse.json([
          {
            taxon_id: 83333,
            taxon_name: "Escherichia coli K-12",
            lineage_ids: [1224, 562, 83333],
            lineage_names: ["Pseudomonadota", "Escherichia coli", "K-12"],
            lineage_ranks: ["phylum", "species", "strain"],
          },
        ]);
      }),
    );

    const crumbs = await loadLineageCrumbs("83333", "genome/1.1");

    expect(urls).toHaveLength(1);
    // A `select(...)` clause would drop any field it leaves out.
    expect(urls[0]).not.toContain("select(");
    expect(crumbs.map(({ name }) => name)).toEqual([
      "Pseudomonadota",
      "Escherichia coli",
    ]);
  });

  it("sends one request for many owners of one taxon", async () => {
    const requests = serveTaxonomy((taxonId) =>
      HttpResponse.json([strainRow(taxonId)]),
    );

    const crumbs = await Promise.all([
      loadLineageCrumbs("83333", "genome/1.1"),
      loadLineageCrumbs("83333", "genome/1.2"),
      loadLineageCrumbs("83333", "feature/fig|1.1.peg.1"),
    ]);
    const later = await loadLineageCrumbs("83333", "genome/1.3");
    await settleBackgroundWork();

    expect(crumbs.map(names)).toEqual(
      Array.from({ length: 3 }, () => ["Pseudomonadota", "Escherichia coli"]),
    );
    expect(names(later)).toEqual(["Pseudomonadota", "Escherichia coli"]);
    expect(requests).toHaveLength(1);
  });

  it("keeps a row for an hour and rechecks a missing row after a minute", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const requests = serveTaxonomy((taxonId) =>
      HttpResponse.json(taxonId === "83333" ? [strainRow(taxonId)] : []),
    );

    await loadLineageCrumbs("83333", "genome/1.1");
    await expect(loadLineageCrumbs("99999", "genome/2.1")).resolves.toEqual(
      [],
    );

    advance(59_000);
    await loadLineageCrumbs("99999", "genome/2.2");
    await settleBackgroundWork();
    expect(requestsFor(requests, "99999")).toBe(1);

    advance(2000);
    await loadLineageCrumbs("99999", "genome/2.3");
    await vi.waitFor(() => {
      expect(requestsFor(requests, "99999")).toBe(2);
    });

    advance(60 * 60 * 1000 - 62_000);
    await loadLineageCrumbs("83333", "genome/1.2");
    await settleBackgroundWork();
    expect(requestsFor(requests, "83333")).toBe(1);

    advance(2000);
    await loadLineageCrumbs("83333", "genome/1.3");
    await vi.waitFor(() => {
      expect(requestsFor(requests, "83333")).toBe(2);
    });
  });

  it("serves an outage from the cache and logs it once, without the owner's line", async () => {
    const requests = serveTaxonomy(() => maintenancePage());

    await expect(loadLineageCrumbs("83333", "genome/1.1")).resolves.toEqual(
      [],
    );
    await expect(loadLineageCrumbs("83333", "genome/1.2")).resolves.toEqual(
      [],
    );
    await settleBackgroundWork();

    expect(requests).toHaveLength(1);
    expect(logged.mock.calls).toEqual([
      [
        "taxonomy/83333: taxonomy lookup failed",
        expect.objectContaining({ status: 503, code: "service_unavailable" }),
      ],
    ]);
  });

  it("fails a distinct taxon fast once two outages opened the breaker", async () => {
    const requests = serveTaxonomy(() => maintenancePage());

    await loadLineageCrumbs("83333", "genome/1.1");
    await loadLineageCrumbs("83334", "genome/1.2");
    await expect(loadLineageCrumbs("561", "genome/1.3")).resolves.toEqual([]);

    expect(requests.map(({ taxonId }) => taxonId)).toEqual(["83333", "83334"]);
    expect(logLines()).toEqual([
      "taxonomy/83333: taxonomy lookup failed",
      "taxonomy/83334: taxonomy lookup failed",
      expect.stringMatching(
        /^shared-cache taxonomy-record: upstream marked down for 30 s: /,
      ),
    ]);
  });

  it("opens the breaker on two 500s that each took half the 20 s budget", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const requests = serveTaxonomy(() => {
      advance(10_000);
      return HttpResponse.text("gateway timed out", { status: 500 });
    });

    await loadLineageCrumbs("83333", "genome/1.1");
    await loadLineageCrumbs("83334", "genome/1.2");
    await expect(loadLineageCrumbs("561", "genome/1.3")).resolves.toEqual([]);
    await settleBackgroundWork();

    expect(requests.map(({ taxonId }) => taxonId)).toEqual(["83333", "83334"]);
    expect(logLines()).toEqual([
      "taxonomy/83333: taxonomy lookup failed",
      "taxonomy/83334: taxonomy lookup failed",
      expect.stringMatching(
        /^shared-cache taxonomy-record: upstream marked down for 30 s: /,
      ),
    ]);
  });

  it("keeps the breaker closed on 500s that answered within half the budget", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const requests = serveTaxonomy((taxonId) => {
      advance(9_999);
      return taxonId === "561"
        ? HttpResponse.json([strainRow(taxonId)])
        : HttpResponse.text("gateway timed out", { status: 500 });
    });

    await loadLineageCrumbs("83333", "genome/1.1");
    await loadLineageCrumbs("83334", "genome/1.2");
    const healthy = await loadLineageCrumbs("561", "genome/1.3");

    expect(names(healthy)).toEqual(["Pseudomonadota", "Escherichia coli"]);
    expect(requests.map(({ taxonId }) => taxonId)).toEqual([
      "83333",
      "83334",
      "561",
    ]);
  });

  it("caches a malformed row for 60 s and then retries it, logs each load once, and does not trip the breaker", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const requests = serveTaxonomy((taxonId) =>
      HttpResponse.json(
        taxonId === "561" ? [strainRow(taxonId)] : [{ taxon_id: "not-a-taxon" }],
      ),
    );

    await expect(loadLineageCrumbs("83333", "genome/1.1")).resolves.toEqual(
      [],
    );
    advance(59_000);
    await expect(loadLineageCrumbs("83333", "genome/1.2")).resolves.toEqual(
      [],
    );
    await settleBackgroundWork();
    expect(requestsFor(requests, "83333")).toBe(1);

    await loadLineageCrumbs("83334", "genome/1.3");
    await loadLineageCrumbs("83335", "genome/1.4");
    const healthy = await loadLineageCrumbs("561", "genome/1.5");

    expect(names(healthy)).toEqual(["Pseudomonadota", "Escherichia coli"]);
    expect(requestsFor(requests, "561")).toBe(1);
    const malformed: unknown = expect.objectContaining({
      status: 502,
      code: "malformed_response",
    });
    expect(logged.mock.calls).toEqual([
      ["taxonomy/83333: taxonomy lookup failed", malformed],
      ["taxonomy/83334: taxonomy lookup failed", malformed],
      ["taxonomy/83335: taxonomy lookup failed", malformed],
    ]);

    advance(2000);
    await expect(loadLineageCrumbs("83333", "genome/1.6")).resolves.toEqual(
      [],
    );
    await vi.waitFor(() => {
      expect(requestsFor(requests, "83333")).toBe(2);
      expect(logged).toHaveBeenCalledTimes(4);
    });
    expect(logged).toHaveBeenLastCalledWith(
      "taxonomy/83333: taxonomy lookup failed",
      malformed,
    );
  });

  it("logs a failure that is not an outage under the owner, and does not cache it", async () => {
    const requests = serveTaxonomy(() =>
      HttpResponse.json({ message: "Not found" }, { status: 404 }),
    );

    await expect(loadLineageCrumbs("83333", "genome/1.1")).resolves.toEqual(
      [],
    );
    await expect(loadLineageCrumbs("83333", "genome/1.2")).resolves.toEqual(
      [],
    );

    expect(requests).toHaveLength(2);
    expect(logged.mock.calls).toEqual([
      [
        "genome/1.1: taxonomy/83333 lookup failed",
        expect.objectContaining({ status: 404 }),
      ],
      [
        "genome/1.2: taxonomy/83333 lookup failed",
        expect.objectContaining({ status: 404 }),
      ],
    ]);
  });

  it("gives a signed-in visitor the shared row, read without their token", async () => {
    const requests = serveTaxonomy((taxonId) =>
      HttpResponse.json([strainRow(taxonId)]),
    );

    await loadLineageCrumbs("83333", "genome/1.1");
    setTestSession({ token: "secret-token" });
    const signedIn = await loadLineageCrumbs("83333", "genome/1.2");
    const otherTaxon = await loadLineageCrumbs("83334", "genome/1.3");

    expect(names(signedIn)).toEqual(["Pseudomonadota", "Escherichia coli"]);
    expect(names(otherTaxon)).toEqual(["Pseudomonadota", "Escherichia coli"]);
    expect(cookies).not.toHaveBeenCalled();
    expect(requests).toEqual([
      { taxonId: "83333", authorization: null },
      { taxonId: "83334", authorization: null },
    ]);
  });
});
