"use client";

/**
 * The Compare Region Viewer's command bar: the settings (each with a visible
 * label above it), the genome source and its workspace group, Update, the
 * zoom cluster and Export. The settings edit a draft that applies on Update
 * only (`useCompareRegionSettings`).
 */
import { Download, Loader2, RefreshCw, Rows3, Ruler } from "lucide-react";
import { useId, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  compareRegionGenomeCounts,
  compareRegionGroupLabels,
  compareRegionMethodLabels,
  compareRegionMethodShortLabels,
  compareRegionMethods,
  compareRegionSizes,
  isCompareRegionGroupFilter,
  pickOption,
} from "@/lib/compare-region/contract";
import { lastSegment } from "@/lib/services/workspace/picker-views";
import { cn } from "@/lib/utils";
import { GroupPicker, SourceMenu } from "./compare-region-source-picker";
import { ZoomCluster, type ZoomControls } from "./compare-region-zoom-controls";
import type { useCompareRegionSettings } from "./use-compare-region-settings";

const sizeItems = Object.fromEntries(
  compareRegionSizes.map((size) => [String(size), `${String(size / 1000)} kb`]),
);
const genomeItems = Object.fromEntries(
  compareRegionGenomeCounts.map((count) => [
    String(count),
    `${String(count)} genomes`,
  ]),
);

function Divider() {
  return (
    <span
      aria-hidden
      className="mx-0.5 mb-1.5 hidden h-5 w-px self-end bg-border sm:block"
    />
  );
}

/** A control with its label above it. The label also names the control (`aria-label` matches it). */
function BarField({
  label,
  children,
  htmlFor,
}: {
  label: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      {htmlFor ? (
        <label
          htmlFor={htmlFor}
          className="text-3xs font-medium tracking-wide text-muted-foreground uppercase"
        >
          {label}
        </label>
      ) : (
        <span className="text-3xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </span>
      )}
      {children}
    </div>
  );
}

export interface CommandBarProps {
  settings: ReturnType<typeof useCompareRegionSettings>;
  /** A request is in flight: the settings and Update are disabled. */
  busy: boolean;
  /** Signed out, the workspace group sources are disabled, and so is Update while one is chosen. */
  signedIn: boolean;
  /** Null while there is no chart to zoom. */
  zoom: ZoomControls | null;
  /** Null while there is no chart to export. */
  onExport: (() => void) | null;
}

export function CommandBar({
  settings,
  busy,
  signedIn,
  zoom,
  onExport,
}: CommandBarProps) {
  const { draft, update } = settings;
  const filter = draft.filter;
  const groupPath = isCompareRegionGroupFilter(filter) ? draft[filter] : "";
  const pickerId = useId();
  // One id per source: each slot's selector has its own, and the label names the active one.
  const groupPickerId = `${pickerId}${filter}`;
  const groupDisabled = busy || !signedIn;
  // A group URL opened signed out (or after the session ran out): the route
  // would answer 401, so only a public source can be applied.
  const groupNeedsSignIn = !signedIn && isCompareRegionGroupFilter(filter);
  return (
    <div className="flex shrink-0 flex-wrap items-end gap-2 border-b px-3 pt-2 pb-2.5">
      <div className="flex flex-wrap items-end gap-x-2.5 gap-y-2">
        <BarField label="Region size">
          <Select
            items={sizeItems}
            value={String(draft.size)}
            disabled={busy}
            onValueChange={(value) => {
              update({
                size:
                  pickOption(compareRegionSizes, String(value), draft.size) ??
                  draft.size,
              });
            }}
          >
            <SelectTrigger size="sm" aria-label="Region size">
              <Ruler className="size-3.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {Object.entries(sizeItems).map(([value, text]) => (
                  <SelectItem key={value} value={value}>
                    {text}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </BarField>
        <BarField label="Number of genomes">
          <Select
            items={genomeItems}
            value={String(draft.genomes)}
            disabled={busy}
            onValueChange={(value) => {
              update({
                genomes:
                  pickOption(
                    compareRegionGenomeCounts,
                    String(value),
                    draft.genomes,
                  ) ?? draft.genomes,
              });
            }}
          >
            <SelectTrigger size="sm" aria-label="Number of genomes">
              <Rows3 className="size-3.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {Object.entries(genomeItems).map(([value, text]) => (
                  <SelectItem key={value} value={value}>
                    {text}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </BarField>
        <BarField label="Method">
          <div
            role="group"
            aria-label="Method"
            className="flex h-7 items-center gap-0.5 rounded-lg bg-muted p-0.5"
          >
            {compareRegionMethods.map((method) => (
              <Tooltip key={method}>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      aria-pressed={draft.method === method}
                      disabled={busy}
                      onClick={() => {
                        update({ method });
                      }}
                      className={cn(
                        "h-6 rounded-md px-2.5 text-xs font-medium transition-colors",
                        draft.method === method
                          ? "bg-background text-foreground shadow-sm"
                          : // Not `muted-foreground`, 3.7:1 on `muted` in the
                            // light themes: 70% foreground holds 4.5:1 in all six.
                            "text-foreground/70 hover:text-foreground",
                      )}
                    />
                  }
                >
                  {compareRegionMethodShortLabels[method]}
                </TooltipTrigger>
                <TooltipContent>{compareRegionMethodLabels[method]}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </BarField>
        <BarField label="Genomes">
          <SourceMenu
            filter={filter}
            groupName={lastSegment(groupPath)}
            busy={busy}
            signedIn={signedIn}
            onChange={(next) => {
              update({ filter: next });
            }}
          />
        </BarField>
        {isCompareRegionGroupFilter(filter) && (
          <BarField
            label={compareRegionGroupLabels[filter]}
            htmlFor={groupPickerId}
          >
            {/* One slot per source, so switching sources mounts a fresh
                selector instead of carrying the other one's search. */}
            {filter === "genomeGroup" && (
              <GroupPicker
                id={groupPickerId}
                source="genomeGroup"
                value={draft.genomeGroup}
                disabled={groupDisabled}
                onPick={(path) => {
                  update({ genomeGroup: path });
                }}
              />
            )}
            {filter === "featureGroup" && (
              <GroupPicker
                id={groupPickerId}
                source="featureGroup"
                value={draft.featureGroup}
                disabled={groupDisabled}
                onPick={(path) => {
                  update({ featureGroup: path });
                }}
              />
            )}
          </BarField>
        )}
        <Button
          type="button"
          size="sm"
          disabled={!settings.canApply || busy || groupNeedsSignIn}
          onClick={settings.apply}
        >
          {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          Update
        </Button>
      </div>
      <div className="ml-auto flex items-end gap-1.5">
        <BarField label="Zoom">
          <ZoomCluster zoom={zoom} />
        </BarField>
        <Divider />
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Export SVG"
                disabled={!onExport}
                onClick={() => onExport?.()}
              />
            }
          >
            <Download />
          </TooltipTrigger>
          <TooltipContent>Export SVG</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
