"use client";

/**
 * The strip between the command bar and the figure: at rest, how to use the
 * figure; with a gene pinned, its ID, product, family and links. The
 * Comfortable/Compact density toggle, one icon button, sits at its right end
 * in both.
 */
import {
  ArrowUpRight,
  GitCompareArrows,
  Hand,
  ListChevronsDownUp,
  ListChevronsUpDown,
  MousePointer2,
  MousePointerClick,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { use } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  hasCompareRegionTab,
  isCompareRegionLinkable,
  type CompareRegionSettings,
} from "@/lib/compare-region/contract";
import {
  compareRegionDensityHints,
  compareRegionDensityLabels,
  type CompareRegionDensity,
} from "@/lib/compare-region/density-options";
import {
  familyReach,
  resolveFeature,
  type ChartModel,
} from "@/lib/compare-region/families";
import {
  noProduct,
  rowTagText,
  splitGenomeName,
} from "@/lib/compare-region/genome-labels";
import { compareRegionHref } from "@/lib/compare-region/url-state";
import { featureHref } from "@/lib/views/hrefs";
import { FeatureSwatch } from "./compare-region-glyphs";
import { PinContext } from "./compare-region-highlight";

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="rounded border bg-muted px-1 font-mono text-3xs text-foreground">
      {children}
    </kbd>
  );
}

/** The other density, which the toggle switches to. */
const nextDensity: Record<CompareRegionDensity, CompareRegionDensity> = {
  comfortable: "compact",
  compact: "comfortable",
};

/** Each button shows what it does: chevrons closing in for Compact, opening out for Comfortable. */
const densityIcons: Record<CompareRegionDensity, LucideIcon> = {
  comfortable: ListChevronsUpDown,
  compact: ListChevronsDownUp,
};

interface DensityToggleProps {
  value: CompareRegionDensity;
  onChange: (next: CompareRegionDensity) => void;
}

/**
 * One icon button that switches to the other density. Its icon and name
 * say where a press goes ("Switch to Compact density"), and its tooltip says
 * what that does in one plain sentence. The tooltip opens below, clear of the
 * bar's zoom controls above it.
 */
export function DensityToggle({ value, onChange }: DensityToggleProps) {
  const next = nextDensity[value];
  const Icon = densityIcons[next];
  const name = `Switch to ${compareRegionDensityLabels[next]} density`;
  return (
    // In the foreground, as the bar's Export button is (the rest of the hint
    // row is muted).
    <span className="ml-auto flex shrink-0 items-center text-foreground">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={name}
              onClick={() => {
                onChange(next);
              }}
            />
          }
        >
          <Icon className="size-4.5" />
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {compareRegionDensityHints[next]}
        </TooltipContent>
      </Tooltip>
    </span>
  );
}

interface SelectionStripProps {
  model: ChartModel;
  /** The settings this answer was compared with; "Compare regions" carries them to the next gene. */
  settings: CompareRegionSettings;
  onClear: () => void;
  density: CompareRegionDensity;
  /** A density switch, with the pinned row (null when none) so the figure can keep it in view. */
  onDensityChange: (
    next: CompareRegionDensity,
    pinnedRow: number | null,
  ) => void;
}

/**
 * The pinned gene (from `PinContext`, so a hover re-renders none of it) with
 * its family and links, or at rest how to use the figure. The container query
 * (`@container` on the wrapper) reads the card's width, not the window's.
 * Both rows are 40 px tall on one line: the 28 px toggle fits their 4 px
 * padding.
 */
export function SelectionStrip({
  model,
  settings,
  onClear,
  density,
  onDensityChange,
}: SelectionStripProps) {
  const selected = use(PinContext);
  const chosen = resolveFeature(model.layout, selected);
  const pinnedRow = chosen && selected ? selected.rowIndex : null;
  const toggle = (
    <DensityToggle
      value={density}
      onChange={(next) => {
        onDensityChange(next, pinnedRow);
      }}
    />
  );
  if (!chosen || !selected) {
    return (
      <div className="@container shrink-0">
        <div className="flex min-h-10 shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b px-3 py-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <MousePointer2 className="size-3.5" />
            Hover a gene to trace its family
          </span>
          <span className="flex items-center gap-1.5">
            <MousePointerClick className="size-3.5" />
            Click for details
          </span>
          <span className="flex items-center gap-1.5">
            <Hand className="size-3.5" />
            Drag to pan
          </span>
          <span className="hidden items-center gap-1 sm:flex">
            <Kbd>{"⌘"}</Kbd>/<Kbd>Ctrl</Kbd>+ scroll to zoom
          </span>
          {toggle}
        </div>
      </div>
    );
  }
  const { feature, row } = chosen;
  const reach = familyReach(model.families, feature, model.layout.rows.length);
  return (
    <div data-selection-strip="" className="@container shrink-0">
      {/* One line once the card has room for the product beside the toggle; it wraps below that. */}
      <div className="flex min-h-10 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b bg-muted/30 px-3 py-1 text-xs @5xl:flex-nowrap">
        <FeatureSwatch spec={model.spec} feature={feature} faded={false} />
        <span className="shrink-0 font-mono text-2xs">{feature.fid}</span>
        <span
          title={feature.product || noProduct}
          className="min-w-0 truncate text-sm font-medium"
        >
          {feature.product || noProduct}
        </span>
        {feature.familyId && (
          <span className="shrink-0 rounded-md bg-background px-1.5 py-0.5 text-2xs whitespace-nowrap text-muted-foreground ring-1 ring-border">
            <span className="font-mono text-foreground">
              {feature.familyId}
            </span>
            {reach && ` · ${reach}`}
          </span>
        )}
        {/* The species only (the full name in the title), so the product keeps
            the room. 70% foreground: `muted-foreground` falls under 4.5:1 on
            this row's muted wash in the light themes. */}
        <span
          title={row.genomeName}
          className="max-w-48 shrink-0 truncate text-foreground/70"
        >
          <span className="font-mono text-2xs">{`${rowTagText(selected.rowIndex)} `}</span>
          <span className="italic">
            {splitGenomeName(row.genomeName).binomial}
          </span>
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-3">
          {isCompareRegionLinkable(feature.fid) && (
            <Link
              className="inline-flex items-center gap-0.5 font-medium text-link hover:underline dark:hover:text-foreground"
              href={featureHref(feature.fid)}
            >
              Open feature
              <ArrowUpRight className="size-3.5" />
            </Link>
          )}
          {hasCompareRegionTab(feature.fid) && (
            <Link
              className="inline-flex items-center gap-1 font-medium text-link hover:underline dark:hover:text-foreground"
              href={compareRegionHref(feature.fid, settings)}
              title="Compare regions around this gene"
            >
              <GitCompareArrows className="size-3.5" />
              Compare regions
            </Link>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Clear selection"
            onClick={onClear}
          >
            <X />
          </Button>
          <span aria-hidden className="h-4 w-px bg-border" />
          {toggle}
        </span>
      </div>
    </div>
  );
}
