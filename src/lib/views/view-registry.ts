import type { ViewRegistry, ViewTypeEntry } from "./view-types";

// Data-only route metadata: the canonical URL segment for each view type, plus the
// legacy BV-BRC view names that redirect to it. Identifier validation, collection
// defaults and domain queries live in each resource's colocated view module.
export const viewRegistry = {
  taxonomy: {
    segment: "taxonomy",
    legacySingular: "Taxonomy",
    legacyList: "TaxonList",
  },
  genome: {
    segment: "genome",
    legacySingular: "Genome",
    legacyList: "GenomeList",
  },
  feature: {
    segment: "feature",
    legacySingular: "Feature",
    legacySingularAliases: ["Protein"],
    legacyList: "FeatureList",
    legacyListAliases: ["ProteinList"],
    legacyListAliasParams: { ProteinList: { filter: "protein" } },
  },
  epitope: {
    segment: "epitope",
    legacySingular: "Epitope",
    legacyList: "EpitopeList",
  },
  surveillance: {
    segment: "surveillance",
    legacySingular: "Surveillance",
    legacyList: "SurveillanceList",
  },
  serology: {
    segment: "serology",
    legacySingular: "Serology",
    legacyList: "SerologyList",
  },
  strain: {
    segment: "strain",
    legacyList: "StrainList",
  },
  "domains-and-motifs": {
    segment: "domains-and-motifs",
    legacyList: "DomainsAndMotifsList",
    legacyListAliases: ["ProteinFeaturesList"],
  },
  "protein-structure": {
    segment: "protein-structure",
    legacySingular: "ProteinStructure",
    legacyList: "ProteinStructureList",
  },
  experiment: {
    segment: "experiment",
    legacySingular: "ExperimentComparison",
    legacyList: "ExperimentList",
  },
} satisfies ViewRegistry;

export const viewSegments = Object.keys(viewRegistry);

/** Legacy BV-BRC view name → new segment. Derived so it cannot drift from routes. */
export interface LegacyViewTarget {
  segment: string;
  kind: "singular" | "list";
  defaultParams?: Readonly<Record<string, string>>;
}

export const legacyViewTargets = Object.fromEntries(
  (Object.values(viewRegistry) as ViewTypeEntry[]).flatMap((entry) => [
    ...[entry.legacySingular, ...(entry.legacySingularAliases ?? [])]
      .filter((name): name is string => Boolean(name))
      .map((name) => [
        name,
        { segment: entry.segment, kind: "singular" as const },
      ]),
    ...[entry.legacyList, ...(entry.legacyListAliases ?? [])]
      .filter((name): name is string => Boolean(name))
      .map((name) => [
        name,
        {
          segment: entry.segment,
          kind: "list" as const,
          defaultParams: entry.legacyListAliasParams?.[name],
        },
      ]),
  ]),
) as Record<string, LegacyViewTarget | undefined>;
