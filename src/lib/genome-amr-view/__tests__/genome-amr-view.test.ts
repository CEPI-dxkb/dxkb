import { validateRql } from "@/lib/data-api";
import {
  genomeAmrCollectionProfile,
  genomeAmrStructuralRql,
} from "@/lib/genome-amr-view";
import { genomesChildRql } from "@/lib/views/child-resources";

describe("AMR Phenotypes collection profile", () => {
  it("lists genome_amr rows by id", () => {
    expect(genomeAmrCollectionProfile).toEqual(
      expect.objectContaining({
        resource: "genome_amr",
        label: "AMR Phenotypes",
        idField: "id",
        basePredicate: "eq(id,*)",
        guideUrl:
          "https://www.bv-brc.org/docs/quick_references/organisms_taxon/amr_phenotypes.html",
      }),
    );
  });

  it("offers legacy's visible facets in legacy's order", () => {
    const visible = genomeAmrCollectionProfile.facets
      ?.filter((facet) => facet.initiallyVisible)
      .map((facet) => facet.field);
    expect(visible).toEqual([
      "antibiotic",
      "resistant_phenotype",
      "laboratory_typing_method",
      "computational_method",
      "evidence",
      "pmid",
      "public",
    ]);
  });

  it("offers no measurement_value facet, as legacy does not", () => {
    expect(
      genomeAmrCollectionProfile.facets?.map((facet) => facet.field),
    ).not.toContain("measurement_value");
  });

  it("lays out legacy AMRPanelGrid's columns in its order and visibility", () => {
    expect(
      genomeAmrCollectionProfile.columns.map((column) => [
        column.id,
        column.visible,
      ]),
    ).toEqual([
      ["taxon_id", false],
      ["genome_id", false],
      ["genome_name", true],
      ["antibiotic", true],
      ["resistant_phenotype", true],
      ["measurement_sign", true],
      ["measurement_value", true],
      ["measurement_unit", true],
      ["laboratory_typing_method", true],
      ["laboratory_typing_method_version", false],
      ["laboratory_typing_platform", false],
      ["vendor", false],
      ["testing_standard", false],
      ["testing_standard_year", false],
      ["computational_method", true],
      ["computational_method_version", false],
      ["computational_method_performance", false],
      ["evidence", true],
      ["pmid", true],
    ]);
  });

  it("links each PubMed ID to PubMed", () => {
    expect(
      genomeAmrCollectionProfile.columns.find((column) => column.id === "pmid")
        ?.valueHref,
    ).toBe("https://pubmed.ncbi.nlm.nih.gov/{value}/");
  });

  it("links each phenotype's genome", () => {
    const columns = genomeAmrCollectionProfile.columns;
    expect(columns.find((column) => column.id === "genome_id")?.valueHref).toBe(
      "/genome/{value}",
    );
    expect(
      columns.find((column) => column.id === "genome_name")?.valueHref,
    ).toBe("/genome/{genome_id}");
  });

  it("turns facet selections into genome_amr filters", () => {
    expect(
      genomeAmrStructuralRql({
        filters: { resistant_phenotype: ["Resistant"] },
        page: 1,
        sort: "unsorted",
      }),
    ).toBe("eq(resistant_phenotype,Resistant)");
  });

  it("scopes a taxon through a genome join the Data API accepts", () => {
    const rql = genomesChildRql(
      "and(eq(taxon_lineage_ids,1386),ne(genome_status,Deprecated))",
    );
    expect(rql).toBe(
      "and(eq(genome_id,*),genome(and(eq(taxon_lineage_ids,1386),ne(genome_status,Deprecated))))",
    );
    expect(validateRql("genome_amr", rql)).toBe(
      "and(eq(genome_id,%2A),genome(and(eq(taxon_lineage_ids,1386),ne(genome_status,Deprecated))))",
    );
  });
});
