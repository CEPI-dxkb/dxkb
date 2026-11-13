import {
  parseProteinFeatureCollectionState,
  proteinFeatureCollectionProfile,
  proteinFeatureStructuralRql,
  proteinFeatureViewRecordSchema,
} from "@/lib/protein-feature-view";

const facetFields = ["feature_type", "source", "classification", "evidence"];

describe("Domains and Motifs view contracts", () => {
  it("uses backend id and remains list-only without a Deprecated filter", () => {
    expect(proteinFeatureCollectionProfile.resource).toBe("protein_feature");
    expect(proteinFeatureCollectionProfile.idField).toBe("id");
    expect(proteinFeatureCollectionProfile.basePredicate).toBe("eq(id,*)");
    expect(proteinFeatureCollectionProfile.basePredicate).not.toContain(
      "Deprecated",
    );
    expect(proteinFeatureCollectionProfile.rowLinkField).toBe("patric_id");
    expect(
      proteinFeatureCollectionProfile.columns
        .find((column) => column.id === "patric_id")
        ?.fallbackValue?.({ feature_id: "fig|83332.12.peg.1" }),
    ).toBe("fig|83332.12.peg.1");
    expect(proteinFeatureCollectionProfile.detailFields).toContain(
      "feature_id",
    );
    expect(proteinFeatureCollectionProfile.detailFields).toContain("genome_id");
  });

  it("provides canonical internal links and preserves external links", () => {
    expect(
      proteinFeatureCollectionProfile.columns.find(
        (column) => column.id === "genome_id",
      )?.valueHref,
    ).toBe("/genome/{value}");
    expect(
      proteinFeatureCollectionProfile.columns.find(
        (column) => column.id === "taxon_id",
      )?.valueHref,
    ).toBe("/taxonomy/{value}");
    expect(
      proteinFeatureCollectionProfile.columns.find(
        (column) => column.id === "patric_id",
      )?.valueHref,
    ).toBe("/feature/{value}");
    expect(
      proteinFeatureCollectionProfile.columns.find(
        (column) => column.id === "interpro_id",
      )?.valueHref,
    ).toContain("ebi.ac.uk/interpro");
    expect(
      proteinFeatureCollectionProfile.rowHref?.({
        id: "pf-1",
        feature_id: "PATRIC.1/2",
      }),
    ).toBe("/feature/PATRIC.1%2F2");
  });

  it("exposes the established facets and canonical backend fields", () => {
    expect(
      proteinFeatureCollectionProfile.facets?.map((facet) => facet.field),
    ).toEqual(facetFields);
    expect(proteinFeatureCollectionProfile.detailFields).toContain(
      "date_inserted",
    );
    expect(proteinFeatureCollectionProfile.detailFields).not.toContain(
      "date_added",
    );
  });

  it("builds OR-within and AND-across exact scopes", () => {
    const state = parseProteinFeatureCollectionState({
      genome_id: "83332.12",
      feature_id: "fig|83332.12.peg.1",
      source: ["InterPro", "CDD", "CDD"],
    });
    expect(proteinFeatureStructuralRql(state)).toBe(
      "and(eq(genome_id,83332.12),eq(feature_id,fig%7C83332.12.peg.1),or(eq(source,InterPro),eq(source,CDD)))",
    );
  });

  it("validates sorts and keeps friendly filters beside explicit RQL", () => {
    expect(
      parseProteinFeatureCollectionState({ sort: "source:desc" }).sort,
    ).toBe("source:desc");
    expect(
      parseProteinFeatureCollectionState({ sort: "missing:asc" }).sort,
    ).toBe("unsorted");
    const state = parseProteinFeatureCollectionState({
      genome_id: "83332.12",
      rql: "eq(source,InterPro)",
    });
    expect(state.filters).toEqual({ genome_id: ["83332.12"] });
    expect(proteinFeatureStructuralRql(state)).toBe("eq(genome_id,83332.12)");
    expect(() =>
      parseProteinFeatureCollectionState({ rql: "sort(+source)" }),
    ).toThrow("Transport operator");
  });

  it("validates row identity while retaining extra fields", () => {
    expect(
      proteinFeatureViewRecordSchema.parse({
        id: "pf-1",
        patric_id: "fig|83332.12.peg.1",
        custom_field: "retained",
      }),
    ).toMatchObject({ custom_field: "retained" });
    expect(() => proteinFeatureViewRecordSchema.parse({})).toThrow();
  });
});
