import {
  AlignJustify,
  BookOpen,
  Copy,
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
 * Pure policy and config table shared by `SearchActionBar` and its test fake,
 * so the fake cannot offer an action the real bar hides.
 */

export type SearchActionId =
  | "guide"
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
   * Three ids appear twice with disjoint validSearchTypes (`copyRows`,
   * `features`, `group`); React keys come from configKey instead.
   */
  id: SearchActionId;
  configKey?: string;
  label: string;
  labelClassName?: string;
  icon?: LucideIcon;
  letter?: string;
  validSearchTypes: string[] | "*";
  requiresSelection?: boolean;
  maxSelection?: number;
  disabledWithTooltip?: string;
}

export const notReady = "Coming soon, still under construction";

/**
 * The SERVICES tooltip where no service accepts the selection, so the button is
 * disabled instead of opening an empty chooser.
 */
export function noServicesReason(
  singularLabel: string,
  pluralLabel: string,
  selectedCount: number,
): string {
  return selectedCount === 1
    ? `No services available for this ${singularLabel}`
    : `No services available for these ${pluralLabel}`;
}

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
      "genome_amr",
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
      "genome_amr",
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
    // Dispatched from the displayed detail row's `sequence_id`, so it only has
    // an answer for a single-row selection.
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

export interface SearchActionVisibility {
  searchType: string;
  selectedCount: number;
  hasGuideUrl: boolean;
}

/** An action outside this list is absent from the DOM, not present-and-disabled. */
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

export interface SearchActionEnablement {
  disabledActions?: Partial<Record<SearchActionId, string>>;
  enabledActions?: readonly SearchActionId[];
  loadingActionIds?: readonly SearchActionId[];
}

/**
 * A disabled action stays in the DOM, unlike one outside
 * `visibleSearchActions`.
 */
export function isSearchActionDisabled(
  action: SearchActionConfig,
  { disabledActions, enabledActions, loadingActionIds }: SearchActionEnablement,
): boolean {
  return (
    Boolean(disabledActions?.[action.id]) ||
    (!enabledActions?.includes(action.id) &&
      Boolean(action.disabledWithTooltip)) ||
    (loadingActionIds?.includes(action.id) ?? false)
  );
}
