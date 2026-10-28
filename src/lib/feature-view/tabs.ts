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

/** Legacy BV-BRC tab names (`#view_tab=genomeBrowser`) the server redirects. */
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

/**
 * What the Genome Browser tab opens on: the feature's genome, framed and
 * highlighted (`featureBrowserFocus`), or null when the feature has no genome
 * or no sequence location. The one predicate for both the tab's `enabled` and
 * the panel the member renders, so a `?tab=genome-browser` link can never show
 * a browser behind a disabled tab.
 */
export function featureGenomeBrowserTarget(
  feature: FeatureViewRecord,
): { genomeId: string; focus: GenomeBrowserFocus } | null {
  const focus = featureBrowserFocus(feature);
  return feature.genome_id && focus
    ? { genomeId: feature.genome_id, focus }
    : null;
}

/**
 * The gene the Compare Region Viewer centers on, or null when the tab is
 * unavailable. Legacy BV-BRC offered it only for CDS features, and the
 * compare_regions service takes the BRC ID (`patric_id`). It is the one
 * predicate for both the tab's `enabled` and the panel the member renders.
 */
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
