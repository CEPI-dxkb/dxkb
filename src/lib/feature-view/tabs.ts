import type { EntityViewTab } from "@/components/views";
import {
  featureBrowserFocus,
  type GenomeBrowserFocus,
} from "@/lib/genome-browser/contract";
import { featureProteinStructureRql } from "@/lib/protein-structure-view/scope";
import { isPatricFeatureId, type FeatureViewRecord } from "./schema";

export const featureTabKeys = [
  "overview",
  "genome-browser",
  "compare-region",
  "transcriptomics",
  "interactions",
  "domains",
  "structures",
] as const;
export type FeatureTab = (typeof featureTabKeys)[number];

const legacyFeatureTabs: Partial<Record<string, FeatureTab>> = {
  genomeBrowser: "genome-browser",
  compareRegionViewer: "compare-region",
};

export function parseFeatureTab(
  value: string | string[] | undefined,
): FeatureTab {
  const raw = Array.isArray(value) ? value[0] : value;
  const tab = raw === undefined ? undefined : (legacyFeatureTabs[raw] ?? raw);
  return featureTabKeys.includes(tab as FeatureTab)
    ? (tab as FeatureTab)
    : "overview";
}

/** The Genome Browser tab's focus, or null without a genome or sequence location; shared by `enabled` and the panel. */
export function featureGenomeBrowserTarget(
  feature: FeatureViewRecord,
): { genomeId: string; focus: GenomeBrowserFocus } | null {
  const focus = featureBrowserFocus(feature);
  return feature.genome_id && focus
    ? { genomeId: feature.genome_id, focus }
    : null;
}

/** The gene the Compare Region Viewer centers on (CDS only, as in legacy; the service takes the BRC ID), or null. Shared by `enabled` and the panel. */
export function featureCompareRegionPeg(feature: FeatureViewRecord): string | null {
  const peg = feature.patric_id;
  return feature.feature_type === "CDS" && peg && isPatricFeatureId(peg)
    ? peg
    : null;
}

export function buildFeatureTabs(
  feature: FeatureViewRecord,
): readonly EntityViewTab<FeatureTab>[] {
  const hasInteractionId = Boolean(feature.feature_id);
  const browsable = featureGenomeBrowserTarget(feature) !== null;
  const comparable = featureCompareRegionPeg(feature) !== null;
  return [
    { key: "overview", label: "Overview" },
    {
      key: "genome-browser",
      label: "Genome Browser",
      enabled: browsable,
      disabledReason: browsable
        ? undefined
        : "This feature has no sequence location to show.",
    },
    {
      key: "compare-region",
      label: "Compare Region Viewer",
      enabled: comparable,
      disabledReason: comparable
        ? undefined
        : "Compare Region Viewer is only available for CDS features with a BRC ID.",
    },
    {
      key: "transcriptomics",
      label: "Transcriptomics",
      enabled: false,
      disabledReason: "Feature-scoped transcriptomics is not yet available.",
    },
    { key: "interactions", label: "Interactions", enabled: hasInteractionId },
    { key: "domains", label: "Domains and Motifs" },
    {
      key: "structures",
      label: "Protein Structures",
      enabled: Boolean(featureProteinStructureRql(feature)),
      disabledReason: featureProteinStructureRql(feature)
        ? undefined
        : "No protein structure identifiers are available for this feature.",
    },
  ];
}

export function canonicalFeatureTab(
  requested: string | string[] | undefined,
  feature: FeatureViewRecord,
): FeatureTab {
  const tab = parseFeatureTab(requested);
  return buildFeatureTabs(feature).find((item) => item.key === tab)?.enabled ===
    false
    ? "overview"
    : tab;
}
