import { describe, expect, it } from "vitest";
import {
  genomeDomainsRql,
  genomeFeatureRql,
  genomeProteinRql,
  taxonomyInteractionsRql,
  taxonomySequenceRql,
} from "@/lib/views/child-resources";
import {
  buildGenomeTabs,
  canonicalGenomeTab,
  genomeBaseRql,
  genomeCollectionProfile,
  genomeInteractionsRql,
  genomeSequenceRql,
  genomeStructuralRql,
  genomeViewRecordSchema,
  isGenomeId,
  parseGenomeCollectionState,
  recentGenomeRql,
} from "@/lib/genome-view";

describe("Genome view contracts", () => {
  it("preserves backend relevance order by default", () => {
    expect(parseGenomeCollectionState({}).sort).toBe("unsorted");
    expect(parseGenomeCollectionState({ sort: "genome_name:asc" }).sort).toBe(
      "genome_name:asc",
    );
  });

  it("uses the legacy recent, non-deprecated scope for an unfiltered global list", () => {
    expect(recentGenomeRql).toBe(
      "and(gt(completion_date,NOW-1YEARS),ne(genome_status,Deprecated))",
    );
    expect(
      genomeBaseRql({ keyword: "", filters: {}, page: 1, sort: "unsorted" }),
    ).toBe(recentGenomeRql);
  });

  it("does not restrict an explicit RQL query to recent genomes", () => {
    expect(
      genomeBaseRql({
        keyword: "",
        filters: {},
        page: 1,
        sort: "unsorted",
        rql: "in(genome_id,(11320.1,11320.2))",
      }),
    ).toBeUndefined();
  });

  it("accepts dotted numeric IDs only", () => {
    expect(isGenomeId("83332.12")).toBe(true);
    expect(isGenomeId("83332")).toBe(false);
    expect(isGenomeId("83332.x")).toBe(false);
  });

  it("validates the fields used by the overview", () => {
    expect(
      genomeViewRecordSchema.parse({
        genome_id: "83332.12",
        genome_length: "100",
      }),
    ).toMatchObject({ genome_id: "83332.12" });
    expect(() =>
      genomeViewRecordSchema.parse({ genome_id: "invalid" }),
    ).toThrow();
  });

  it("parses all canonical collection state and maps taxon scope", () => {
    const state = parseGenomeCollectionState({
      keyword: "coli",
      taxon_id: "561",
      page: "3",
      sort: "genome_length:desc",
    });
    expect(state).toEqual({
      keyword: "coli",
      refine: undefined,
      rql: undefined,
      filters: { taxon_id: ["561"] },
      page: 3,
      sort: "genome_length:desc",
    });
    expect(genomeStructuralRql(state)).toBe("eq(taxon_lineage_ids,561)");
  });

  it("combines facet filters without a hidden status predicate", () => {
    const state = parseGenomeCollectionState({
      genome_status: "Complete",
      isolation_country: "USA",
    });
    expect(genomeStructuralRql(state)).toBe(
      "and(eq(genome_status,Complete),eq(isolation_country,USA))",
    );
  });

  it("gives explicit rql precedence without adding Deprecated filters", () => {
    const state = parseGenomeCollectionState({
      taxon_id: "561",
      rql: "eq(genome_status,Complete)",
    });
    expect(state.filters).toEqual({});
    expect(state.rql).toBe("eq(genome_status,Complete)");
    expect(genomeStructuralRql(state)).toBeUndefined();
  });

  it("canonicalizes invalid pages and sorts while rejecting transport RQL", () => {
    expect(parseGenomeCollectionState({ page: "0" }).page).toBe(1);
    expect(parseGenomeCollectionState({ sort: "unknown:asc" }).sort).toBe(
      "unsorted",
    );
    expect(() =>
      parseGenomeCollectionState({ rql: "sort(+genome_id)" }),
    ).toThrow("Transport operator");
  });

  it("builds exact child predicates", () => {
    expect(genomeSequenceRql("83332.12")).toBe("eq(genome_id,83332.12)");
    expect(genomeDomainsRql("83332.12")).toBe("eq(genome_id,83332.12)");
    // Symmetric on the interaction endpoints — a PPI row can file the scoped
    // genome on either side. Endpoint coverage lives in
    // src/lib/views/__tests__/interaction-predicates.test.ts.
    expect(genomeInteractionsRql("83332.12")).toBe(
      "and(or(eq(genome_id_a,83332.12),eq(genome_id_b,83332.12)),eq(evidence,experimental))",
    );
    expect(genomeFeatureRql("83332.12", "CDS")).toBe(
      "and(eq(genome_id,83332.12),eq(feature_type,CDS))",
    );
    expect(genomeProteinRql("83332.12")).toBe(
      "and(eq(genome_id,83332.12),or(eq(feature_type,CDS),eq(feature_type,mat_peptide)),eq(annotation,PATRIC))",
    );
    expect(taxonomySequenceRql("eq(taxon_lineage_ids,561)")).toBe(
      "and(eq(genome_id,*),genome(and(eq(taxon_lineage_ids,561),ne(genome_status,Deprecated))))",
    );
    expect(taxonomyInteractionsRql("eq(taxon_lineage_ids,561)")).toBe(
      "and(eq(genome_id_a,*),genome(to(genome_id_a),and(eq(taxon_lineage_ids,561),ne(genome_status,Deprecated))),eq(evidence,experimental))",
    );
  });

  it("uses canonical member links and legacy default columns", () => {
    expect(genomeCollectionProfile.rowHref?.({ genome_id: "83332.12" })).toBe(
      "/genome/83332.12",
    );
    expect(genomeCollectionProfile.rowLinkField).toBe("genome_name");
    expect(genomeCollectionProfile.basePredicate).toBe("eq(genome_id,*)");
    expect(
      genomeCollectionProfile.columns
        .filter((column) => column.visible)
        .map((column) => column.id),
    ).toEqual([
      "genome_name",
      "strain",
      "genbank_accessions",
      "genome_length",
      "cds",
      "collection_year",
      "isolation_country",
      "host_common_name",
    ]);
  });

  it("capability-gates interactions and all future tabs", () => {
    const bacterial = genomeViewRecordSchema.parse({
      genome_id: "1.1",
      superkingdom: "Bacteria",
    });
    const viral = genomeViewRecordSchema.parse({
      genome_id: "2.2",
      superkingdom: "Viruses",
    });
    expect(
      buildGenomeTabs(bacterial).find((tab) => tab.key === "interactions")
        ?.enabled,
    ).not.toBe(false);
    expect(
      buildGenomeTabs(viral).find((tab) => tab.key === "interactions")?.enabled,
    ).toBe(false);
    expect(canonicalGenomeTab("features", bacterial)).toBe("features");
    expect(canonicalGenomeTab("proteins", bacterial)).toBe("proteins");
    expect(canonicalGenomeTab("domains", bacterial)).toBe("domains");
    expect(canonicalGenomeTab("domains", viral)).toBe("domains");
    expect(canonicalGenomeTab("sequences", bacterial)).toBe("sequences");
    expect(canonicalGenomeTab("nonsense", bacterial)).toBe("overview");
  });
});
