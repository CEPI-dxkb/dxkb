import { describe, expect, it } from "vitest";
import { dataResources } from "../types";
import { collectionQueryOptions, dataQueryKeys } from "../query-options";
import { DataRepository } from "../client";
import { resourceRegistry } from "../resources";
import {
  epitopeAssayRecordSchema,
  epitopeRecordSchema,
  genomeRecordSchema,
  proteinStructureRecordSchema,
  serologyRecordSchema,
  strainRecordSchema,
  surveillanceRecordSchema,
} from "../schemas";
import {
  maxExportRows,
  maxSelectedRows,
  validateDataApiRequest,
} from "../validation";

describe("data API contracts", () => {
  it("registers every required resource with an allowed stable ID", () => {
    expect(Object.keys(resourceRegistry).sort()).toEqual(
      [...dataResources].sort(),
    );
    for (const resource of dataResources) {
      const definition = resourceRegistry[resource];
      expect(definition.fields[definition.idField].selectable).toBe(true);
      expect(() => definition.schema.parse({})).toThrow();
    }
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
