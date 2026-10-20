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

  // Legacy AMRPanelGridContainer's visible facets.
  it("offers legacy's visible facets", () => {
    const visible = genomeAmrCollectionProfile.facets
      ?.filter((facet) => facet.initiallyVisible)
      .map((facet) => facet.field);
    expect(visible).toEqual([
      "antibiotic",
      "evidence",
      "pmid",
      "resistant_phenotype",
      "laboratory_typing_method",
      "computational_method",
    ]);
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
    const rql = genomesChildRql("eq(taxon_lineage_ids,1386)");
    expect(rql).toBe("and(eq(genome_id,*),genome(eq(taxon_lineage_ids,1386)))");
    expect(validateRql("genome_amr", rql)).toBe(
      "and(eq(genome_id,%2A),genome(eq(taxon_lineage_ids,1386)))",
    );
  });
});
