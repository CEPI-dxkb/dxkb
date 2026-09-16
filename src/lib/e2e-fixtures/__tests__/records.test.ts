import {
  biosetRecordSchema,
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
