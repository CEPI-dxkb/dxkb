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
  bacterialGenomeRecord,
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
  taxonGenomeCounts,
  taxonomyRecord,
} from "../records";

/** Parse each fixture with the same Zod schema production uses; a fixture the real schema rejects lies about the API. */
describe("canonical E2E fixture records parse with production Zod schemas", () => {
  it("taxonomyRecord matches taxonomyRecordSchema", () => {
    expect(taxonomyRecordSchema.safeParse(taxonomyRecord).success).toBe(true);
  });

  it("genomeRecord matches genomeRecordSchema", () => {
    expect(genomeRecordSchema.safeParse(genomeRecord).success).toBe(true);
  });

  it("bacterialGenomeRecord matches genomeRecordSchema", () => {
    expect(genomeRecordSchema.safeParse(bacterialGenomeRecord).success).toBe(
      true,
    );
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

/** Every data-api schema is a `z.looseObject` with only the id required, so `safeParse` catches type drift but not field deletion; these close that direction. */
describe("canonical E2E fixture records keep the keys they carry", () => {
  const registryBacked: {
    name: string;
    resource: DataResource;
    // `object` rather than `Record<string, unknown>`: the `*FixtureRecord` interfaces have no index signature.
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

  // Reads the registry rather than a restated literal.
  it.each(registryBacked)(
    "$name carries the id field the $resource registry declares",
    ({ resource, record }) => {
      expect(Object.keys(record)).toContain(
        getResourceDefinition(resource).idField,
      );
    },
  );

  /** Keys each fixture carries today; `arrayContaining` lets keys be added freely but removal must be deliberate. */
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
    // Guards the loop against passing vacuously.
    expect(Object.keys(requiredKeys).sort()).toEqual(
      registryBacked.map((entry) => entry.name).sort(),
    );
  });
});

/** Asserting the join, not mere key presence, fails both a dropped foreign key and a renamed parent. */
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
  // `epitope.host_name` is multi-valued in the registry, so the real Data API returns an array; pins that shape in both transports.
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
  // These read the registry, not a restated literal, so editing either side alone fails.
  const definition = getResourceDefinition("genome_amr");

  it.each(["evidence", "pmid"] as const)(
    "matches the registry's %s cardinality",
    (field) => {
      // `multipleFields` is module-private; `cardinality` is its derived public surface.
      expect(definition.fields[field].cardinality).toBe("multiple");
      expect(Array.isArray(genomeAmrRecord[field])).toBe(
        definition.fields[field].cardinality === "multiple",
      );
    },
  );

  it("matches the registry's inferred type for every scalar field it carries", () => {
    // `measurement_value` and `testing_standard_year` are left to inferType's string default so the gateway accepts non-numeric facet values.
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
    // Guards the loop against passing vacuously.
    expect(checked).toEqual(
      expect.arrayContaining(["measurement_value", "testing_standard_year"]),
    );
  });

  it("covers the two fields Task 19 left to inferType's string default", () => {
    // Guards the loop against passing vacuously.
    expect(definition.fields.measurement_value.type).toBe("string");
    expect(definition.fields.testing_standard_year.type).toBe("string");
    expect(genomeAmrRecord).toHaveProperty("measurement_value");
    expect(genomeAmrRecord).toHaveProperty("testing_standard_year");
  });
});

describe("BV-BRC website organism tables stay paired", () => {
  // The landing page fetches taxonomy and summary in one render, so a taxon missing from either table renders half a page.
  it("covers the same taxon ids in both tables", () => {
    expect(Object.keys(organismSummaryRecords).sort()).toEqual(
      Object.keys(organismTaxonomyRecords).sort(),
    );
  });

  it.each(Object.entries(organismTaxonomyRecords))(
    "taxon %s ranks every lineage entry",
    (_taxonId, record) => {
      expect(record.lineage_ranks).toHaveLength(record.lineage_ids.length);
      expect(record.lineage_names).toHaveLength(record.lineage_ids.length);
    },
  );

  it.each(Object.keys(organismTaxonomyRecords))(
    "taxon %s reports the same genome count in both tables",
    (taxonId) => {
      expect(organismSummaryRecords[taxonId].count).toBe(
        organismTaxonomyRecords[taxonId].genomes,
      );
    },
  );

  // The header's genome count leaves out Deprecated genomes, so it is strictly below the summary count.
  it("covers the same taxon ids in the header genome counts", () => {
    expect(Object.keys(taxonGenomeCounts).sort()).toEqual(
      Object.keys(organismSummaryRecords).sort(),
    );
  });

  it.each(Object.entries(taxonGenomeCounts))(
    "taxon %s header genome count leaves out Deprecated genomes",
    (taxonId, count) => {
      expect(count).toBeLessThan(organismSummaryRecords[taxonId].count);
    },
  );

  it.each(Object.entries(organismTaxonomyRecords))(
    "taxon %s key matches its record taxon_id",
    (taxonId, record) => {
      expect(String(record.taxon_id)).toBe(taxonId);
    },
  );

  it("covers the taxon ids the a11y taxonomy variants scan", () => {
    // /taxonomy/234 and /taxonomy/1763 are the two variants in e2e/a11y/routes.ts.
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
    expect(brucellaPpiTotal).toBeGreaterThan(0);
  });
});
