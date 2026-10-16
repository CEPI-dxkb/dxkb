import {
  genomeListValueHref,
  genomeStateWithValue,
  parseGenomeCollectionState,
} from "@/lib/genome-view";
import {
  toSearchParamsRecord,
  type CollectionState,
} from "@/lib/views/collection-state";

const taxonGenomes = {
  pathname: "/taxonomy/11266",
  params: { tab: "genomes" },
};

function stateOf(href: string | undefined): CollectionState {
  if (!href) throw new Error("expected a link");
  const query = href.slice(href.indexOf("?") + 1);
  return parseGenomeCollectionState(
    toSearchParamsRecord(new URLSearchParams(query)),
  );
}

describe("genomeListValueHref", () => {
  it("opens a taxon's Genomes tab filtered to the bucket's value", () => {
    expect(
      genomeListValueHref(taxonGenomes, "host_common_name", "Human"),
    ).toBe("/taxonomy/11266?tab=genomes&host_common_name=Human");
    expect(genomeListValueHref(taxonGenomes, "collection_year", "2014")).toBe(
      "/taxonomy/11266?tab=genomes&collection_year=2014",
    );
  });

  it("links every field the overview charts break genomes down by", () => {
    for (const field of [
      "host_common_name",
      "host_name",
      "host_group",
      "isolation_country",
      "isolation_source",
      "sequencing_centers",
      "collection_year",
      "family",
      "genus",
      "species",
    ]) {
      expect(stateOf(genomeListValueHref(taxonGenomes, field, "1999")).filters)
        .toEqual({ [field]: ["1999"] });
    }
  });

  it("keeps a value's spaces and punctuation intact", () => {
    const href = genomeListValueHref(
      taxonGenomes,
      "sequencing_centers",
      'UMR "Emergence des Pathologies Virales", EPV: Aix-Marseille',
    );
    expect(href).toBe(
      "/taxonomy/11266?tab=genomes&sequencing_centers=UMR+%22Emergence+des+Pathologies+Virales%22,+EPV:+Aix-Marseille",
    );
    expect(stateOf(href).filters).toEqual({
      sequencing_centers: ['UMR "Emergence des Pathologies Virales", EPV: Aix-Marseille'],
    });
  });

  it("narrows a Genome list's own query, replacing the field's other values", () => {
    const state: CollectionState = {
      keyword: "coli",
      filters: { host_common_name: ["Bat", "Human"], genome_status: ["Complete"] },
      page: 3,
      sort: "genome_name:asc",
    };
    const href = genomeListValueHref(
      { pathname: "/genome", state },
      "host_common_name",
      "Bat",
    );

    expect(href).toBe(
      "/genome?keyword=coli&genome_status=Complete&host_common_name=Bat&sort=genome_name:asc",
    );
    expect(stateOf(href)).toEqual({
      keyword: "coli",
      refine: undefined,
      rql: undefined,
      filters: { genome_status: ["Complete"], host_common_name: ["Bat"] },
      page: 1,
      sort: "genome_name:asc",
    });
  });

  it("joins the value to an explicit rql, which keeps friendly filters out", () => {
    const href = genomeListValueHref(
      {
        pathname: "/genome",
        state: {
          rql: "eq(genus,Escherichia)",
          filters: {},
          page: 1,
          sort: "unsorted",
        },
      },
      "host_group",
      "Human",
    );

    expect(stateOf(href).rql).toBe(
      "and(eq(genus,Escherichia),eq(host_group,Human))",
    );
  });

  it("links no value an eq cannot select", () => {
    expect(
      genomeListValueHref(taxonGenomes, "host_common_name", " "),
    ).toBeUndefined();
    // The Data API refuses a parenthesis in a value, encoded or not.
    expect(
      genomeListValueHref(
        taxonGenomes,
        "sequencing_centers",
        "Infectious Diseases(USAMRIID)",
      ),
    ).toBeUndefined();
  });
});

describe("genomeStateWithValue", () => {
  it("has no filter for a field the Genomes tab does not filter by", () => {
    expect(
      genomeStateWithValue(
        { filters: {}, page: 1, sort: "unsorted" },
        "genome_length",
        "5000",
      ),
    ).toBeUndefined();
  });

  it("has none beside an explicit rql either", () => {
    expect(
      genomeStateWithValue(
        {
          filters: {},
          page: 1,
          sort: "unsorted",
          rql: "eq(genus,Escherichia)",
        },
        "genome_length",
        "5000",
      ),
    ).toBeUndefined();
  });
});
