import {
  genomeIdsFromStrains,
  isStrainAccessionField,
  parseStrainCollectionState,
  strainAccessionUrlTemplate,
  strainCollectionProfile,
  strainStructuralRql,
  strainViewRecordSchema,
} from "@/lib/strain-view";

const segmentFields = [
  "1_pb2",
  "2_pb1",
  "3_pa",
  "4_ha",
  "5_np",
  "6_na",
  "7_mp",
  "8_ns",
  "other_segments",
];

describe("Strain view contracts", () => {
  it("preserves backend order and validates supported sorts", () => {
    expect(parseStrainCollectionState({}).sort).toBe("unsorted");
    expect(parseStrainCollectionState({ sort: "strain:asc" }).sort).toBe(
      "strain:asc",
    );
    expect(parseStrainCollectionState({ sort: "genome_ids:asc" }).sort).toBe(
      "unsorted",
    );
  });

  it("uses backend id and remains list-only", () => {
    expect(strainCollectionProfile.idField).toBe("id");
    expect(strainCollectionProfile.basePredicate).toBe("eq(id,*)");
    expect(strainCollectionProfile.rowHref).toBeUndefined();
    expect(strainCollectionProfile.detailFields).toContain("genome_ids");
    expect(strainCollectionProfile.guideUrl).toContain("strains.html");
  });

  it("retains segment columns and renders all multivalue links separately", () => {
    for (const field of segmentFields) {
      const column = strainCollectionProfile.columns.find(
        (candidate) => candidate.id === field,
      );
      expect(column, `expected ${field} column`).toBeDefined();
      expect(column?.sortable).toBe(false);
      expect(column?.valueHref).toContain("ncbi.nlm.nih.gov/nuccore/{value}");
    }
    expect(
      strainCollectionProfile.columns.find(
        (column) => column.id === "genome_ids",
      )?.valueHref,
    ).toBe("/genome/{value}");
  });

  it("shares the NCBI accession policy with detail-only segment fields", () => {
    expect(strainAccessionUrlTemplate).toBe(
      "https://www.ncbi.nlm.nih.gov/nuccore/{value}",
    );
    for (const field of [
      "genbank_accessions",
      ...segmentFields,
      "s",
      "m",
      "l",
    ]) {
      expect(isStrainAccessionField(field), field).toBe(true);
    }
    expect(isStrainAccessionField("genome_ids")).toBe(false);
  });

  it("uses typed phrase filters with OR within a field and AND across fields", () => {
    const state = parseStrainCollectionState({
      strain: ["A/B, isolate (one)", "H1N1", "H1N1"],
      status: "Complete",
      taxon_id: "11520",
      page: "2",
    });
    expect(state.filters.strain).toEqual(["A/B, isolate (one)", "H1N1"]);
    expect(state.page).toBe(2);
    expect(strainStructuralRql(state)).toBe(
      'and(eq(taxon_lineage_ids,11520),or(eq(strain,"A%2FB%2C%20isolate%20%28one%29"),eq(strain,"H1N1")),eq(status,Complete))',
    );
  });

  it("gives explicit RQL precedence and rejects transport operators", () => {
    const state = parseStrainCollectionState({
      strain: "H1N1",
      rql: "eq(status,Complete)",
    });
    expect(state.filters).toEqual({});
    expect(strainStructuralRql(state)).toBeUndefined();
    expect(() => parseStrainCollectionState({ rql: "sort(+strain)" })).toThrow(
      "Transport operator",
    );
  });

  it("extracts unique associated genome IDs in first-seen order", () => {
    expect(
      genomeIdsFromStrains([
        { genome_ids: [" 641501.3 ", 641501.4, "641501.3", ""] },
        { genome_ids: null },
        { genome_ids: [false, {}, "641501.5"] },
      ]),
    ).toEqual(["641501.3", "641501.4", "641501.5"]);
    expect(genomeIdsFromStrains([{ genome_ids: "641501.3" }, {}])).toEqual([]);
  });

  it("validates multivalue accessions while retaining extra fields", () => {
    expect(
      strainViewRecordSchema.parse({
        id: "strain-row-1",
        strain: "A/test/1/2024",
        genome_ids: ["1.1", "1.2"],
        "4_ha": ["CY000001", "CY000002"],
        custom_field: "retained",
      }),
    ).toMatchObject({ custom_field: "retained" });
    expect(() =>
      strainViewRecordSchema.parse({ id: "strain-row-1", genome_ids: "1.1" }),
    ).toThrow();
  });
});
