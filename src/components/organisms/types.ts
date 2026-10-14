import type { ComponentType, ReactNode } from "react";

export type OrganismViewKey =
  | "overview"
  | "phylogeny"
  | "taxa-tree"
  | "genomes"
  | "sequences"
  | "features"
  | "protein-structures"
  | "domains-and-motifs"
  | "epitopes"
  | "experiments"
  | "interactions"
  | "strains"
  | "surveillance"
  | "serology"
  | "sfvt";

export interface OrganismLandingView {
  key: OrganismViewKey;
  label: string;
  icon: ReactNode;
  Component: ComponentType;
  /** When false, the tab renders disabled (greyed, non-clickable). Defaults to enabled. */
  enabled?: boolean;
  /** Tooltip/title shown when the tab is disabled. */
  disabledReason?: string;
  /**
   * How the shell frames this view's content region.
   * - "scroll" (default): the region scrolls vertically (doc-style, e.g. Overview).
   * - "fill": the region is a bounded, non-scrolling flex box that the view fills
   *   exactly (table views own their internal scroll).
   */
  layout?: "scroll" | "fill";
}

export interface OrganismLandingNavItem<Key extends string = OrganismViewKey> {
  key: Key;
  label: string;
  icon: ReactNode;
  enabled?: boolean;
  disabledReason?: string;
  /** Shown at the item's end (Global Search's matches per data type). */
  count?: string;
}

export interface OrganismLandingConfig {
  displayName: string;
  taxonId: number;
  accent: "bacteria" | "viruses" | "fungi" | "all";
  metadataFields: string[];
  showAmr?: boolean;
  defaultView?: OrganismViewKey;
  /** When true, tabs with enabled=false are removed from the strip. Default: false (shown greyed). */
  hideDisabledTabs?: boolean;
}

// Sentinel that can be placed in metadataFields to position the Taxonomic
// Distribution chart within the grid. Without it the chart renders last.
export const taxonomicDistributionSentinel = "_taxonomic_distribution";
