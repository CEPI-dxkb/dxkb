"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  downloadFileNameBase,
  downloadFormats,
  downloadUnavailableReason,
  unselectableColumnsReason,
  type DownloadFormatId,
  type DownloadRequest,
  type DownloadScope,
  type ResolvedCollectionDownloadSpec,
} from "@/lib/data-api/downloads";
import type { DataSort } from "@/lib/data-api/types";
import { FileTypeTag } from "./file-type-tag";

type ScopeChoice = "selected" | "all";

export interface CollectionDownloadProps {
  label: string;
  spec: ResolvedCollectionDownloadSpec;
  selection: {
    count: number;
    ids: readonly string[];
    isAllPagesSelected: boolean;
  };
  allResults: { scope: DownloadScope; total: number };
  sort?: DataSort;
  /**
   * The total is a previous query's placeholder (or absent), so *All results*
   * waits for its count.
   */
  isPlaceholderData: boolean;
  visibleColumnIds: readonly string[];
  fileNameBase: string;
  queryLabel?: string;
  pending: DownloadFormatId | null;
  onDownload: (
    request: DownloadRequest,
    options: { onSuccess: () => void },
  ) => void;
}

const compactCount = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const doneMs = 1_800;

const countingReason = "Counting matching rows…";

/**
 * The action rail's Download tile. Popover state lives here and the running
 * download in the shell's `useCollectionDownload`, so a remounted tile keeps
 * its spinner.
 */
export function CollectionDownloadAction({
  label,
  spec,
  selection,
  allResults,
  sort,
  isPlaceholderData,
  visibleColumnIds,
  fileNameBase,
  queryLabel,
  pending,
  onDownload,
}: CollectionDownloadProps) {
  const switchId = useId();
  const headingId = useId();
  const columnsReasonId = useId();
  const [scopeChoice, setScopeChoice] = useState<ScopeChoice | null>(null);
  const [visibleColumnsOnly, setVisibleColumnsOnly] = useState(false);
  const [done, setDone] = useState<DownloadFormatId | null>(null);
  const doneTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return () => {
      clearTimeout(doneTimeoutRef.current);
    };
  }, []);

  const hasSelection = selection.count > 0;
  const scope: ScopeChoice =
    scopeChoice === "selected" && !hasSelection
      ? "all"
      : (scopeChoice ?? (hasSelection ? "selected" : "all"));
  const isQueryBacked = scope === "all" || selection.isAllPagesSelected;
  const requestScope: DownloadScope = isQueryBacked
    ? allResults.scope
    : { kind: "selected", ids: [...selection.ids] };
  const rows = isQueryBacked ? allResults.total : selection.ids.length;
  const scopeReason = isQueryBacked && isPlaceholderData ? countingReason : null;
  const columnsReason = unselectableColumnsReason(visibleColumnIds);
  const sendVisibleColumns = visibleColumnsOnly && columnsReason === null;

  const reasonFor = (format: DownloadFormatId): string | null => {
    if (scopeReason) return scopeReason;
    if (rows === 0)
      return scope === "selected" ? "Select rows first" : "No matching rows";
    return downloadUnavailableReason({
      format,
      scope: requestScope.kind === "selected" ? "selected" : "all",
      rows,
    });
  };

  const start = (format: DownloadFormatId) => {
    setDone(null);
    onDownload(
      {
        format,
        scope: requestScope,
        sort,
        fields:
          downloadFormats[format].kind === "table" && sendVisibleColumns
            ? [...visibleColumnIds]
            : undefined,
        fileNameBase: downloadFileNameBase(fileNameBase, scope),
        total: rows,
      },
      {
        onSuccess: () => {
          setDone(format);
          clearTimeout(doneTimeoutRef.current);
          doneTimeoutRef.current = setTimeout(() => {
            setDone(null);
          }, doneMs);
        },
      },
    );
  };

  const formatRow = (format: DownloadFormatId) => {
    const meta = downloadFormats[format];
    const reason = reasonFor(format);
    const title =
      reason ??
      (meta.kind === "sequence" && spec.sequenceNote
        ? `${meta.description}. ${spec.sequenceNote}.`
        : meta.description);
    return (
      <Button
        key={format}
        variant="ghost"
        size="option-sm"
        className="justify-start"
        title={title}
        disabled={reason !== null || pending !== null}
        onClick={() => {
          start(format);
        }}
      >
        <FileTypeTag format={format} />
        <span className="flex-1 truncate text-sm">{meta.label}</span>
        {reason ? (
          <span className="truncate text-3xs text-muted-foreground">
            {reason}
          </span>
        ) : null}
        {pending === format ? (
          <Spinner className="size-3.5" />
        ) : done === format ? (
          <Check className="size-3.5 text-success animate-in zoom-in-50" />
        ) : (
          <Download className="size-3.5 text-primary opacity-0 transition-opacity group-hover/button:opacity-100 group-focus-visible/button:opacity-100 dark:text-link" />
        )}
      </Button>
    );
  };

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="secondary"
            size="tile"
            className="relative w-full max-md:w-16 max-md:shrink-0"
          />
        }
      >
        {pending ? (
          <Spinner className="size-4 shrink-0" />
        ) : (
          <Download className="size-4 shrink-0" />
        )}
        <span className="text-[9px] leading-tight font-medium">DOWNLOAD</span>
        {hasSelection ? (
          <span className="absolute -top-1.5 -right-1.5 min-w-5 rounded-full bg-primary px-1 py-0.5 text-3xs leading-none font-bold text-primary-foreground tabular-nums shadow-sm ring-2 ring-muted">
            {selection.count > 999 ? "999+" : String(selection.count)}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent
        side="left"
        align="start"
        size="flush"
        className="w-72"
        aria-labelledby={headingId}
      >
        <p id={headingId} className="truncate px-3 py-2.5 text-sm font-semibold">
          <span className="text-muted-foreground">Download</span> {label}
        </p>

        <div className="px-3 pb-2.5">
          <RadioGroup
            value={scope}
            onValueChange={(value: ScopeChoice) => {
              setScopeChoice(value);
            }}
            aria-label="Rows to download"
            className="grid-cols-2"
          >
            <label
              className="flex cursor-pointer items-center gap-2 text-sm has-data-disabled:cursor-not-allowed has-data-disabled:opacity-60"
              title={hasSelection ? undefined : "Select rows in the table first"}
            >
              <RadioGroupItem value="selected" disabled={!hasSelection} />
              Selected
              <span className="font-semibold tabular-nums">
                {compactCount.format(selection.count)}
              </span>
            </label>
            <label
              className="flex cursor-pointer items-center gap-2 text-sm has-data-disabled:cursor-not-allowed has-data-disabled:opacity-60"
              title={isPlaceholderData ? countingReason : undefined}
            >
              <RadioGroupItem value="all" disabled={isPlaceholderData} />
              All
              <span className="font-semibold tabular-nums">
                {isPlaceholderData ? "…" : compactCount.format(allResults.total)}
              </span>
            </label>
          </RadioGroup>
        </div>

        <div className="flex flex-col border-t p-1.5">
          {spec.tableFormats.map(formatRow)}
          {spec.sequenceFormats.length > 0 ? (
            <>
              <div role="separator" className="mx-2 my-1 border-t" />
              {spec.sequenceFormats.map(formatRow)}
            </>
          ) : null}
        </div>

        <div className="rounded-b-lg border-t bg-muted/50 px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Switch
                id={switchId}
                size="sm"
                checked={sendVisibleColumns}
                disabled={columnsReason !== null}
                aria-describedby={columnsReason ? columnsReasonId : undefined}
                onCheckedChange={setVisibleColumnsOnly}
              />
              <Label
                htmlFor={switchId}
                title="Table formats only: sequence files have no columns"
              >
                Visible columns
              </Label>
            </div>
            {queryLabel ? (
              <span className="truncate font-mono text-3xs text-muted-foreground">
                {queryLabel}
              </span>
            ) : null}
          </div>
          {columnsReason ? (
            <p
              id={columnsReasonId}
              className="mt-1.5 text-3xs text-muted-foreground"
            >
              {columnsReason}, so table files hold every field.
            </p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
