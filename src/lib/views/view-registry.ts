import type { ViewRegistry, ViewTypeEntry } from "./view-types";

// Data-only route metadata shared by canonical links, legacy redirects, search,
// identifier validation, and collection defaults. Domain query and UI behavior stays
// in each resource's colocated view module.
export const viewRegistry = {
  taxonomy: {
    segment: "taxonomy",
    label: "Taxonomy",
    legacySingular: "Taxonomy",
    legacyList: "TaxonList",
    searchType: "taxonomy",
    singular: { idParam: "taxonId", idKind: "int", defaultTab: "overview" },
    list: {
      endpoint: "taxonomy",
      defaultTab: "taxons",
      friendlyParams: ["keyword", "taxon_id"],
    },
  },
  genome: {
    segment: "genome",
    label: "Genome",
    legacySingular: "Genome",
    legacyList: "GenomeList",
    searchType: "genome",
    singular: { idParam: "genomeId", idKind: "string", defaultTab: "overview" },
    list: {
      endpoint: "genome",
      defaultTab: "genomes",
      friendlyParams: ["keyword", "taxon_id"],
    },
  },
  feature: {
    segment: "feature",
    label: "Feature",
    legacySingular: "Feature",
    legacySingularAliases: ["Protein"],
    legacyList: "FeatureList",
    legacyListAliases: ["ProteinList"],
    legacyListAliasParams: { ProteinList: { filter: "protein" } },
    searchType: "genome_feature",
    singular: {
      idParam: "featureId",
      idKind: "string",
      defaultTab: "overview",
    },
    list: {
      endpoint: "genome_feature",
      defaultTab: "overview",
      friendlyParams: ["keyword", "genome_id"],
    },
  },
  epitope: {
    segment: "epitope",
    label: "Epitope",
    legacySingular: "Epitope",
    legacyList: "EpitopeList",
    searchType: "epitope",
    singular: {
      idParam: "epitopeId",
      idKind: "string",
      defaultTab: "overview",
    },
    list: {
      endpoint: "epitope",
      defaultTab: "epitope",
      friendlyParams: ["keyword", "taxon_id"],
    },
  },
  surveillance: {
    segment: "surveillance",
    label: "Surveillance",
    legacySingular: "Surveillance",
    legacyList: "SurveillanceList",
    searchType: "surveillance",
    singular: { idParam: "sampleId", idKind: "string", defaultTab: "overview" },
    list: {
      endpoint: "surveillance",
      defaultTab: "surveillance",
      friendlyParams: ["keyword", "pathogen_test_type"],
    },
  },
  serology: {
    segment: "serology",
    label: "Serology",
    legacySingular: "Serology",
    legacyList: "SerologyList",
    searchType: "serology",
    singular: { idParam: "sampleId", idKind: "string", defaultTab: "overview" },
    list: {
      endpoint: "serology",
      defaultTab: "serology",
      friendlyParams: ["keyword", "test_type"],
    },
  },
  strain: {
    segment: "strain",
    label: "Strain",
    legacyList: "StrainList",
    searchType: "strain",
    list: {
      endpoint: "strain",
      defaultTab: "strain",
      friendlyParams: ["keyword", "taxon_id", "strain"],
    },
  },
  "domains-and-motifs": {
    segment: "domains-and-motifs",
    label: "Domains and Motifs",
    legacyList: "DomainsAndMotifsList",
    legacyListAliases: ["ProteinFeaturesList"],
    searchType: "protein_feature",
    list: {
      endpoint: "protein_feature",
      defaultTab: "proteinFeatures",
      friendlyParams: ["keyword", "genome_id", "feature_id"],
    },
  },
  "protein-structure": {
    segment: "protein-structure",
    label: "Protein Structures",
    legacySingular: "ProteinStructure",
    legacyList: "ProteinStructureList",
    searchType: "protein_structure",
    singular: { idParam: "accession", idKind: "none", defaultTab: "overview" },
    list: {
      endpoint: "protein_structure",
      defaultTab: "structures",
      friendlyParams: ["keyword", "taxon_id", "genome_id"],
    },
  },
  experiment: {
    segment: "experiment",
    label: "Experiment",
    legacySingular: "ExperimentComparison",
    legacyList: "ExperimentList",
    searchType: "experiment",
    singular: {
      idParam: "experimentId",
      idKind: "int",
      defaultTab: "overview",
    },
    list: {
      endpoint: "experiment",
      defaultTab: "experiments",
      friendlyParams: ["keyword", "taxon_id"],
    },
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

export const legacyToSegment: Record<string, string> = Object.fromEntries(
  Object.entries(legacyViewTargets).flatMap(([name, target]) =>
    target ? [[name, target.segment]] : [],
  ),
);
