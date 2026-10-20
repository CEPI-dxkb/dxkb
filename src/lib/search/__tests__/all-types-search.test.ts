import { http, HttpResponse } from "msw";

import {
  allTypesSearchPath,
  allTypesSearchQueryOptions,
  describeRows,
  fetchTypeMatches,
  formatCompact,
  toAllTypesResults,
  typeSearchQuery,
} from "../all-types-search";
import { DataRepositoryError } from "@/lib/data-api/client";
import { isUpstreamOutage } from "@/lib/api/query-retry";
import { server } from "@/test-helpers/msw-server";

const searchRoute = `*${allTypesSearchPath}`;

describe("typeSearchQuery", () => {
  it.each([
    ["taxonomy", "keyword(influenza)&gt(genomes,1)&limit(5)&sort(-genomes)"],
    [
      "genome_feature",
      "keyword(influenza)&ne(annotation,brc1)&ne(feature_type,source)&limit(5)&sort(+annotation,-score)",
    ],
    ["epitope", "keyword(influenza)&limit(5)&sort(-score)"],
  ])("builds the %s query", (id, expected) => {
    expect(typeSearchQuery(id, "influenza", 5)).toBe(expected);
  });
});

describe("fetchTypeMatches", () => {
  it("asks the same-origin search route, naming only the keyword", async () => {
    let sent: unknown;
    const matches = { genome: { result: { response: { numFound: 3 } } } };
    server.use(
      http.post(searchRoute, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json(matches);
      }),
    );

    await expect(fetchTypeMatches("influenza")).resolves.toEqual(matches);
    expect(sent).toEqual({ keyword: "influenza" });
  });

  it("keeps the route's own message and status, so an outage is not retried", async () => {
    const message =
      "The BV-BRC data service did not respond (connection timed out after 10 s).";
    server.use(
      http.post(searchRoute, () =>
        HttpResponse.json(
          { error: message, code: "upstream_timeout" },
          { status: 504 },
        ),
      ),
    );

    const error: unknown = await fetchTypeMatches("influenza").catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(DataRepositoryError);
    expect(error).toMatchObject({
      message,
      status: 504,
      code: "upstream_timeout",
    });
    expect(isUpstreamOutage(error)).toBe(true);
  });

  it("reports a failed request without a message by its status", async () => {
    server.use(
      http.post(searchRoute, () => new HttpResponse("oops", { status: 500 })),
    );
    await expect(fetchTypeMatches("influenza")).rejects.toThrow(
      "Search request failed with status 500.",
    );
  });

  it("says the search service could not be reached, keeping the browser's reason", async () => {
    server.use(http.post(searchRoute, () => HttpResponse.error()));

    await expect(fetchTypeMatches("influenza")).rejects.toThrow(
      /^Could not reach the DXKB search service \(.+\)\. Check your connection and try again\.$/,
    );
  });

  it("is not enabled for text with no search terms", () => {
    expect(allTypesSearchQueryOptions('""').enabled).toBe(false);
    expect(allTypesSearchQueryOptions("coli").enabled).toBe(true);
  });
});

describe("describeRows", () => {
  it("describes a Strain by its own species, host and segments, linking its record", () => {
    expect(
      describeRows("strain", [
        {
          id: "s1",
          strain: "A/Ohio/1/2020",
          species: "Influenza A virus",
          host_name: "Human",
          collection_year: 2020,
          segment_count: 8,
          genbank_accessions: ["CY000001", "CY000002"],
        },
      ]),
    ).toEqual([
      {
        key: "s1",
        title: "A/Ohio/1/2020",
        monoTitle: false,
        context: "Influenza A virus · Human",
        facts: [
          { label: "Year", value: "2020" },
          { label: "Segments", value: "8 segments" },
        ],
        id: "CY000001",
        href: "/strain/s1",
      },
    ]);
  });

  it("leaves a Strain without a record ID unlinked", () => {
    const [row] = describeRows("strain", [{ strain: "A/China" }]);
    expect(row).toMatchObject({ key: "strain-0", href: null });
  });

  it("describes a Domain or Motif by its InterPro entry, linking its feature", () => {
    const [row] = describeRows("protein_feature", [
      {
        id: "pf1",
        feature_id: "PATRIC.11320.1.CDS.1.566.fwd",
        patric_id: "fig|11320.1.peg.1",
        interpro_description: "Hemagglutinin",
        interpro_id: "IPR001364",
        product: "HA",
        genome_name: "Influenza A virus",
        source: "PFAM",
        source_id: "PF00509",
        start: 1,
        end: 566,
      },
    ]);
    expect(row).toMatchObject({
      title: "Hemagglutinin",
      context: "HA · Influenza A virus",
      id: "IPR001364",
      href: "/feature/PATRIC.11320.1.CDS.1.566.fwd",
      facts: [
        { label: "Source", value: "PFAM PF00509" },
        { label: "Position", value: "1–566" },
      ],
    });
  });

  it("links a Domain or Motif by its PATRIC ID when it has no feature ID", () => {
    const [row] = describeRows("protein_feature", [
      { id: "pf1", patric_id: "fig|11320.1.peg.1" },
    ]);
    expect(row.href).toBe("/feature/fig%7C11320.1.peg.1");
  });

  it("leaves a Domain or Motif without a feature unlinked", () => {
    const [row] = describeRows("protein_feature", [{ id: "pf1" }]);
    expect(row).toMatchObject({ key: "pf1", href: null });
  });

  it("shows an Epitope's sequence in mono and links it", () => {
    const [row] = describeRows("epitope", [
      { epitope_id: 12345, epitope_sequence: "GILGFVFTL", host_name: ["Human"] },
    ]);
    expect(row).toMatchObject({
      monoTitle: true,
      title: "GILGFVFTL",
      id: "IEDB 12345",
      href: "/epitope/12345",
      facts: [{ label: "Host", value: "Human" }],
    });
  });

  it.each([
    [["PCR"], "/surveillance/S-1?pathogen_test_type=PCR"],
    ["PCR", "/surveillance/S-1?pathogen_test_type=PCR"],
    // Tested more than one way: the member page asks which.
    [["PCR", "Culture"], "/surveillance/S-1"],
  ])(
    "links a Surveillance sample tested %j to %s",
    (pathogenTestType, href) => {
      const [row] = describeRows("surveillance", [
        {
          id: "row-1",
          sample_identifier: "S-1",
          pathogen_test_type: pathogenTestType,
          host_common_name: "Mallard",
          collection_country: "Canada",
          collection_date: "2021-04-02T00:00:00Z",
        },
      ]);
      expect(row.title).toBe("Mallard · Canada · 2021");
      expect(row.href).toBe(href);
    },
  );

  it("names a Serology sample by its ID and links it with its test type", () => {
    const [row] = describeRows("serology", [
      {
        id: "row-1",
        sample_identifier: "SR-1",
        host_common_name: "Human",
        collection_country: "Australia",
        collection_date: "2024-07",
        test_type: "HI",
        test_result: "Detected",
        serotype: "H1N1",
      },
    ]);
    expect(row).toMatchObject({
      title: "SR-1",
      context: "Human · Australia · 2024",
      href: "/serology/SR-1?test_type=HI",
    });
  });

  it("leaves a row without an ID unlinked, keyed by its place", () => {
    expect(describeRows("genome", [{ genome_name: "Unnamed" }])).toEqual([
      expect.objectContaining({ key: "genome-0", id: "", href: null }),
    ]);
  });

  it("names a row missing its title fields by its ID, or as Untitled", () => {
    expect(
      describeRows("genome", [{ genome_id: "11320.1" }, {}]).map(
        (row) => row.title,
      ),
    ).toEqual(["11320.1", "Untitled"]);
  });
});

describe("toAllTypesResults", () => {
  it("lists every DXKB type, zero-count ones included, and totals them", () => {
    const { types, total, bestMatch } = toAllTypesResults(
      {
        genome: { result: { response: { docs: [], numFound: 12 } } },
        experiment: { result: { response: { docs: [], numFound: 3 } } },
      },
      "influenza",
    );
    expect(types).toHaveLength(10);
    expect(types.find((type) => type.id === "strain")).toMatchObject({
      label: "Strains",
      count: 0,
      listHref: "/strain?keyword=influenza",
      contextLabel: "Species · Host",
    });
    expect(total).toBe(15);
    expect(bestMatch).toBeNull();
  });

  it("counts a type with a partial answer as zero, not as an error", () => {
    const { types, total, bestMatch } = toAllTypesResults(
      {
        genome: {},
        taxonomy: { result: {} },
        strain: { result: { response: { numFound: 2 } } },
      },
      "influenza",
    );
    expect(types.find((type) => type.id === "genome")).toMatchObject({
      count: 0,
      rows: [],
    });
    expect(types.find((type) => type.id === "strain")).toMatchObject({
      count: 2,
      rows: [],
    });
    expect(total).toBe(2);
    expect(bestMatch).toBeNull();
  });

  it("takes the best match from the top taxon", () => {
    const { bestMatch } = toAllTypesResults(
      {
        taxonomy: {
          result: {
            response: {
              numFound: 1,
              docs: [
                {
                  taxon_id: 2697049,
                  taxon_name: "SARS-CoV-2",
                  taxon_rank: "no rank",
                  genomes: 9_000_000,
                  lineage_names: [
                    "Viruses",
                    "Coronaviridae",
                    "Betacoronavirus",
                    "Severe acute respiratory syndrome-related coronavirus",
                    "SARS-CoV-2",
                  ],
                },
              ],
            },
          },
        },
      },
      "SARS-CoV-2",
    );
    expect(bestMatch).toEqual({
      name: "SARS-CoV-2",
      taxonId: "2697049",
      href: "/taxonomy/2697049",
      genomes: 9_000_000,
      rank: "No rank",
      parents: [
        "Betacoronavirus",
        "Severe acute respiratory syndrome-related coronavirus",
      ],
    });
  });
});

describe("formatCompact", () => {
  it("shortens large counts", () => {
    expect(formatCompact(2_234_567)).toBe("2.2M");
    expect(formatCompact(12)).toBe("12");
  });
});
