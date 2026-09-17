import {
  AlignJustify,
  BookOpen,
  Copy,
  Download,
  Settings,
  Group,
  Binary,
  ArrowRightLeft,
  Map,
  Eye,
  List,
  PanelsTopLeft,
  type LucideIcon,
} from "lucide-react";

/**
 * The action bar's visibility and enablement policy, and the config table both read
 * from. Pure: every input arrives as an argument and nothing here renders.
 *
 * Split out of `search-action-bar.tsx` so the `SearchActionBar` fake the
 * `resource-collection*.test.tsx` suites install can consume the *same* rules
 * (plan item 33). A hand-written fake could only model some of them — it modelled
 * `disabledActions` and the `enabledActions` gate but not `validSearchTypes`,
 * `requiresSelection` or `maxSelection` — which let those suites click buttons the
 * real bar would never have rendered. Both consumers calling these two functions is
 * what makes that impossible rather than merely unlikely.
 */

export type SearchActionId =
  | "guide"
  | "download"
  | "copyRows"
  | "services"
  | "genome"
  | "genomes"
  | "group"
  | "feature"
  | "fasta"
  | "idMap"
  | "epitope"
  | "structure"
  | "variantTypes"
  | "surveillance"
  | "map"
  | "serology"
  | "taxonOverview"
  | "features"
  | "ppiFeatures"
  | "experiment"
  | "biosets"
  | "browser";

export interface SearchActionConfig {
  /**
   * Dispatch value and consumer-map key. Three ids appear twice with disjoint
   * validSearchTypes (`copyRows`, `features` and `group`); React keys come from
   * configKey instead so those entries can never collide.
   */
  id: SearchActionId;
  /** Unique per entry. Defaults to `id` — only set where an id repeats. */
  configKey?: string;
  label: string;
  labelClassName?: string;
  icon?: LucideIcon;
  letter?: string;
  validSearchTypes: string[] | "*";
  requiresSelection?: boolean;
  // Hide the action once the selection exceeds this many rows (e.g. single-select
  // -only actions set it to 1). Absent = no upper bound.
  maxSelection?: number;
  disabledWithTooltip?: string;
}

export const notReady = "Coming soon, still under construction";

/** Rendered top to bottom in this order, which follows the legacy action bar. */
export const searchActionConfig: SearchActionConfig[] = [
  {
    id: "guide",
    label: "GUIDE",
    icon: BookOpen,
    validSearchTypes: "*",
    requiresSelection: false,
  },
  {
    id: "taxonOverview",
    label: "TAXON\nOVERVIEW",
    labelClassName: "text-[9px]",
    icon: Eye,
    validSearchTypes: ["taxonomy"],
    requiresSelection: true,
    maxSelection: 1,
    // Enabled/disabled per consumer via disabledActions (live in taxon-view,
    // disabled on /search until that page wires a handler).
  },
  {
    id: "download",
    label: "DWNLD",
    icon: Download,
    validSearchTypes: [
      "bioset",
      "epitope",
      "experiment",
      "genome_feature",
      "genome_sequence",
      "protein_feature",
      "protein_structure",
      "ppi",
      "sequence_feature",
      "serology",
      "surveillance",
    ],
    requiresSelection: true,
  },
  {
    id: "copyRows",
    configKey: "copyRows:rows",
    label: "COPY ROWS",
    labelClassName: "text-[9px]",
    icon: Copy,
    validSearchTypes: ["genome_sequence", "sequence_feature"],
    requiresSelection: true,
    disabledWithTooltip: notReady,
  },
  {
    id: "copyRows",
    label: "COPY",
    icon: Copy,
    validSearchTypes: [
      "genome",
      "strain",
      "genome_feature",
      "protein_feature",
      "epitope",
      "protein_structure",
      "surveillance",
      "serology",
      "ppi",
    ],
    requiresSelection: true,
    disabledWithTooltip: notReady,
  },
  {
    id: "services",
    label: "SERVICES",
    icon: Settings,
    validSearchTypes: "*",
    requiresSelection: true,
    disabledWithTooltip: notReady,
  },
  {
    id: "feature",
    label: "FEATURE",
    letter: "F",
    validSearchTypes: [
      "genome_feature",
      "protein_feature",
      "protein_structure",
    ],
    requiresSelection: true,
    maxSelection: 1,
  },
  {
    id: "variantTypes",
    label: "VARIANT\nTYPES",
    icon: AlignJustify,
    validSearchTypes: ["sequence_feature"],
    requiresSelection: true,
    maxSelection: 1,
    disabledWithTooltip: notReady,
  },
  {
    id: "genome",
    label: "GENOME",
    letter: "G",
    validSearchTypes: [
      "genome",
      "genome_sequence",
      "genome_feature",
      "protein_feature",
      "protein_structure",
    ],
    requiresSelection: true,
    maxSelection: 1,
  },
  {
    id: "genomes",
    label: "GENOMES",
    labelClassName: "text-[10px]",
    letter: "G",
    validSearchTypes: ["strain", "taxonomy"],
    requiresSelection: true,
    disabledWithTooltip: notReady,
  },
  {
    id: "features",
    configKey: "features:genome_sequence",
    label: "FEATURES",
    letter: "F",
    validSearchTypes: ["genome_sequence"],
    requiresSelection: true,
    // ResourceCollection dispatches this from the displayed detail row's
    // `sequence_id`, so it only has an answer for a single-row selection.
    maxSelection: 1,
    disabledWithTooltip: notReady,
  },
  {
    id: "ppiFeatures",
    label: "FEATURES",
    letter: "F",
    validSearchTypes: ["ppi"],
    requiresSelection: true,
    disabledWithTooltip: notReady,
  },
  {
    id: "fasta",
    label: "FASTA",
    icon: Binary,
    validSearchTypes: ["genome_sequence", "genome_feature", "ppi"],
    requiresSelection: true,
    disabledWithTooltip: notReady,
  },
  {
    id: "group",
    configKey: "group:genome_sequence",
    label: "GROUP",
    icon: Group,
    validSearchTypes: ["genome_sequence"],
    requiresSelection: true,
    disabledWithTooltip: notReady,
  },
  {
    id: "idMap",
    label: "ID MAP",
    icon: ArrowRightLeft,
    validSearchTypes: ["genome_feature"],
    requiresSelection: true,
    disabledWithTooltip: notReady,
  },
  {
    id: "group",
    label: "GROUP",
    icon: Group,
    validSearchTypes: ["genome", "strain", "genome_feature", "ppi"],
    requiresSelection: true,
    disabledWithTooltip: notReady,
  },
  {
    id: "epitope",
    label: "EPITOPE",
    letter: "E",
    validSearchTypes: ["epitope"],
    requiresSelection: true,
    maxSelection: 1,
  },
  {
    id: "structure",
    label: "STRUCTURE",
    labelClassName: "text-[10px]",
    letter: "S",
    validSearchTypes: ["protein_structure"],
    requiresSelection: true,
    maxSelection: 1,
  },
  {
    id: "surveillance",
    label: "SRVLNCE",
    letter: "S",
    validSearchTypes: ["surveillance"],
    requiresSelection: true,
    maxSelection: 1,
  },
  {
    id: "map",
    label: "MAP",
    icon: Map,
    validSearchTypes: ["surveillance"],
    requiresSelection: true,
    disabledWithTooltip: notReady,
  },
  {
    id: "serology",
    label: "SEROLOGY",
    labelClassName: "text-[10px]",
    letter: "S",
    validSearchTypes: ["serology"],
    requiresSelection: true,
    maxSelection: 1,
  },
  {
    id: "features",
    label: "FEATURES",
    letter: "F",
    validSearchTypes: ["taxonomy"],
    requiresSelection: true,
    maxSelection: 1,
    disabledWithTooltip: notReady,
  },
  {
    id: "experiment",
    label: "EXPRMNT",
    labelClassName: "text-[10px]",
    letter: "E",
    validSearchTypes: ["experiment"],
    requiresSelection: true,
    maxSelection: 1,
  },
  {
    id: "biosets",
    label: "BIOSETS",
    icon: List,
    validSearchTypes: ["experiment", "bioset"],
    requiresSelection: true,
    disabledWithTooltip: notReady,
  },
  {
    id: "browser",
    label: "BROWSER",
    icon: PanelsTopLeft,
    validSearchTypes: ["genome_sequence"],
    requiresSelection: true,
    disabledWithTooltip: notReady,
  },
];

/** What decides whether the bar renders a button for an action at all. */
export interface SearchActionVisibility {
  searchType: string;
  selectedCount: number;
  /** GUIDE has nowhere to go without one, so it is dropped rather than disabled. */
  hasGuideUrl: boolean;
}

/**
 * The actions in scope for this search type and selection size, in config order.
 * An action outside this list is absent from the DOM, not present-and-disabled.
 */
export function visibleSearchActions({
  searchType,
  selectedCount,
  hasGuideUrl,
}: SearchActionVisibility): SearchActionConfig[] {
  return searchActionConfig.filter((action) => {
    if (
      action.validSearchTypes !== "*" &&
      !action.validSearchTypes.includes(searchType)
    ) {
      return false;
    }
    if (action.id === "guide" && !hasGuideUrl) {
      return false;
    }
    // Hide selection-dependent buttons until at least one row is selected
    if (action.requiresSelection && selectedCount === 0) {
      return false;
    }
    if (
      action.maxSelection !== undefined &&
      selectedCount > action.maxSelection
    ) {
      return false;
    }
    return true;
  });
}

/** What decides whether a visible action's button is disabled. */
export interface SearchActionEnablement {
  disabledActions?: Partial<Record<SearchActionId, string>>;
  enabledActions?: readonly SearchActionId[];
}

/**
 * Whether a visible action is disabled: the consumer gave an explicit reason, or the
 * action is one of the `disabledWithTooltip` entries and the consumer has not opted
 * it in through `enabledActions`. A disabled action stays in the DOM — that is the
 * difference between this and `visibleSearchActions`.
 */
export function isSearchActionDisabled(
  action: SearchActionConfig,
  { disabledActions, enabledActions }: SearchActionEnablement,
): boolean {
  return (
    Boolean(disabledActions?.[action.id]) ||
    (!enabledActions?.includes(action.id) &&
      Boolean(action.disabledWithTooltip))
  );
}
