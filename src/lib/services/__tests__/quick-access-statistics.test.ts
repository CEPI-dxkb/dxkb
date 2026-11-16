import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { server } from "@/test-helpers/msw-server";
import {
  getQuickAccessStatistics,
  quickAccessDefinitions,
} from "@/lib/services/quick-access-statistics";

const dataApi = "https://data-api.test";

beforeEach(() => {
  process.env.NEXT_PUBLIC_DATA_API = dataApi;
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_DATA_API;
  vi.restoreAllMocks();
});

function solrCount(numFound: number) {
  return HttpResponse.json({ response: { numFound, docs: [] } });
}

describe("quickAccessDefinitions", () => {
  it("is frozen and lists the six counts in display order", () => {
    expect(Object.isFrozen(quickAccessDefinitions)).toBe(true);
    expect(quickAccessDefinitions.map((definition) => definition.key)).toEqual([
      "completeGenomes",
      "partialGenomes",
      "referenceGenomes",
      "experimentalStructures",
      "predictedStructures",
      "epitopes",
    ]);
  });

  it("scopes every genome count to the viruses Database Statistics counts", () => {
    const genomeFilters = quickAccessDefinitions
      .filter((definition) => definition.core === "genome")
      .map((definition) => definition.filter);

    expect(genomeFilters).toHaveLength(3);
    for (const filter of genomeFilters) {
      expect(filter).toContain("eq(superkingdom,Viruses)");
    }
  });

  it("labels say what is counted", () => {
    expect(quickAccessDefinitions.map((definition) => definition.label)).toEqual([
      "Complete Genomes",
      "Partial Genomes",
      "Reference & Representative Genomes",
      "Experimental Structures",
      "Predicted Structures",
      "Viral Epitopes",
    ]);
  });
});

describe("getQuickAccessStatistics", () => {
  it("returns a live count per key from the matching core and filter", async () => {
    server.use(
      http.get(`${dataApi}/:core/`, ({ request }) => {
        const url = request.url;
        const isGenome = url.includes("/genome/");
        const isStructure = url.includes("/protein_structure/");
        if (isGenome && url.includes("eq(genome_status,Complete)")) {
          return solrCount(1001);
        }
        if (isGenome && url.includes("eq(genome_status,Partial)")) {
          return solrCount(1002);
        }
        if (isGenome && url.includes("eq(reference_genome,*)")) {
          return solrCount(1003);
        }
        if (isStructure && url.includes("ne(method,Predicted)")) {
          return solrCount(1004);
        }
        if (isStructure && url.includes("eq(method,Predicted)")) {
          return solrCount(1005);
        }
        if (url.includes("/epitope/")) return solrCount(1006);
        return HttpResponse.text("unexpected request", { status: 500 });
      }),
    );

    const { counts, unavailableReason } = await getQuickAccessStatistics();

    expect(unavailableReason).toBeNull();
    expect(counts).toEqual({
      completeGenomes: 1001,
      partialGenomes: 1002,
      referenceGenomes: 1003,
      experimentalStructures: 1004,
      predictedStructures: 1005,
      epitopes: 1006,
    });
  });

  it("excludes Deprecated from the reference count and scopes structures and epitopes by lineage", async () => {
    const urls: string[] = [];
    server.use(
      http.get(`${dataApi}/:core/`, ({ request }) => {
        urls.push(request.url);
        return solrCount(1);
      }),
    );

    await getQuickAccessStatistics();

    expect(
      urls.some(
        (url) =>
          url.includes("/genome/") &&
          url.includes("eq(reference_genome,*)") &&
          url.includes("ne(genome_status,Deprecated)"),
      ),
    ).toBe(true);
    expect(
      urls.filter(
        (url) =>
          url.includes("/protein_structure/") &&
          url.includes("eq(taxon_lineage_ids,10239)"),
      ),
    ).toHaveLength(2);
    expect(
      urls.filter(
        (url) =>
          url.includes("/epitope/") &&
          url.includes("eq(taxon_lineage_ids,10239)"),
      ),
    ).toHaveLength(1);
  });

  it("keeps a failed count null without hiding the others", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    server.use(
      http.get(`${dataApi}/epitope/`, () =>
        HttpResponse.text("down", { status: 500 }),
      ),
      http.get(`${dataApi}/:core/`, () => solrCount(7)),
    );

    const { counts, unavailableReason } = await getQuickAccessStatistics();

    expect(unavailableReason).toBeNull();
    expect(counts.epitopes).toBeNull();
    expect(counts.completeGenomes).toBe(7);
  });

  it("reports why when every count fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    server.use(
      http.get(`${dataApi}/:core/`, () =>
        HttpResponse.text("everything is on fire", { status: 503 }),
      ),
    );

    const { counts, unavailableReason } = await getQuickAccessStatistics();

    expect(Object.values(counts).every((count) => count === null)).toBe(true);
    expect(unavailableReason).toContain("everything is on fire");
  });
});
