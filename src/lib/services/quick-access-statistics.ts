import {
  createStatisticsCache,
  type StatisticDefinition,
} from "@/lib/services/statistics";

export type QuickAccessKey =
  | "completeGenomes"
  | "partialGenomes"
  | "referenceGenomes"
  | "experimentalStructures"
  | "predictedStructures"
  | "epitopes";

// Same scope as Database Statistics "Viral Genomes", so Complete + Partial +
// WGS + Deprecated add up to that number.
const virusGenomeScope = "eq(superkingdom,Viruses)";
// `protein_structure` and `epitope` have no `superkingdom`; they carry the
// lineage ids instead (10239 = Viruses).
const virusLineageScope = "eq(taxon_lineage_ids,10239)";

/**
 * The home page "Quick Access to Viral Data" counts, in display order. Each
 * label names exactly what its filter counts: a `genome_status` value is one
 * of Complete, Partial, WGS or Deprecated, so the three genome rows never
 * overlap. There is deliberately no "Structural Proteins" or "Enzymes" count:
 * `genome_feature` has no lineage or EC field, and joining to `genome(...)`
 * outlasts the Data API budget.
 */
export const quickAccessDefinitions: readonly StatisticDefinition<QuickAccessKey>[] =
  Object.freeze([
    {
      key: "completeGenomes",
      label: "Complete Genomes",
      core: "genome",
      filter: `and(${virusGenomeScope},eq(genome_status,Complete))`,
    },
    {
      key: "partialGenomes",
      label: "Partial Genomes",
      core: "genome",
      filter: `and(${virusGenomeScope},eq(genome_status,Partial))`,
    },
    {
      key: "referenceGenomes",
      label: "Reference & Representative Genomes",
      core: "genome",
      filter: `and(${virusGenomeScope},eq(reference_genome,*),ne(genome_status,Deprecated))`,
    },
    {
      key: "experimentalStructures",
      label: "Experimental Structures",
      core: "protein_structure",
      filter: `and(${virusLineageScope},ne(method,Predicted))`,
    },
    {
      key: "predictedStructures",
      label: "Predicted Structures",
      core: "protein_structure",
      filter: `and(${virusLineageScope},eq(method,Predicted))`,
    },
    {
      key: "epitopes",
      label: "Epitopes",
      core: "epitope",
      filter: virusLineageScope,
    },
  ] as const);

/** Own cache entry: a flaky count here must not re-fire Database Statistics. */
export const getQuickAccessStatistics = createStatisticsCache(
  "quick-access-statistics",
  quickAccessDefinitions,
);
