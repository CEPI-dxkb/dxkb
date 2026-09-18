import type { DataResource } from "@/lib/data-api";
import { getResourceDefinition } from "@/lib/data-api/resources";
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
      expect(proteinStructureRecordSchema.safeParse(record).success).toBe(true);
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

/**
 * `safeParse(...).success === true` above is a weaker check than it looks.
 * Every schema in `src/lib/data-api/schemas.ts` is a `z.looseObject` with only
 * the id required, so it catches type-shape drift (array to string) but not
 * field DELETION: `biosetRecord` could lose `exp_id` — the key that ties it to
 * `experimentRecord`, which the Bioset action suites need — and still parse.
 * These close that direction.
 */
describe("canonical E2E fixture records keep the keys they carry", () => {
  const registryBacked: {
    name: string;
    resource: DataResource;
    // `object`, not `Record<string, unknown>`: the `*FixtureRecord`
    // interfaces declare their fields explicitly and carry no index
    // signature. These assertions only ever read `Object.keys`.
    record: object;
  }[] = [
    { name: "taxonomyRecord", resource: "taxonomy", record: taxonomyRecord },
    { name: "genomeRecord", resource: "genome", record: genomeRecord },
    {
      name: "genomeFeatureRecord",
      resource: "genome_feature",
      record: genomeFeatureRecord,
    },
    {
      name: "genomeSequenceRecord",
      resource: "genome_sequence",
      record: genomeSequenceRecord,
    },
    {
      name: "proteinFeatureRecord",
      resource: "protein_feature",
      record: proteinFeatureRecord,
    },
    {
      name: "proteinStructureRecords[0]",
      resource: "protein_structure",
      record: proteinStructureRecords[0],
    },
    { name: "epitopeRecord", resource: "epitope", record: epitopeRecord },
    {
      name: "epitopeAssayRecords[0]",
      resource: "epitope_assay",
      record: epitopeAssayRecords[0],
    },
    {
      name: "experimentRecord",
      resource: "experiment",
      record: experimentRecord,
    },
    { name: "biosetRecord", resource: "bioset", record: biosetRecord },
    { name: "strainRecords[0]", resource: "strain", record: strainRecords[0] },
    {
      name: "surveillanceRecord",
      resource: "surveillance",
      record: surveillanceRecord,
    },
    { name: "serologyRecord", resource: "serology", record: serologyRecord },
    {
      name: "genomeAmrRecord",
      resource: "genome_amr",
      record: genomeAmrRecord,
    },
  ];

  // Reads the REGISTRY rather than a restated literal, so a fixture that drops
  // its id key and a registry that renames `idField` both fail here.
  it.each(registryBacked)(
    "$name carries the id field the $resource registry declares",
    ({ resource, record }) => {
      expect(Object.keys(record)).toContain(
        getResourceDefinition(resource).idField,
      );
    },
  );

  /**
   * The keys each fixture carries today. Adding a key is free — these use
   * `arrayContaining`, not an exact set — but REMOVING one must be deliberate,
   * which is the drift direction the Zod parse above cannot see.
   */
  const requiredKeys: Record<string, readonly string[]> = {
    taxonomyRecord: [
      "taxon_id",
      "taxon_name",
      "taxon_rank",
      "other_names",
      "genetic_code",
      "lineage_ids",
      "lineage_names",
      "parent_id",
      "division",
      "description",
      "genomes",
    ],
    genomeRecord: [
      "genome_id",
      "genome_name",
      "strain",
      "superkingdom",
      "genome_status",
      "genome_quality",
      "genome_length",
      "contigs",
      "cds",
      "collection_year",
      "isolation_country",
      "host_common_name",
      "genbank_accessions",
      "taxon_id",
      "taxon_lineage_ids",
      "taxon_lineage_names",
    ],
    genomeFeatureRecord: [
      "feature_id",
      "patric_id",
      "genome_id",
      "genome_name",
      "taxon_id",
      "annotation",
      "feature_type",
      "accession",
      "start",
      "end",
      "strand",
      "product",
      "aa_length",
    ],
    genomeSequenceRecord: ["sequence_id", "genome_id", "accession", "length"],
    proteinFeatureRecord: [
      "id",
      "genome_id",
      "genome_name",
      "taxon_id",
      "feature_id",
      "patric_id",
      "refseq_locus_tag",
      "gene",
      "product",
      "interpro_id",
      "interpro_description",
      "feature_type",
      "source",
      "source_id",
      "description",
      "classification",
      "e_value",
      "evidence",
      "date_inserted",
    ],
    "proteinStructureRecords[0]": [
      "pdb_id",
      "title",
      "organism_name",
      "taxon_id",
      "taxon_lineage_ids",
      "taxon_lineage_names",
      "genome_id",
      "patric_id",
      "uniprotkb_accession",
      "gene",
      "product",
      "sequence_md5",
      "method",
      "resolution",
      "pmid",
      "institution",
      "authors",
      "release_date",
      "file_path",
      "date_inserted",
    ],
    epitopeRecord: [
      "epitope_id",
      "epitope_type",
      "epitope_sequence",
      "organism",
      "taxon_id",
      "taxon_lineage_ids",
      "protein_name",
      "protein_accession",
      "host_name",
      "total_assays",
      "assay_results",
      "bcell_assays",
      "tcell_assays",
      "mhc_assays",
      "comments",
      "date_inserted",
    ],
    "epitopeAssayRecords[0]": [
      "assay_id",
      "epitope_id",
      "assay_type",
      "assay_method",
      "assay_group",
      "assay_result",
      "host_name",
      "pmid",
      "title",
      "protein_name",
      "epitope_type",
    ],
    experimentRecord: [
      "exp_id",
      "study_name",
      "study_title",
      "study_description",
      "study_pi",
      "study_institution",
      "exp_name",
      "exp_title",
      "exp_description",
      "public_repository",
      "public_identifier",
      "pmid",
      "exp_type",
      "measurement_technique",
      "organism",
      "taxon_id",
      "taxon_lineage_ids",
      "strain",
      "treatment_type",
      "treatment_name",
      "samples",
      "biosets",
      "genome_id",
      "date_inserted",
    ],
    biosetRecord: [
      "bioset_id",
      "exp_id",
      "study_name",
      "exp_name",
      "exp_title",
      "exp_type",
      "bioset_name",
      "bioset_description",
      "bioset_type",
      "bioset_criteria",
      "organism",
      "strain",
      "entity_count",
      "date_inserted",
    ],
    "strainRecords[0]": [
      "id",
      "taxon_id",
      "taxon_lineage_ids",
      "family",
      "genus",
      "species",
      "strain",
      "subtype",
      "genome_ids",
      "genbank_accessions",
      "segment_count",
      "status",
      "host_common_name",
      "isolation_country",
      "collection_date",
      "collection_year",
      "1_pb2",
      "4_ha",
    ],
    surveillanceRecord: [
      "id",
      "sample_identifier",
      "contributing_institution",
      "sample_material",
      "collection_date",
      "collection_year",
      "collection_country",
      "collection_state_province",
      "collection_latitude",
      "collection_longitude",
      "pathogen_test_type",
      "pathogen_test_result",
      "pathogen_test_interpretation",
      "pathogen_type",
      "host_identifier",
      "host_common_name",
    ],
    serologyRecord: [
      "id",
      "sample_identifier",
      "contributing_institution",
      "host_identifier",
      "host_type",
      "host_species",
      "host_common_name",
      "collection_date",
      "collection_year",
      "collection_country",
      "collection_state",
      "test_type",
      "test_result",
      "test_interpretation",
      "serotype",
    ],
    genomeAmrRecord: [
      "id",
      "taxon_id",
      "genome_id",
      "genome_name",
      "antibiotic",
      "resistant_phenotype",
      "evidence",
      "pmid",
      "measurement_value",
      "measurement_sign",
      "measurement_unit",
      "laboratory_typing_method",
      "testing_standard",
      "testing_standard_year",
      "computational_method",
    ],
  };

  it.each(registryBacked)("$name keeps every key it carries", ({ name, record }) => {
    expect(Object.keys(record)).toEqual(
      expect.arrayContaining([...requiredKeys[name]]),
    );
  });

  it("names a required-key list for every record in the table", () => {
    // Guards the loop above against passing vacuously if a record were added
    // to `registryBacked` with no entry in `requiredKeys`.
    expect(Object.keys(requiredKeys).sort()).toEqual(
      registryBacked.map((entry) => entry.name).sort(),
    );
  });
});

/**
 * Three fixture sets are meant to join. Asserting the join rather than mere key
 * presence means a fixture that drops the foreign key AND one that renames the
 * parent both fail. `genomeAmrRecord.genome_id` and `taxonomyRecord.taxon_id`
 * deliberately point at neither `genomeRecord` nor each other, so they are not
 * asserted here.
 */
describe("canonical E2E fixture records stay joined to their parents", () => {
  it("biosetRecord belongs to experimentRecord", () => {
    expect(biosetRecord.exp_id).toBe(experimentRecord.exp_id);
  });

  it("every epitopeAssayRecord belongs to epitopeRecord", () => {
    expect(epitopeAssayRecords.length).toBeGreaterThan(0);
    for (const assay of epitopeAssayRecords) {
      expect(assay.epitope_id).toBe(epitopeRecord.epitope_id);
    }
  });

  it("the feature, sequence and protein-feature rows belong to genomeRecord", () => {
    expect(genomeFeatureRecord.genome_id).toBe(genomeRecord.genome_id);
    expect(genomeSequenceRecord.genome_id).toBe(genomeRecord.genome_id);
    expect(proteinFeatureRecord.genome_id).toBe(genomeRecord.genome_id);
  });
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

describe("genomeAmrRecord agrees with what the registry declares", () => {
  // Task 19 onboarded `genome_amr` without a row fixture anywhere in the
  // repo, so nothing checked its declarations against a concrete row. These
  // read the REGISTRY — not a literal restated from the fixture — so editing
  // either side alone fails. What they cannot do is prove what the live
  // BV-BRC core returns; no test may reach a live backend.
  const definition = getResourceDefinition("genome_amr");

  it.each(["evidence", "pmid"] as const)(
    "matches the registry's %s cardinality",
    (field) => {
      // `multipleFields` itself is module-private; `cardinality` is the derived
      // public surface `buildFields` computes from it, so dropping either field
      // from `multipleFields.genome_amr` flips this to "scalar" and fails here.
      expect(definition.fields[field].cardinality).toBe("multiple");
      expect(Array.isArray(genomeAmrRecord[field])).toBe(
        definition.fields[field].cardinality === "multiple",
      );
    },
  );

  it("matches the registry's inferred type for every scalar field it carries", () => {
    // `measurement_value` and `testing_standard_year` are deliberately left
    // to inferType's string default so the gateway does not reject
    // non-numeric facet values (">=", year ranges). Assert that against the
    // registry rather than against a restated literal.
    const jsTypeFor: Record<string, string> = {
      string: "string",
      number: "number",
    };
    const checked: string[] = [];
    for (const [field, value] of Object.entries(genomeAmrRecord)) {
      if (!Object.hasOwn(definition.fields, field)) continue;
      const declared = definition.fields[field];
      if (declared.cardinality === "multiple") continue;
      if (!Object.hasOwn(jsTypeFor, declared.type)) continue;
      checked.push(field);
      expect(`${field}:${typeof value}`).toBe(
        `${field}:${jsTypeFor[declared.type]}`,
      );
    }
    // Guards the loop against passing vacuously if the fixture or the
    // registry dropped the two fields this assertion exists for.
    expect(checked).toEqual(
      expect.arrayContaining(["measurement_value", "testing_standard_year"]),
    );
  });

  it("covers the two fields Task 19 left to inferType's string default", () => {
    // Guards the loop above against vacuously passing if those fields were
    // dropped from the fixture or from the registry.
    expect(definition.fields.measurement_value.type).toBe("string");
    expect(definition.fields.testing_standard_year.type).toBe("string");
    expect(genomeAmrRecord).toHaveProperty("measurement_value");
    expect(genomeAmrRecord).toHaveProperty("testing_standard_year");
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

  it("names a positive total for the loopback's unnarrowed ppi count", () => {
    // Behaviour, not the literal: the loopback's response is asserted in
    // src/app/api/e2e-mock/[...path]/__tests__/route.test.ts, which compares
    // `numFound` against this constant.
    expect(brucellaPpiTotal).toBeGreaterThan(0);
  });
});
