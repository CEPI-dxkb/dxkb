import { describe, expect, it } from "vitest";
import { featureGridDefaultOrder } from "@/lib/feature-view/query";
import { dataResources } from "../types";
import { collectionQueryOptions, dataQueryKeys } from "../query-options";
import { DataRepository } from "../client";
import { resourceRegistry } from "../resources";
import {
  epitopeAssayRecordSchema,
  epitopeRecordSchema,
  genomeAmrRecordSchema,
  genomeRecordSchema,
  proteinStructureRecordSchema,
  serologyRecordSchema,
  strainRecordSchema,
  surveillanceRecordSchema,
  taxonomyRecordSchema,
} from "../schemas";
import {
  maxExportRows,
  maxIdentifierLength,
  maxSelectedRows,
  validateDataApiRequest,
  validateDownloadRequest,
} from "../validation";

describe("data API contracts", () => {
  it("registers every required resource with an allowed stable ID", () => {
    expect(Object.keys(resourceRegistry).sort()).toEqual(
      [...dataResources].sort(),
    );
    for (const resource of dataResources) {
      const definition = resourceRegistry[resource];
      expect(() =>
        validateDataApiRequest(resource, {
          operation: "collection",
          fields: [definition.idField],
        }),
      ).not.toThrow();
      expect(() => definition.schema.parse({})).toThrow();
    }
  });

  it("registers Taxonomy with string identities and multivalue lineage fields", () => {
    expect(resourceRegistry.taxonomy.idField).toBe("taxon_id");
    expect(resourceRegistry.taxonomy.fields.taxon_rank.facet).toBe(true);
    expect(resourceRegistry.taxonomy.fields.genomes.type).toBe("number");
    for (const field of ["other_names", "lineage_ids", "lineage_names"]) {
      expect(resourceRegistry.taxonomy.fields[field].cardinality).toBe("multiple");
      expect(resourceRegistry.taxonomy.fields[field].sortable).toBe(false);
    }
    expect(
      taxonomyRecordSchema.parse({
        taxon_id: "11520",
        taxon_name: "Influenza A virus",
        lineage_ids: [10239, "11308", "11520"],
      }),
    ).toMatchObject({ taxon_id: "11520" });
  });

  it("records compound sample field cardinality explicitly", () => {
    expect(
      resourceRegistry.surveillance.fields.pathogen_test_type.cardinality,
    ).toBe("multiple");
    expect(resourceRegistry.serology.fields.test_type.cardinality).toBe(
      "scalar",
    );
    expect(
      resourceRegistry.surveillance.fields.taxon_lineage_ids.cardinality,
    ).toBe("multiple");
    expect(
      resourceRegistry.surveillance.fields.taxon_lineage_ids.sortable,
    ).toBe(false);
    expect(resourceRegistry.serology.fields.taxon_lineage_ids.cardinality).toBe(
      "multiple",
    );
    expect(resourceRegistry.serology.fields.taxon_lineage_ids.sortable).toBe(
      false,
    );
  });

  it("registers AMR phenotypes with a validated boundary", () => {
    // Without a registry entry the gateway 404s `/api/data/genome_amr`.
    expect(resourceRegistry.genome_amr.idField).toBe("id");
    expect(resourceRegistry.genome_amr.fields.antibiotic.facet).toBe(true);
    expect(resourceRegistry.genome_amr.fields.resistant_phenotype.facet).toBe(
      false,
    );
    expect(resourceRegistry.genome_amr.fields.evidence.cardinality).toBe("multiple");
    expect(resourceRegistry.genome_amr.fields.evidence.sortable).toBe(false);
    expect(resourceRegistry.genome_amr.fields.pmid.cardinality).toBe("multiple");
    expect(resourceRegistry.genome_amr.fields.pmid.sortable).toBe(false);
    expect(resourceRegistry.genome_amr.fields.antibiotic.sortable).toBe(true);
    // The schema declares only `id` (plus the shared optional taxonomy keys),
    // so a row keeps every other AMR column verbatim — including the shapes
    // that have no in-repo fixture to check a declaration against: a
    // multi-publication `pmid` list and a non-numeric measurement.
    expect(
      genomeAmrRecordSchema.parse({
        id: "amr-row-1",
        genome_id: "1.1",
        antibiotic: "ampicillin",
        resistant_phenotype: "Resistant",
        measurement_value: ">=32",
        evidence: ["Laboratory Method"],
        pmid: ["12345", "67890"],
      }),
    ).toEqual({
      id: "amr-row-1",
      genome_id: "1.1",
      antibiotic: "ampicillin",
      resistant_phenotype: "Resistant",
      measurement_value: ">=32",
      evidence: ["Laboratory Method"],
      pmid: ["12345", "67890"],
    });
    // Only `id` is required, so a missing one is what fails — not a column
    // whose type this repo cannot verify.
    expect(() => genomeAmrRecordSchema.parse({ antibiotic: "ampicillin" })).toThrow();
    for (const field of ["evidence", "pmid"]) {
      expect(() =>
        validateDataApiRequest("genome_amr", {
          operation: "collection",
          facets: ["antibiotic"],
          sort: { field, direction: "asc" },
        }),
      ).toThrow(new RegExp(`${field} cannot sort genome_amr`));
      expect(() =>
        validateDataApiRequest("genome_amr", {
          operation: "collection",
          sort: {
            field: "antibiotic",
            direction: "asc",
            then: [{ field, direction: "asc" }],
          },
        }),
      ).toThrow(new RegExp(`${field} cannot sort genome_amr`));
    }
  });

  it("admits legacy FeatureGrid's order on Features and caps the keys that break its ties", () => {
    // Every Features and Proteins table reads its unsorted rows in this order,
    // so a field in it losing `sortable` would fail each of those reads.
    expect(() =>
      validateDataApiRequest("genome_feature", {
        operation: "collection",
        sort: featureGridDefaultOrder,
      }),
    ).not.toThrow();
    expect(() =>
      validateDataApiRequest("genome_feature", {
        operation: "collection",
        sort: {
          field: "genome_name",
          direction: "asc",
          then: ["accession", "start", "end", "patric_id"].map((field) => ({
            field,
            direction: "asc" as const,
          })),
        },
      }),
    ).toThrow();
  });

  it("registers Strain backend identity and multivalue accession fields", () => {
    expect(resourceRegistry.strain.idField).toBe("id");
    for (const field of [
      "genome_ids",
      "genbank_accessions",
      "1_pb2",
      "4_ha",
      "8_ns",
      "other_segments",
    ]) {
      expect(resourceRegistry.strain.fields[field].cardinality).toBe(
        "multiple",
      );
      expect(resourceRegistry.strain.fields[field].sortable).toBe(false);
    }
    expect(
      strainRecordSchema.parse({
        id: "strain-row-1",
        strain: "A/test/1/2024",
        genome_ids: ["1.1", "1.2"],
        genbank_accessions: ["CY000001", "CY000002"],
        "4_ha": ["CY000004"],
      }),
    ).toMatchObject({ id: "strain-row-1" });
  });

  it("registers the Epitope and assay contracts", () => {
    expect(resourceRegistry.epitope.idField).toBe("epitope_id");
    expect(resourceRegistry.epitope_assay.idField).toBe("assay_id");
    expect(resourceRegistry.epitope.fields.taxon_lineage_ids.cardinality).toBe(
      "multiple",
    );
    expect(resourceRegistry.epitope.fields.host_name.cardinality).toBe(
      "multiple",
    );
    expect(resourceRegistry.epitope.fields.total_assays.type).toBe("number");
    expect(resourceRegistry.epitope.fields.assay_results.sortable).toBe(false);
    expect(resourceRegistry.epitope_assay.fields.assay_result.facet).toBe(true);
    expect(
      epitopeRecordSchema.parse({
        epitope_id: "15780",
        total_assays: 2,
        host_name: ["Mus musculus BALB/c", "Ovis aries, domestic sheep"],
      }),
    ).toMatchObject({ epitope_id: "15780" });
    expect(
      epitopeAssayRecordSchema.parse({
        assay_id: "A1",
        epitope_id: "15780",
        assay_result: "Positive",
      }),
    ).toMatchObject({ assay_id: "A1" });
  });

  it("registers Protein Structure metadata and multivalue fields", () => {
    expect(resourceRegistry.protein_structure.idField).toBe("pdb_id");
    expect(resourceRegistry.protein_structure.fields.resolution.type).toBe("number");
    expect(resourceRegistry.protein_structure.fields.release_date.type).toBe("date");
    for (const field of [
      "taxon_id",
      "taxon_lineage_ids",
      "taxon_lineage_names",
      "uniprotkb_accession",
      "gene",
      "product",
      "sequence_md5",
      "method",
      "pmid",
      "institution",
      "authors",
    ]) {
      expect(resourceRegistry.protein_structure.fields[field].cardinality).toBe(
        "multiple",
      );
      expect(resourceRegistry.protein_structure.fields[field].sortable).toBe(false);
    }
    expect(
      proteinStructureRecordSchema.parse({
        pdb_id: "AF-P43722-F1",
        organism_name: ["Haemophilus influenzae Rd KW20"],
        taxon_id: [71421],
        taxon_lineage_ids: ["131567", "2", "71421"],
        gene: ["hupA"],
        product: ["DNA-binding protein HU-alpha"],
        sequence_md5: ["595c80a3ddc17b3c15db15056fbb7048"],
        method: ["Predicted"],
        uniprotkb_accession: ["P43722"],
        pmid: ["123456"],
        resolution: 2.1,
        authors: ["DeepMind and EMBL-EBI"],
      }),
    ).toMatchObject({ pdb_id: "AF-P43722-F1" });
    expect(() =>
      proteinStructureRecordSchema.parse({
        pdb_id: "1ABC",
        uniprotkb_accession: { invalid: true },
      }),
    ).toThrow();
  });

  it("registers string-preserving Experiment and Bioset contracts", () => {
    expect(resourceRegistry.experiment.idField).toBe("exp_id");
    expect(resourceRegistry.experiment.fields.genome_id.cardinality).toBe("multiple");
    expect(resourceRegistry.experiment.fields.taxon_lineage_ids.cardinality).toBe("multiple");
    expect(resourceRegistry.experiment.fields.samples.type).toBe("number");
    expect(resourceRegistry.bioset.idField).toBe("bioset_id");
    expect(resourceRegistry.bioset.fields.bioset_type.facet).toBe(true);
    expect(resourceRegistry.bioset.fields.organism.facet).toBe(true);
  });

  it("allows a valid collection and rejects disallowed fields and sorts", () => {
    expect(
      validateDataApiRequest("genome", {
        operation: "collection",
        fields: ["genome_id"],
        facets: ["genus"],
      }),
    ).toMatchObject({ operation: "collection" });
    expect(
      validateDataApiRequest("protein_feature", {
        operation: "collection",
        rql: "and(and(eq(genome_id,*),genome(eq(taxon_lineage_ids,2955291))),eq(id,*))",
      }),
    ).toMatchObject({
      operation: "collection",
      rql: "and(and(eq(genome_id,%2A),genome(eq(taxon_lineage_ids,2955291))),eq(id,%2A))",
    });
    expect(() =>
      validateDataApiRequest("genome", {
        operation: "collection",
        fields: ["password"],
      }),
    ).toThrow(/cannot be used/);
    expect(() =>
      validateDataApiRequest("genome", {
        operation: "collection",
        sort: { field: "password", direction: "asc" },
      }),
    ).toThrow(/cannot sort/);
    expect(() =>
      validateDataApiRequest("genome", {
        operation: "collection",
        facets: ["genome_id"],
      }),
    ).toThrow(/cannot be used/);
  });

  it("enforces paging and bulk operation bounds", () => {
    expect(() =>
      validateDataApiRequest("genome", {
        operation: "collection",
        pageSize: 201,
      }),
    ).toThrow();
    expect(() =>
      validateDataApiRequest("genome", {
        operation: "selected",
        ids: Array.from({ length: maxSelectedRows + 1 }, (_, index) =>
          String(index),
        ),
      }),
    ).toThrow();
    expect(() =>
      validateDataApiRequest("genome", {
        operation: "export",
        fields: ["genome_id"],
        limit: maxExportRows + 1,
      }),
    ).toThrow();
    expect(() =>
      validateDataApiRequest("genome", {
        operation: "export",
        fields: ["genome_id"],
        limit: 1,
        offset: maxExportRows,
      }),
    ).toThrow("Exports are limited to 10,000 rows");
  });

  it("preserves digit-only experiment identifiers as strings", () => {
    expect(
      validateDataApiRequest("experiment", {
        operation: "member",
        id: "00042",
      }),
    ).toMatchObject({ id: "00042" });
  });

  it("validates control fields while passing through additional fields", () => {
    expect(
      genomeRecordSchema.parse({
        genome_id: "1.1",
        custom_field: { nested: true },
      }),
    ).toEqual({ genome_id: "1.1", custom_field: { nested: true } });
    expect(() => genomeRecordSchema.parse({ genome_id: 1.1 })).toThrow();
    expect(() =>
      surveillanceRecordSchema.parse({
        id: "row-1",
        pathogen_test_type: "RAT",
      }),
    ).toThrow();
    expect(() =>
      serologyRecordSchema.parse({ id: "row-2", test_type: ["RAT"] }),
    ).toThrow();
  });

  it("builds resource-independent deterministic query keys", () => {
    const request = {
      page: 2,
      rql: "eq(genome_id,1.1)",
      fields: ["genome_id"],
    };
    expect(dataQueryKeys.collection("genome", request)).toEqual([
      "data-api",
      "genome",
      "collection",
      request,
    ]);
  });

  it("keeps cached collections stale so remounts refresh them", () => {
    const options = collectionQueryOptions(new DataRepository(), "genome", {
      fields: ["genome_id"],
    });

    expect(options.staleTime).toBe(0);
  });
});

describe("validateDownloadRequest", () => {
  const base = {
    format: "csv",
    scope: { kind: "query", rql: "eq(genome_id,1.1)" },
    fileNameBase: "genome",
    total: 3,
  };
  const validate = (resource: (typeof dataResources)[number], value: object) =>
    () => validateDownloadRequest(resource, { ...base, ...value });

  it("accepts a query download and returns it validated", () => {
    expect(
      validateDownloadRequest("genome", {
        ...base,
        sort: { field: "genome_name", direction: "desc" },
        fields: ["genome_name"],
        nonce: "abcdef0123456789",
      }),
    ).toEqual({
      format: "csv",
      scope: { kind: "query", rql: "eq(genome_id,1.1)" },
      sort: { field: "genome_name", direction: "desc" },
      fields: ["genome_name"],
      fileNameBase: "genome",
      total: 3,
      nonce: "abcdef0123456789",
    });
  });

  it("rejects an unknown format and one the resource does not offer", () => {
    expect(validate("genome", { format: "pdf" })).toThrow();
    expect(validate("genome", { format: "protein-fasta" })).toThrow(
      "Protein FASTA downloads are not available for genome.",
    );
    expect(validate("epitope", { format: "dna-fasta" })).toThrow(
      "DNA FASTA downloads are not available for epitope.",
    );
    expect(validate("genome", { format: "dna-fasta" })).not.toThrow();
  });

  it("bounds a selection at 1 to 10,000 ids and drops repeats", () => {
    expect(
      validate("genome", { scope: { kind: "selected", ids: [] } }),
    ).toThrow("Choose at least one row to download.");
    expect(
      validate("genome", {
        scope: {
          kind: "selected",
          ids: Array.from({ length: 10_001 }, (_, index) => String(index)),
        },
      }),
    ).toThrow("Selection downloads are limited to 10,000 rows.");
    expect(
      validate("genome", {
        scope: { kind: "selected", ids: ["x".repeat(maxIdentifierLength + 1)] },
      }),
    ).toThrow();
    expect(
      validateDownloadRequest("genome", {
        ...base,
        scope: { kind: "selected", ids: ["1.1", "1.2", "1.1"] },
      }).scope,
    ).toStrictEqual({ kind: "selected", ids: ["1.1", "1.2"] });
  });

  it("validates the rql, fields and sort against the resource", () => {
    expect(
      validate("genome", { scope: { kind: "query", rql: "eq(nope,1)" } }),
    ).toThrow();
    expect(validate("genome", { fields: ["not_a_field"] })).toThrow(
      "Field not_a_field cannot be used for select on genome.",
    );
    expect(
      validate("genome", { sort: { field: "not_a_field", direction: "asc" } }),
    ).toThrow("Field not_a_field cannot sort genome.");
  });

  it("refuses visible columns the data service cannot select", () => {
    expect(
      validate("strain", {
        scope: { kind: "query" },
        fields: ["strain", "1_pb2", "4_ha"],
      }),
    ).toThrow(
      "The data service cannot select 1_pb2 and 4_ha; download every field instead.",
    );
    expect(
      validate("strain", { scope: { kind: "query" }, fields: ["strain"] }),
    ).not.toThrow();
  });

  it("refuses an empty column list with the tile's reason", () => {
    expect(validate("genome", { fields: [] })).toThrow(
      "No columns are visible; download every field instead.",
    );
    expect(
      validateDownloadRequest("genome_feature", {
        ...base,
        format: "dna-fasta",
        fields: [],
      }).fields,
    ).toBeUndefined();
  });

  it("drops fields from a sequence download, which has no columns", () => {
    expect(
      validateDownloadRequest("genome_feature", {
        ...base,
        format: "protein-fasta",
        fields: ["feature_id"],
      }).fields,
    ).toBeUndefined();
  });

  it("enforces the row limits the tile shows", () => {
    expect(validate("genome", { total: 0 })).toThrow("No matching rows.");
    expect(validate("genome", { format: "xlsx", total: 1_048_576 })).toThrow(
      "Over Excel's 1,048,576-row limit.",
    );
    expect(
      validate("genome_feature", { format: "dna-fasta", total: 10_001 }),
    ).toThrow("Sequences: 10,000 rows at most.");
    expect(validate("genome", { total: 2_500_001 })).toThrow(
      "Over 2,500,000 rows: narrow the filters.",
    );
    // A selection is counted by its ids, not by the total it claims.
    expect(
      validate("genome", {
        scope: { kind: "selected", ids: ["1.1"] },
        total: 0,
      }),
    ).not.toThrow();
  });

  it("makes the file name base safe and bounds it", () => {
    expect(
      validateDownloadRequest("genome", {
        ...base,
        fileNameBase: '../fig|1.1"x',
      }).fileNameBase,
    ).toBe("_fig_1.1_x");
    expect(validate("genome", { fileNameBase: "x".repeat(201) })).toThrow();
  });

  it("accepts only a token-shaped nonce", () => {
    expect(validate("genome", { nonce: "short" })).toThrow();
    expect(validate("genome", { nonce: "a; Path=/evil" })).toThrow();
  });
});
