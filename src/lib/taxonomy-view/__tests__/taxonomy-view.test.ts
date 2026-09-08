import {
  normalizeTaxonIds,
  parseTaxonomyCollectionState,
  taxonomyBlastPrefill,
  taxonomyCollectionProfile,
  taxonomyFeaturesHref,
  taxonomyGenomesHref,
  taxonomyStructuralRql,
  taxonomyViewRecordSchema,
} from "@/lib/taxonomy-view";

describe("Taxonomy view contract", () => {
  it("parses canonical collection state and composes multi-value facets", () => {
    const state = parseTaxonomyCollectionState({
      keyword: "influenza",
      taxon_rank: ["species", "genus", "species"],
      division: "Viruses",
      page: "2",
      sort: "taxon_name:asc",
    });

    expect(state).toMatchObject({
      keyword: "influenza",
      page: 2,
      sort: "taxon_name:asc",
      filters: {
        taxon_rank: ["species", "genus"],
        division: ["Viruses"],
      },
    });
    expect(taxonomyStructuralRql(state)).toBe(
      "and(or(eq(taxon_rank,species),eq(taxon_rank,genus)),eq(division,Viruses))",
    );
  });

  it("validates explicit RQL and makes it authoritative", () => {
    const state = parseTaxonomyCollectionState({
      rql: "eq(lineage_ids,10239)",
      division: "Viruses",
    });
    expect(state.rql).toBe("eq(lineage_ids,10239)");
    expect(state.filters).toEqual({});
    expect(taxonomyStructuralRql(state)).toBeUndefined();
    expect(() =>
      parseTaxonomyCollectionState({ rql: "limit(10)" }),
    ).toThrow(/transport operator/i);
  });

  it("uses the requested visible columns and canonical links", () => {
    expect(
      taxonomyCollectionProfile.columns
        .filter((column) => column.visible)
        .map((column) => column.id),
    ).toEqual([
      "taxon_id",
      "taxon_name",
      "taxon_rank",
      "other_names",
      "genetic_code",
      "genomes",
    ]);
    expect(taxonomyCollectionProfile.serverKeywordMode).toBe("exact");
    expect(taxonomyCollectionProfile.rowLinkFields).toEqual([
      "taxon_id",
      "taxon_name",
    ]);
    expect(taxonomyCollectionProfile.rowHref?.({ taxon_id: "00123" })).toBe(
      "/taxonomy/00123",
    );
  });

  it("validates string Taxon identities and multivalue metadata", () => {
    expect(
      taxonomyViewRecordSchema.parse({
        taxon_id: "11520",
        taxon_name: "Influenza A virus",
        other_names: ["Influenza A"],
        lineage_ids: ["10239", 11308, "11520"],
      }),
    ).toMatchObject({ taxon_id: "11520" });
    expect(() => taxonomyViewRecordSchema.parse({ taxon_id: 11520 })).toThrow();
    expect(() => taxonomyViewRecordSchema.parse({ taxon_id: "0" })).toThrow();
  });

  it("deduplicates Taxon IDs and builds bounded canonical actions", () => {
    expect(normalizeTaxonIds(["234", 10239, "234"])).toEqual(["234", "10239"]);
    expect(taxonomyGenomesHref(["234", "10239"])).toBe(
      "/genome?rql=in(taxon_lineage_ids%2C(234%2C10239))",
    );
    expect(taxonomyFeaturesHref(["234"])).toBe(
      "/feature?rql=and(eq(genome_id%2C*)%2Cgenome(in(taxon_lineage_ids%2C(234)))%2Ceq(annotation%2CPATRIC))",
    );
    expect(taxonomyBlastPrefill(["234", "234"])).toEqual({
      db_precomputed_database: "selTaxon",
      db_source: "taxon_list",
      db_taxon_list: ["234"],
    });
    expect(() => normalizeTaxonIds(["not-an-id"])).toThrow(/positive integer/);
  });
});
