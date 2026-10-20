import { http, HttpResponse } from "msw";

import {
  TaxonomyNotFoundError,
  fetchLandingRootTaxonomy,
  fetchOrganismTaxonomy,
  isTaxonomyOutage,
  staticLandingRootTaxonomy,
} from "@/lib/services/organisms/taxonomy";
import { UpstreamError } from "@/lib/api/upstream-failure";
import { server } from "@/test-helpers/msw-server";
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
    // The page names the taxon, so the message carries no label, and the
    // endpoint is only for the log.
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
      taxonRank: "superkingdom",
      genomes: null,
    });
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("taxonomy/10239"),
      expect.anything(),
    );
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
