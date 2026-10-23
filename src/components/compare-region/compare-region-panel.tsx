"use client";

import { useQuery } from "@tanstack/react-query";
import { useParentSize } from "@visx/responsive";
import { Download } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryRetryButton } from "@/components/views/query-retry-button";
import { useTabContentSearchParams } from "@/components/views/tab-content-search-params";
import { useRetryKeepingError } from "@/components/views/use-retry-keeping-error";
import { compareRegionQueryKeys, loadCompareRegion } from "@/lib/compare-region/client";
import {
  compareRegionFilterLabels,
  compareRegionFilters,
  compareRegionGenomeCounts,
  compareRegionMethodLabels,
  compareRegionMethods,
  compareRegionSizes,
  pickOption,
  type CompareRegionSettings,
} from "@/lib/compare-region/contract";
import {
  parseCompareRegionUrlState,
  writeCompareRegionUrlState,
} from "@/lib/compare-region/url-state";
import { downloadBlob, formatUserFacingErrorMessage } from "@/lib/utils";
import { CompareRegionChart } from "./compare-region-chart";

const bp = new Intl.NumberFormat("en-US");
const sizeItems = Object.fromEntries(
  compareRegionSizes.map((size) => [String(size), `${bp.format(size)} bp`]),
);
const genomeItems = Object.fromEntries(
  compareRegionGenomeCounts.map((count) => [String(count), String(count)]),
);

function sameSettings(a: CompareRegionSettings, b: CompareRegionSettings): boolean {
  return (
    a.size === b.size &&
    a.genomes === b.genomes &&
    a.method === b.method &&
    a.filter === b.filter
  );
}

/** The chart as a standalone SVG file: black on white, whatever the theme. */
function exportSvg(svg: SVGSVGElement, fileName: string): void {
  const copy = svg.cloneNode(true) as SVGSVGElement;
  copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  copy.style.color = "#000";
  copy.style.backgroundColor = "#fff";
  copy.style.fontFamily = getComputedStyle(svg).fontFamily;
  const markup = new XMLSerializer().serializeToString(copy);
  downloadBlob(new Blob([markup], { type: "image/svg+xml" }), fileName);
}

interface SettingSelectProps {
  label: string;
  value: string;
  items: Record<string, string>;
  disabled: boolean;
  onChange: (value: string) => void;
}

function SettingSelect({ label, value, items, disabled, onChange }: SettingSelectProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Select
        items={items}
        value={value}
        disabled={disabled}
        onValueChange={(next) => {
          // An unknown value falls back to the current setting in `pickOption`.
          onChange(String(next));
        }}
      >
        <SelectTrigger aria-label={label} className="w-52">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {Object.entries(items).map(([key, text]) => (
              <SelectItem key={key} value={key}>
                {text}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

interface SettingsBarProps {
  applied: CompareRegionSettings;
  busy: boolean;
  canExport: boolean;
  onApply: (settings: CompareRegionSettings) => void;
  onExport: () => void;
}

/**
 * Applied on Update, not per change, as in legacy BV-BRC: one request can take
 * a minute, and the service takes one at a time.
 */
function SettingsBar({ applied, busy, canExport, onApply, onExport }: SettingsBarProps) {
  const [draft, setDraft] = useState(applied);
  return (
    <div className="flex flex-wrap items-end gap-3 border-b px-3 py-2">
      <SettingSelect
        label="Region size"
        value={String(draft.size)}
        items={sizeItems}
        disabled={busy}
        onChange={(value) => {
          setDraft({ ...draft, size: pickOption(compareRegionSizes, value, draft.size) ?? draft.size });
        }}
      />
      <SettingSelect
        label="Number of genomes"
        value={String(draft.genomes)}
        items={genomeItems}
        disabled={busy}
        onChange={(value) => {
          setDraft({
            ...draft,
            genomes: pickOption(compareRegionGenomeCounts, value, draft.genomes) ?? draft.genomes,
          });
        }}
      />
      <SettingSelect
        label="Method"
        value={draft.method}
        items={compareRegionMethodLabels}
        disabled={busy}
        onChange={(value) => {
          setDraft({ ...draft, method: pickOption(compareRegionMethods, value, draft.method) ?? draft.method });
        }}
      />
      <SettingSelect
        label="Genomes"
        value={draft.filter}
        items={compareRegionFilterLabels}
        disabled={busy}
        onChange={(value) => {
          setDraft({ ...draft, filter: pickOption(compareRegionFilters, value, draft.filter) ?? draft.filter });
        }}
      />
      <Button
        type="button"
        size="sm"
        disabled={busy || sameSettings(draft, applied)}
        onClick={() => {
          onApply(draft);
        }}
      >
        Update
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={!canExport} onClick={onExport}>
        <Download />
        Export SVG
      </Button>
    </div>
  );
}

export interface CompareRegionPanelProps {
  /** The focus gene's BRC ID (`patric_id`, `fig|…`). */
  patricId: string;
}

export function CompareRegionPanel({ patricId }: CompareRegionPanelProps) {
  const applied = parseCompareRegionUrlState(useTabContentSearchParams());
  const query = { peg: patricId, ...applied };
  // One string per request: it keys the settings draft, the chart (so a new
  // answer starts unzoomed and unselected) and the retry's identity.
  const queryIdentity = JSON.stringify(query);
  const result = useQuery({
    queryKey: compareRegionQueryKeys.rows(query),
    // No `signal`: TanStack aborts a query that read it when its last
    // observer unmounts (a tab switch), while the service call it started
    // keeps running on the server. Returning would then queue a second
    // request behind it; without the signal it re-joins the one in flight.
    queryFn: () => loadCompareRegion(query),
    // A request takes seconds to a minute and the service takes one at a
    // time: keep answers for the visit, and let the user retry rather than
    // retrying for them.
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 30 * 60_000,
    retry: false,
  });
  const loadRetry = useRetryKeepingError(result, queryIdentity);
  const { parentRef, width } = useParentSize({ debounceTime: 50 });
  const svgRef = useRef<SVGSVGElement>(null);
  const rows = result.data;

  let body: ReactNode = null;
  if (loadRetry.error) {
    body = (
      <Alert variant="destructive" className="m-3">
        <AlertTitle>Could not compare regions</AlertTitle>
        <AlertDescription>
          <p>
            {formatUserFacingErrorMessage(
              loadRetry.error,
              "The compare region service did not answer.",
            )}
          </p>
          <QueryRetryButton retrying={loadRetry.retrying} onRetry={loadRetry.retry} />
        </AlertDescription>
      </Alert>
    );
  } else if (!rows) {
    body = (
      <div className="space-y-2 p-3" role="status">
        <p className="text-sm text-muted-foreground">
          {`Comparing regions across ${String(applied.genomes)} genomes. This takes from a few seconds to over a minute.`}
        </p>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  } else if (rows.length === 0) {
    body = (
      <p className="p-6 text-sm text-muted-foreground">
        No comparable regions were found for this gene.
      </p>
    );
  } else if (width > 0) {
    body = <CompareRegionChart key={queryIdentity} rows={rows} width={width} svgRef={svgRef} />;
  }

  return (
    // `min-w-0`: in a flex or grid parent, the chart's 450 px floor must not
    // widen the panel (and so its measured width); the chart scrolls instead.
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <SettingsBar
        key={queryIdentity}
        applied={applied}
        busy={result.isFetching}
        canExport={Boolean(rows?.length)}
        onApply={writeCompareRegionUrlState}
        onExport={() => {
          if (svgRef.current) {
            exportSvg(svgRef.current, `compare-regions-${patricId.replace(/[^\w.-]+/g, "_")}.svg`);
          }
        }}
      />
      <div ref={parentRef} className="min-h-0 flex-1 overflow-auto">
        {body}
      </div>
    </div>
  );
}
