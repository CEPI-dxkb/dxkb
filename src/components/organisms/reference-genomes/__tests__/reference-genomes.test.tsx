import { http, HttpResponse } from "msw";

import { genomeOverviewScope, parseGenomeCollectionState } from "@/lib/genome-view";
import { server } from "@/test-helpers/msw-server";

import { LazyReferenceGenomesClient } from "../lazy-reference-genomes-client";
import { ReferenceGenomes } from "../reference-genomes";

const baseUrl = "https://bvbrc.test/api-for-website";

beforeEach(() => {
  process.env.BVBRC_WEBSITE_API_URL = baseUrl;
});

afterEach(() => {
  delete process.env.BVBRC_WEBSITE_API_URL;
});

const reference = {
  reference_genome: "Reference",
  genome_name: "Escherichia coli K-12",
  genome_id: "511145.12",
  genbank_accessions: "NC_000913",
};
const representative = {
  reference_genome: "Representative",
  genome_name: "Escherichia coli B",
  genome_id: "481805.6",
  genbank_accessions: "CP000819",
};

describe("ReferenceGenomes", () => {
  it("hands the client each type's rows, and links All to every type and each type to itself, from the genomeList", async () => {
    server.use(
      http.get(`${baseUrl}/genome/`, ({ request }) => {
        const query = decodeURIComponent(request.url);
        if (query.includes("eq(reference_genome,Reference)")) {
          return HttpResponse.json({
            response: { numFound: 1, docs: [reference] },
          });
        }
        if (query.includes("eq(reference_genome,Representative)")) {
          return HttpResponse.json({
            response: { numFound: 1, docs: [representative] },
          });
        }
        return HttpResponse.json({
          response: { numFound: 2, docs: [] },
          facet_counts: {
            facet_fields: {
              reference_genome: ["Reference", 1, "Representative", 1],
            },
          },
        });
      }),
    );

    const element = await ReferenceGenomes({
      taxonId: 10239,
      genomeList: { pathname: "/taxonomy/10239", params: { tab: "genomes" } },
    });

    expect(element.type).toBe(LazyReferenceGenomesClient);
    expect(element.props).toMatchObject({
      rows: [reference, representative],
      counts: { Reference: 1, Representative: 1 },
      total: 2,
      hrefs: {
        all: "/taxonomy/10239?tab=genomes&reference_genome=Reference&reference_genome=Representative",
        byType: {
          Reference: "/taxonomy/10239?tab=genomes&reference_genome=Reference",
          Representative:
            "/taxonomy/10239?tab=genomes&reference_genome=Representative",
        },
      },
    });
  });

  it("links All to the one type a type-filtered Genome list holds, not to both", async () => {
    // /genome?reference_genome=Reference: the facet holds only Reference, and
    // genomeListValuesHref overwrites that filter, so a link naming both types
    // would list more genomes than the "View all N" it sits under.
    server.use(
      http.get(`${baseUrl}/genome/`, ({ request }) => {
        const query = decodeURIComponent(request.url);
        if (query.includes("facet(")) {
          return HttpResponse.json({
            response: { numFound: 5000, docs: [] },
            facet_counts: {
              facet_fields: { reference_genome: ["Reference", 5000] },
            },
          });
        }
        return HttpResponse.json({
          response: { numFound: 5000, docs: [reference] },
        });
      }),
    );
    const state = parseGenomeCollectionState({
      reference_genome: "Reference",
      tab: "overview",
    });
    const genomeQuery = genomeOverviewScope(state);
    if (!genomeQuery) throw new Error("expected a public genome scope");

    const element = await ReferenceGenomes({
      genomeQuery,
      genomeList: { pathname: "/genome", state },
    });

    // objectContaining compares `hrefs` whole, so a link for the empty
    // Representative type would fail it.
    expect(element.props).toEqual(
      expect.objectContaining({
        rows: [reference],
        counts: { Reference: 5000, Representative: 0 },
        total: 5000,
        hrefs: {
          all: "/genome?reference_genome=Reference",
          byType: { Reference: "/genome?reference_genome=Reference" },
        },
      }),
    );
  });
});
