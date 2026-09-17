import {
  biosetRecordSchema,
  genomeAmrRecordSchema,
  epitopeAssayRecordSchema,
  epitopeRecordSchema,
  experimentRecordSchema,
  genomeFeatureRecordSchema,
  genomeRecordSchema,
  genomeSequenceRecordSchema,
  proteinFeatureRecordSchema,
  proteinStructureRecordSchema,
  serologyRecordSchema,
  strainRecordSchema,
  surveillanceRecordSchema,
  taxonomyRecordSchema,
} from "@/lib/data-api/schemas";
import {
  ambiguousSerologyRecords,
  ambiguousSurveillanceRecords,
  biosetRecord,
  brucellaPpiTotal,
  buildBrucellaPpiRecords,
  genomeAmrRecord,
  organismSummaryRecords,
  organismTaxonomyRecords,
  epitopeAssayRecords,
  epitopeRecord,
  experimentRecord,
  genomeFeatureRecord,
  genomeRecord,
  genomeSequenceRecord,
  proteinFeatureRecord,
  proteinStructureRecords,
  serologyRecord,
  strainRecords,
  surveillanceRecord,
  taxonomyRecord,
} from "../records";

/**
 * The strongest check available for a fixture: parse it with the SAME Zod
 * schema the production Data API repository uses to validate real backend
 * responses (src/lib/data-api/schemas.ts). A fixture the real schema rejects
 * is a fixture that lies about the shape of the API.
 */
describe("canonical E2E fixture records parse with production Zod schemas", () => {
  it("taxonomyRecord matches taxonomyRecordSchema", () => {
    expect(taxonomyRecordSchema.safeParse(taxonomyRecord).success).toBe(true);
  });

  it("genomeRecord matches genomeRecordSchema", () => {
    expect(genomeRecordSchema.safeParse(genomeRecord).success).toBe(true);
  });

  it("genomeFeatureRecord matches genomeFeatureRecordSchema", () => {
    expect(
      genomeFeatureRecordSchema.safeParse(genomeFeatureRecord).success,
    ).toBe(true);
  });

  it("genomeSequenceRecord matches genomeSequenceRecordSchema", () => {
    expect(
      genomeSequenceRecordSchema.safeParse(genomeSequenceRecord).success,
    ).toBe(true);
  });

  it("proteinFeatureRecord matches proteinFeatureRecordSchema", () => {
    expect(
      proteinFeatureRecordSchema.safeParse(proteinFeatureRecord).success,
    ).toBe(true);
  });

  it.each(proteinStructureRecords)(
    "proteinStructureRecords[$pdb_id] matches proteinStructureRecordSchema",
    (record) => {
      expect(proteinStructureRecordSchema.safeParse(record).success).toBe(
        true,
      );
    },
  );

  it("epitopeRecord matches epitopeRecordSchema", () => {
    const result = epitopeRecordSchema.safeParse(epitopeRecord);
    expect(result.success).toBe(true);
  });

  it.each(epitopeAssayRecords)(
    "epitopeAssayRecords[$assay_id] matches epitopeAssayRecordSchema",
    (record) => {
      expect(epitopeAssayRecordSchema.safeParse(record).success).toBe(true);
    },
  );

  it("experimentRecord matches experimentRecordSchema", () => {
    expect(experimentRecordSchema.safeParse(experimentRecord).success).toBe(
      true,
    );
  });

  it("genomeAmrRecord matches genomeAmrRecordSchema", () => {
    expect(genomeAmrRecordSchema.safeParse(genomeAmrRecord).success).toBe(true);
  });

  it("biosetRecord matches biosetRecordSchema", () => {
    expect(biosetRecordSchema.safeParse(biosetRecord).success).toBe(true);
  });

  it.each(strainRecords)(
    "strainRecords[$id] matches strainRecordSchema",
    (record) => {
      expect(strainRecordSchema.safeParse(record).success).toBe(true);
    },
  );

  it.each([surveillanceRecord, ...ambiguousSurveillanceRecords])(
    "surveillance record $id matches surveillanceRecordSchema",
    (record) => {
      expect(surveillanceRecordSchema.safeParse(record).success).toBe(true);
    },
  );

  it.each([serologyRecord, ...ambiguousSerologyRecords])(
    "serology record $id matches serologyRecordSchema",
    (record) => {
      expect(serologyRecordSchema.safeParse(record).success).toBe(true);
    },
  );
});

describe("epitope.host_name stays array-valued (registry: multipleFields.epitope)", () => {
  // src/lib/data-api/resources.ts declares epitope.host_name as multi-valued
  // (`multipleFields.epitope`), so the real Data API returns it as an array.
  // A prior drift had the server-side loopback mock serving it as a bare
  // string (see src/app/api/e2e-mock/[...path]/route.ts history) while the
  // browser-side mock correctly used an array — this pins the fixed shape so
  // it can't silently regress back to a string in either transport.
  it("epitopeRecord.host_name is an array", () => {
    expect(Array.isArray(epitopeRecord.host_name)).toBe(true);
    expect(epitopeRecord.host_name).toEqual(["Homo sapiens, human"]);
  });

  it("epitopeRecordSchema still accepts the array form", () => {
    const result = epitopeRecordSchema.safeParse(epitopeRecord);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Array.isArray(result.data.host_name)).toBe(true);
    }
  });
});

describe("genome_amr.pmid stays array-valued (registry: multipleFields.genome_amr)", () => {
  // src/lib/data-api/resources.ts declares genome_amr.pmid multi-valued, which
  // is what makes the column unsortable in the gateway. Task 19 onboarded the
  // resource without a row fixture anywhere in the repo and could not check
  // that declaration against anything; this fixture is that check's anchor.
  // It cannot prove what the live BV-BRC core returns (no test may reach a
  // live backend), but it does mean the registry and the fixture can no
  // longer disagree silently.
  it("genomeAmrRecord.pmid is an array", () => {
    expect(Array.isArray(genomeAmrRecord.pmid)).toBe(true);
  });

  it("leaves measurement_value and testing_standard_year as strings", () => {
    // Deliberately string-typed so the gateway's inferType default keeps
    // accepting non-numeric facet values (">=", year ranges).
    expect(typeof genomeAmrRecord.measurement_value).toBe("string");
    expect(typeof genomeAmrRecord.testing_standard_year).toBe("string");
  });
});

describe("BV-BRC website organism tables stay paired", () => {
  // The organism landing page fetches taxonomy AND summary for the same taxon
  // in one render, so a taxon present in one table and missing from the other
  // renders half a page (or, before this task, an error boundary).
  it("covers the same taxon ids in both tables", () => {
    expect(Object.keys(organismSummaryRecords).sort()).toEqual(
      Object.keys(organismTaxonomyRecords).sort(),
    );
  });

  it.each(Object.keys(organismTaxonomyRecords))(
    "taxon %s reports the same genome count in both tables",
    (taxonId) => {
      expect(organismSummaryRecords[taxonId].count).toBe(
        organismTaxonomyRecords[taxonId].genomes,
      );
    },
  );

  it.each(Object.entries(organismTaxonomyRecords))(
    "taxon %s key matches its record taxon_id",
    (taxonId, record) => {
      expect(String(record.taxon_id)).toBe(taxonId);
    },
  );

  it("covers the taxon ids the a11y taxonomy variants scan", () => {
    // /taxonomy/234 and /taxonomy/1763 are the two variants in
    // e2e/a11y/routes.ts. 1763 had no fixture and scanned an error boundary.
    expect(Object.keys(organismTaxonomyRecords)).toEqual(
      expect.arrayContaining(["234", "1763"]),
    );
  });
});

describe("Brucella PPI records", () => {
  it("builds the requested number of distinct rows", () => {
    const rows = buildBrucellaPpiRecords(3);
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((row) => row.id)).size).toBe(3);
  });

  it("reports a deterministic collection total for both transports", () => {
    expect(brucellaPpiTotal).toBe(4358);
  });
});
