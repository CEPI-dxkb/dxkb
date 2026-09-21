import { describe, expect, it } from "vitest";

import {
  epitopeStructuralRql,
  parseEpitopeCollectionState,
} from "@/lib/epitope-view/query";
import {
  biosetStructuralRql,
  experimentStructuralRql,
  parseExperimentCollectionState,
} from "@/lib/experiment-view/query";
import {
  genomeCollectionOptions,
  genomeStructuralRql,
  parseGenomeCollectionState,
} from "@/lib/genome-view/query";
import {
  parseProteinFeatureCollectionState,
  proteinFeatureStructuralRql,
} from "@/lib/protein-feature-view/query";
import {
  parseProteinStructureCollectionState,
  proteinStructureStructuralRql,
} from "@/lib/protein-structure-view/query";
import { parseSerologyCollectionState, serologyStructuralRql } from "@/lib/serology-view/query";
import { parseStrainCollectionState, strainStructuralRql } from "@/lib/strain-view/query";
import {
  parseSurveillanceCollectionState,
  surveillanceStructuralRql,
} from "@/lib/surveillance-view/query";
import { parseTaxonomyCollectionState, taxonomyStructuralRql } from "@/lib/taxonomy-view/query";
import type { CollectionState } from "@/lib/views/collection-state";
import {
  structuralFilterRql,
  taxonLineageFieldMap,
} from "@/lib/views/structural-rql";

const emptyState: CollectionState = { filters: {}, page: 1, sort: "unsorted" };

describe("structuralFilterRql", () => {
  it("returns undefined for an empty filter set", () => {
    expect(structuralFilterRql("genome", emptyState)).toBeUndefined();
  });

  it("builds a single eq clause for one field with one value", () => {
    const state: CollectionState = {
      ...emptyState,
      filters: { genome_status: ["Complete"] },
    };
    expect(structuralFilterRql("genome", state)).toBe("eq(genome_status,Complete)");
  });

  it("ORs repeated values within one field", () => {
    const state: CollectionState = {
      ...emptyState,
      filters: { genome_status: ["Complete", "WGS"] },
    };
    expect(structuralFilterRql("genome", state)).toBe(
      "or(eq(genome_status,Complete),eq(genome_status,WGS))",
    );
  });

  it("ANDs across fields", () => {
    const state: CollectionState = {
      ...emptyState,
      filters: { genome_status: ["Complete"], genome_quality: ["Good"] },
    };
    expect(structuralFilterRql("genome", state)).toBe(
      "and(eq(genome_status,Complete),eq(genome_quality,Good))",
    );
  });

  it("remaps a friendly filter name to its backend field via fieldMap", () => {
    const state: CollectionState = { ...emptyState, filters: { taxon_id: ["561"] } };
    expect(
      structuralFilterRql("genome", state, {
        fieldMap: { taxon_id: "taxon_lineage_ids" },
      }),
    ).toBe("eq(taxon_lineage_ids,561)");
  });

  it("lets explicit RQL bypass friendly filters entirely, regardless of mode", () => {
    const state: CollectionState = {
      ...emptyState,
      rql: "eq(genome_status,Complete)",
      filters: { genome_quality: ["Good"] },
    };
    expect(structuralFilterRql("genome", state)).toBeUndefined();
    expect(
      structuralFilterRql("genome", state, {
        fieldMap: { genome_quality: "genome_quality" },
        unknownFilters: "drop",
      }),
    ).toBeUndefined();
  });

  it("passes an unmapped filter name through unchanged by default (passthrough mode)", () => {
    const state: CollectionState = { ...emptyState, filters: { genome_quality: ["Good"] } };
    expect(structuralFilterRql("genome", state)).toBe("eq(genome_quality,Good)");
  });

  it("skips a filter key whose selected-values array is empty", () => {
    // parseCollectionState/canonicalizeCollectionState never produce this
    // shape (a filter key is only ever added once it has a value), but the
    // helper stays defensive for any hand-built CollectionState rather than
    // emitting a malformed "or()" clause for zero predicates.
    const state: CollectionState = {
      ...emptyState,
      filters: { genome_status: [], genome_quality: ["Good"] },
    };
    expect(structuralFilterRql("genome", state)).toBe("eq(genome_quality,Good)");
  });

  it("never folds keyword or refine into the structural clause", () => {
    // Keyword search is deliberately independent of structural filters — the
    // collection query combines the two itself, so a composer that swallowed
    // `keyword` would double-apply it. (Moved here from the deleted
    // `collectionStateToRql`, the only other place that asserted it.)
    const state: CollectionState = {
      ...emptyState,
      keyword: "coli",
      refine: "K-12",
      filters: { taxon_id: ["2"], host_common_name: ["Human", "Swine"] },
    };
    expect(
      structuralFilterRql("genome", state, { fieldMap: taxonLineageFieldMap }),
    ).toBe(
      "and(eq(taxon_lineage_ids,2),or(eq(host_common_name,Human),eq(host_common_name,Swine)))",
    );
  });

  it("drops an unmapped filter name in allowlist mode instead of forwarding it", () => {
    const state: CollectionState = {
      ...emptyState,
      filters: { genome_status: ["Complete"], unlisted_filter: ["x"] },
    };
    // unlisted_filter has no fieldMap entry and mode is "drop", so it is
    // omitted entirely rather than forwarded to eq() — where "unlisted_filter"
    // is not even a registered genome field and would throw a
    // DataApiValidationError in passthrough mode.
    expect(
      structuralFilterRql("genome", state, {
        fieldMap: { genome_status: "genome_status" },
        unknownFilters: "drop",
      }),
    ).toBe("eq(genome_status,Complete)");
  });
});

describe("taxonLineageFieldMap is the one shared lineage remap", () => {
  it("is the map every lineage-bearing resource composes with", () => {
    expect(taxonLineageFieldMap).toEqual({ taxon_id: "taxon_lineage_ids" });
  });

  it("is not applied by taxonomy, whose taxon_id is its own id field", () => {
    const state: CollectionState = {
      ...emptyState,
      filters: { taxon_id: ["2"] },
    };
    expect(taxonomyStructuralRql(state)).toBe("eq(taxon_id,2)");
  });
});

describe("genome's allowlist stays total and authoritative", () => {
  it("drops a friendly filter name absent from its remap table", () => {
    // parseGenomeCollectionState can never itself produce this shape (it
    // only ever populates keys from genomeCollectionOptions.friendlyFilters),
    // but genomeStructuralRql must fail closed for any CollectionState it is
    // handed, including one assembled by hand or by future callers.
    const state: CollectionState = {
      ...emptyState,
      filters: { genome_status: ["Complete"], not_a_real_filter: ["x"] },
    };
    expect(genomeStructuralRql(state)).toBe("eq(genome_status,Complete)");
  });
});

describe("genome's allowlist is derived from its friendly filters", () => {
  it("accepts every genomeCollectionOptions friendly filter", () => {
    // The derivation is what keeps the "total and authoritative" remap table
    // and `friendlyFilters` from drifting apart: a filter the URL accepts but
    // the table omits would be dropped silently at the backend boundary.
    for (const name of genomeCollectionOptions.friendlyFilters ?? []) {
      const state: CollectionState = {
        ...emptyState,
        filters: { [name]: ["x"] },
      };
      const expectedField = name === "taxon_id" ? "taxon_lineage_ids" : name;
      expect(genomeStructuralRql(state)).toBe(`eq(${expectedField},x)`);
    }
  });
});

describe("pass-through modules forward an unmapped filter name unchanged", () => {
  it("strain forwards a filter name outside its friendlyFilters allowlist", () => {
    // Contrast with Genome above: strainStructuralRql has no "drop" mode, so
    // any filter name reaching it becomes a backend field verbatim (aside
    // from the one remapped taxon_id). Here "id" is a real strain field, so
    // it composes into valid RQL instead of being rejected.
    const state: CollectionState = { ...emptyState, filters: { id: ["strain-row-1"] } };
    expect(strainStructuralRql(state)).toBe("eq(id,strain-row-1)");
  });
});

interface StructuralRqlCase {
  name: string;
  build: () => string | undefined;
  expected: string;
}

const cases: StructuralRqlCase[] = [
  {
    name: "genome",
    build: () =>
      genomeStructuralRql(
        parseGenomeCollectionState({
          taxon_id: "561",
          genome_status: ["Complete", "WGS"],
        }),
      ),
    expected:
      "and(eq(taxon_lineage_ids,561),or(eq(genome_status,Complete),eq(genome_status,WGS)))",
  },
  {
    name: "strain",
    build: () =>
      strainStructuralRql(
        parseStrainCollectionState({ taxon_id: "11520", family: ["Orthomyxoviridae"] }),
      ),
    expected: "and(eq(taxon_lineage_ids,11520),eq(family,Orthomyxoviridae))",
  },
  {
    name: "protein_feature",
    build: () =>
      proteinFeatureStructuralRql(
        parseProteinFeatureCollectionState({ feature_type: ["CDS", "tRNA"] }),
      ),
    expected: "or(eq(feature_type,CDS),eq(feature_type,tRNA))",
  },
  {
    name: "epitope",
    build: () =>
      epitopeStructuralRql(
        parseEpitopeCollectionState({ taxon_id: "561", epitope_type: "Linear" }),
      ),
    expected: "and(eq(taxon_lineage_ids,561),eq(epitope_type,Linear))",
  },
  {
    name: "surveillance",
    build: () =>
      surveillanceStructuralRql(
        parseSurveillanceCollectionState({
          contributing_institution: ["CDC", "WHO"],
          collection_year: "2020",
        }),
      ),
    expected:
      "and(or(eq(contributing_institution,CDC),eq(contributing_institution,WHO)),eq(collection_year,2020))",
  },
  {
    name: "serology",
    build: () =>
      serologyStructuralRql(
        parseSerologyCollectionState({
          host_type: ["Human", "Animal"],
          host_species: "Influenza",
        }),
      ),
    expected: "and(or(eq(host_type,Human),eq(host_type,Animal)),eq(host_species,Influenza))",
  },
  {
    name: "experiment",
    build: () =>
      experimentStructuralRql(
        parseExperimentCollectionState({
          organism: ["Ecoli", "Styphi"],
          measurement_technique: "RNAseq",
        }),
      ),
    expected: "and(eq(measurement_technique,RNAseq),or(eq(organism,Ecoli),eq(organism,Styphi)))",
  },
  {
    name: "bioset",
    build: () =>
      biosetStructuralRql({
        filters: { bioset_type: ["Differential Expression"], organism: ["Escherichia coli"] },
        page: 1,
        sort: "bioset_id:asc",
      }),
    expected:
      'and(eq(bioset_type,"Differential%20Expression"),eq(organism,"Escherichia%20coli"))',
  },
  {
    name: "taxonomy",
    build: () =>
      taxonomyStructuralRql(
        parseTaxonomyCollectionState({ taxon_id: "2", taxon_rank: ["genus", "family"] }),
      ),
    // Unlike every remapped resource above, taxonomy filters on itself:
    // taxon_id is not remapped because "taxon_id" already is the taxonomy
    // resource's own id field.
    expected: "and(eq(taxon_id,2),or(eq(taxon_rank,genus),eq(taxon_rank,family)))",
  },
  {
    name: "protein_structure",
    build: () =>
      proteinStructureStructuralRql(
        parseProteinStructureCollectionState({
          taxon_id: "123",
          gene: ["geneA", "geneB"],
        }),
      ),
    expected: "and(eq(taxon_lineage_ids,123),or(eq(gene,geneA),eq(gene,geneB)))",
  },
];

describe("structural filter behavior preservation across the nine consolidated modules", () => {
  it.each(cases)("$name produces the same RQL the pre-consolidation implementation did", ({
    build,
    expected,
  }) => {
    expect(build()).toBe(expected);
  });

  it.each(cases)("$name still gives explicit RQL precedence over friendly filters", ({ name }) => {
    const stateWithRql: CollectionState = {
      filters: { unused: ["value"] },
      page: 1,
      sort: "unsorted",
      rql: "eq(id,*)",
    };
    const structuralRqlByResource: Record<string, (state: CollectionState) => string | undefined> = {
      genome: genomeStructuralRql,
      strain: strainStructuralRql,
      protein_feature: proteinFeatureStructuralRql,
      epitope: epitopeStructuralRql,
      surveillance: surveillanceStructuralRql,
      serology: serologyStructuralRql,
      experiment: experimentStructuralRql,
      bioset: biosetStructuralRql,
      taxonomy: taxonomyStructuralRql,
      protein_structure: proteinStructureStructuralRql,
    };
    expect(structuralRqlByResource[name](stateWithRql)).toBeUndefined();
  });
});
