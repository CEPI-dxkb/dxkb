"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
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
  | "surveillance"
  | "map"
  | "serology"
  | "taxonOverview"
  | "features"
  | "ppiFeatures"
  | "experiment"
  | "biosets"
  | "browser";

interface ActionConfig {
  /**
   * Dispatch value and consumer-map key. Several entries share an id with disjoint
   * validSearchTypes (COPY vs COPY ROWS, FEATURES vs FEATURE); React keys come from
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

const actionConfig: ActionConfig[] = [
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
    validSearchTypes: ["bioset", "genome_sequence"],
    requiresSelection: true,
  },
  {
    id: "copyRows",
    configKey: "copyRows:genome_sequence",
    label: "COPY ROWS",
    labelClassName: "text-[9px]",
    icon: Copy,
    validSearchTypes: ["genome_sequence"],
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
    id: "group",
    label: "GROUP",
    icon: Group,
    validSearchTypes: ["genome", "strain", "genome_feature", "ppi"],
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
    label: "EXPERMNT",
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

export interface SearchActionBarProps {
  selectedCount: number;
  searchType: string;
  guideUrl?: string;
  // Per-consumer disable with a tooltip reason. Lets one shared config power both
  // /search and the taxon-view, which disable different subsets of the same
  // taxonomy actions.
  disabledActions?: Partial<Record<SearchActionId, string>>;
  enabledActions?: readonly SearchActionId[];
  loadingActionIds?: SearchActionId[];
  actionPopovers?: Partial<Record<SearchActionId, ReactNode>>;
  onAction?: (actionId: SearchActionId) => void;
}

export function SearchActionBar({
  selectedCount,
  searchType,
  guideUrl,
  disabledActions,
  enabledActions,
  loadingActionIds,
  actionPopovers,
  onAction,
}: SearchActionBarProps) {
  const visibleActions = actionConfig.filter((action) => {
    if (
      action.validSearchTypes !== "*" &&
      !action.validSearchTypes.includes(searchType)
    ) {
      return false;
    }
    if (action.id === "guide" && !guideUrl) {
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

  const isDisabled = (action: ActionConfig) =>
    Boolean(disabledActions?.[action.id]) ||
    (!enabledActions?.includes(action.id) &&
      Boolean(action.disabledWithTooltip));

  const isLoading = (actionId: SearchActionId) =>
    loadingActionIds?.includes(actionId) ?? false;

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-1">
        {visibleActions.map((action) => {
          const renderKey = action.configKey ?? action.id;
          const Icon = action.icon;
          const showSpinner = isLoading(action.id);
          const disabled = isDisabled(action);
          const tooltipText =
            disabledActions?.[action.id] ?? action.disabledWithTooltip;
          const popoverContent = actionPopovers?.[action.id];
          const actionContent = (
            <>
              {showSpinner ? (
                <Spinner className="size-4 shrink-0" />
              ) : action.letter ? (
                <span className="text-2xl leading-none font-black">
                  {action.letter}
                </span>
              ) : Icon ? (
                <Icon className="size-4 shrink-0" />
              ) : null}
              <span
                className={`wrap-break-words text-center leading-tight font-medium whitespace-normal ${action.labelClassName ?? "text-[9px]"}`}
              >
                {action.label.split("\n").map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </span>
            </>
          );

          const buttonEl = (
            <Button
              key={renderKey}
              variant="secondary"
              className="h-15 w-full flex-col gap-1 font-normal"
              disabled={disabled || showSpinner}
              onClick={
                popoverContent
                  ? undefined
                  : () => {
                      if (action.id === "guide") {
                        if (guideUrl)
                          window.open(
                            guideUrl,
                            "_blank",
                            "noopener,noreferrer",
                          );
                      } else {
                        onAction?.(action.id);
                      }
                    }
              }
            >
              {actionContent}
            </Button>
          );

          if (popoverContent && !disabled) {
            return (
              <Popover key={renderKey}>
                <PopoverTrigger
                  render={
                    <Button
                      variant="secondary"
                      className="h-15 w-full flex-col gap-1 font-normal"
                      disabled={showSpinner}
                    >
                      {actionContent}
                    </Button>
                  }
                />
                <PopoverContent side="left" align="center">
                  {popoverContent}
                </PopoverContent>
              </Popover>
            );
          }

          return tooltipText && disabled ? (
            <Tooltip key={renderKey}>
              <TooltipTrigger
                render={
                  <span className="inline-flex w-full cursor-not-allowed">
                    {buttonEl}
                  </span>
                }
              />
              <TooltipContent side="left">
                <p>{tooltipText}</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            buttonEl
          );
        })}
      </div>
    </TooltipProvider>
  );
}
