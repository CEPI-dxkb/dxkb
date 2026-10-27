import type { EntityViewTab } from "@/components/views";
import {
  featureBrowserFocus,
  type GenomeBrowserFocus,
} from "@/lib/genome-browser/contract";
import { featureProteinStructureRql } from "@/lib/protein-structure-view/scope";
import type { FeatureViewRecord } from "./schema";

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

export function buildFeatureTabs(
  feature: FeatureViewRecord,
): readonly EntityViewTab<FeatureTab>[] {
  const hasInteractionId = Boolean(feature.feature_id);
  const browsable = featureGenomeBrowserTarget(feature) !== null;
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
      enabled: false,
      disabledReason:
        "A supported compare-region data contract is not yet available.",
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
