"use client";

/**
 * The strip between the command bar and the figure: at rest, how to use the
 * figure; with a gene pinned, its ID, product, family and links. The
 * Comfortable/Compact density toggle sits at its right end in both.
 */
import {
  ArrowUpRight,
  GitCompareArrows,
  Hand,
  MousePointer2,
  MousePointerClick,
  Rows2,
  Rows4,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { use, useId } from "react";
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
  compareRegionDensities,
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
import { cn } from "@/lib/utils";
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

const densityIcons: Record<CompareRegionDensity, LucideIcon> = {
  comfortable: Rows2,
  compact: Rows4,
};

interface DensityToggleProps {
  value: CompareRegionDensity;
  onChange: (next: CompareRegionDensity) => void;
  /** Show each option's name beside its icon when the strip has room (the hint row); else icons only. */
  named: boolean;
}

/**
 * Comfortable / Compact, styled as the command bar's PGfam / PLfam toggle
 * (`aria-pressed` buttons in a `bg-muted` pill), under a "Density" label in
 * the bar's label type. Each option's name stays in the DOM (sr-only when
 * the toggle shows icons only). Its hint opens below, clear of the bar's
 * zoom controls above it. The label and the unpressed option are 70%
 * foreground, not `muted-foreground`, which falls under 4.5:1 on the pill
 * and on the pin strip's muted wash in the light themes.
 */
export function DensityToggle({ value, onChange, named }: DensityToggleProps) {
  const labelId = useId();
  return (
    <span className="ml-auto flex shrink-0 items-center gap-2">
      <span
        id={labelId}
        className="text-3xs font-medium tracking-wide text-foreground/70 uppercase"
      >
        Density
      </span>
      <div
        role="group"
        aria-labelledby={labelId}
        className="flex h-7 items-center gap-0.5 rounded-lg bg-muted p-0.5"
      >
        {compareRegionDensities.map((option) => {
          const Icon = densityIcons[option];
          return (
            <Tooltip key={option}>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-pressed={value === option}
                    onClick={() => {
                      onChange(option);
                    }}
                    className={cn(
                      "flex h-6 items-center gap-1.5 rounded-md px-1.5 text-xs font-medium transition-colors",
                      named && "@4xl:px-2.5",
                      value === option
                        ? "bg-background text-foreground shadow-sm"
                        : // As the bar's Method toggle: `muted-foreground` is
                          // 3.7:1 on `muted` in the light themes.
                          "text-foreground/70 hover:text-foreground",
                    )}
                  />
                }
              >
                <Icon className="size-3.5" />
                <span
                  className={named ? "sr-only @4xl:not-sr-only" : "sr-only"}
                >
                  {compareRegionDensityLabels[option]}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {compareRegionDensityHints[option]}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
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
 * its family and links, or at rest how to use the figure. The density
 * toggle is named in the hint row
 * when there is room, and icons only beside a pinned gene, whose product
 * keeps the room. The container query (`@container` on the wrapper) reads
 * the card's width, not the window's. Both rows are 40 px tall on one line:
 * the 28 px toggle fits their 4 px padding.
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
  const toggle = (named: boolean) => (
    <DensityToggle
      value={density}
      named={named}
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
            Click to pin it
          </span>
          <span className="flex items-center gap-1.5">
            <Hand className="size-3.5" />
            Drag to pan
          </span>
          <span className="hidden items-center gap-1 sm:flex">
            <Kbd>{"⌘"}</Kbd>/<Kbd>Ctrl</Kbd>+ scroll to zoom
          </span>
          {toggle(true)}
        </div>
      </div>
    );
  }
  const { feature, row } = chosen;
  const reach = familyReach(model.families, feature, model.layout.rows.length);
  return (
    <div className="@container shrink-0">
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
          {toggle(false)}
        </span>
      </div>
    </div>
  );
}
