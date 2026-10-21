"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { ChevronDown, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { FacetValueList, RefreshHairline } from "./facet-value-list";
import {
  describeFilter,
  displayFacetValue,
  type FacetValueOption,
} from "./facet-values";
import type { FacetStatus } from "./types";

/** One facet as the toolbar's pills and menus show it. */
export interface FacetView {
  field: string;
  label: string;
  values: readonly string[];
  status: FacetStatus;
  /** No facet names the field (a filter from the link), so nothing counts it. */
  notCounted: boolean;
  options: FacetValueOption[];
}

/** Gap between pills, in px; matches `gap-1.5` on the track. */
const pillGap = 6;
/** Narrowest a pill may be squeezed to (its value truncated), in px. */
const minSqueezedPill = 112;

/** The pill's look at its natural width, for measuring. */
export function PillFace({ label, values }: Pick<FacetView, "label" | "values">) {
  if (values.length === 0) {
    return (
      <span className="inline-flex h-8 items-center gap-1 rounded-md border border-dashed border-input bg-background pr-1.5 pl-2 text-xs whitespace-nowrap text-muted-foreground">
        {label}
        <ChevronDown aria-hidden="true" className="size-3 opacity-60" />
      </span>
    );
  }
  return (
    <span className="inline-flex h-8 max-w-80 items-stretch rounded-md border border-input bg-background text-xs shadow-xs">
      <span className="flex min-w-0 items-center gap-1 pr-1.5 pl-2">
        <span className="whitespace-nowrap text-muted-foreground">{label}</span>
        <span className="max-w-36 truncate font-medium whitespace-nowrap text-foreground">
          {displayFacetValue(values[0])}
        </span>
        {values.length > 1 && (
          <span className="text-2xs font-semibold text-primary tabular-nums dark:text-foreground">
            +{values.length - 1}
          </span>
        )}
      </span>
      <span className="w-7 shrink-0 border-l border-border" />
    </span>
  );
}

/** "+N": the filters that did not fit on the row. */
export function MorePillFace({ count }: { count: number }) {
  return (
    <span className="inline-flex h-8 items-center gap-0.5 rounded-md border border-input bg-background px-2.5 text-xs font-medium whitespace-nowrap text-foreground tabular-nums shadow-xs hover:bg-foreground/5">
      +{count}
    </span>
  );
}

/**
 * An applied filter on the row: "Genome Status: Complete +1", which opens the
 * facet's checklist, and an × that clears the field. The pill whose popover is
 * open stays on the row (as a dashed pill) even after its last value is
 * unticked, so the popover keeps its anchor.
 */
export function ActiveFilterPill({
  view,
  refreshing,
  error,
  unavailable,
  onToggle,
  onClear,
  onOpenChange,
}: {
  view: FacetView;
  refreshing: boolean;
  error?: string;
  unavailable: boolean;
  onToggle: (value: string) => void;
  onClear: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { label, values } = view;
  const active = values.length > 0;
  const description = describeFilter(label, values);

  const trigger = active ? (
    <button
      type="button"
      aria-label={`${description}. Edit filter`}
      title={description}
      className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden rounded-l-md pr-1.5 pl-2 outline-none hover:bg-foreground/5 focus-visible:bg-foreground/5 aria-expanded:bg-foreground/5"
    />
  ) : (
    <button
      type="button"
      aria-label={`Filter by ${label}`}
      className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-dashed border-input bg-background pr-1.5 pl-2 text-xs whitespace-nowrap text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
    />
  );

  const face: ReactNode = active ? (
    <>
      <span className="min-w-0 shrink-2 truncate whitespace-nowrap text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "max-w-36 min-w-6 truncate font-medium whitespace-nowrap text-foreground",
          values[0] === "" && "italic",
        )}
      >
        {displayFacetValue(values[0])}
      </span>
      {values.length > 1 && (
        <span className="shrink-0 text-2xs font-semibold text-primary tabular-nums dark:text-foreground">
          +{values.length - 1}
        </span>
      )}
    </>
  ) : (
    <>
      <span>{label}</span>
      <ChevronDown aria-hidden="true" className="size-3 opacity-60" />
    </>
  );

  // One wrapper in both states, so the popover stays mounted (and open) when
  // the last value is unticked.
  return (
    <div
      className={cn(
        "inline-flex",
        // An active pill may shrink (its value truncates) when it is the only
        // one that fits; a held empty pill keeps its width.
        active
          ? "h-8 max-w-80 min-w-0 shrink items-stretch rounded-md border border-input bg-background text-xs shadow-xs has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
          : "shrink-0",
      )}
    >
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          onOpenChange(next);
        }}
      >
        <PopoverTrigger render={trigger}>{face}</PopoverTrigger>
        <PopoverContent
          align="start"
          size="flush"
          variant="raised"
          className="w-80 overflow-hidden"
          initialFocus={inputRef}
        >
          <div className="relative flex flex-col">
            <RefreshHairline active={refreshing} />
            <FacetValueList
              key={view.field}
              label={label}
              options={view.options}
              status={view.status}
              isSelected={(value) => values.includes(value)}
              selectedCount={values.length}
              onToggle={onToggle}
              onClear={onClear}
              error={error}
              unavailable={unavailable}
              notCounted={view.notCounted}
              inputRef={inputRef}
            />
          </div>
        </PopoverContent>
      </Popover>
      {active && (
        <button
          type="button"
          aria-label={`Clear ${label} filter`}
          onClick={onClear}
          className="flex w-7 shrink-0 items-center justify-center rounded-r-md border-l border-border text-muted-foreground outline-none hover:bg-foreground/5 hover:text-foreground focus-visible:bg-foreground/5 focus-visible:text-foreground"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}

/**
 * Which pills go behind "+N", from a hidden row of every pill at its natural
 * width (`data-measure-field`, with `data-measure-held` on the one whose
 * popover is open, which always stays). Recomputed when the track resizes or
 * a pill changes. When nothing else fits, the first pill still shows with its
 * value truncated, rather than a bare "+N".
 */
export function usePillOverflow(
  trackRef: RefObject<HTMLDivElement | null>,
  measureRef: RefObject<HTMLDivElement | null>,
) {
  const [overflowKey, setOverflowKey] = useState<string | null>(null);

  useEffect(() => {
    const track = trackRef.current;
    const measure = measureRef.current;
    if (!track || !measure) return;
    const compute = () => {
      const items = Array.from(
        measure.querySelectorAll<HTMLElement>("[data-measure-field]"),
      ).map((element) => ({
        field: element.dataset.measureField ?? "",
        held: element.dataset.measureHeld !== undefined,
        width: element.offsetWidth,
      }));
      const moreWidth =
        measure.querySelector<HTMLElement>("[data-measure-more]")
          ?.offsetWidth ?? 0;
      // px-1 (room for the focus ring) plus the divider and its margin.
      const available = track.clientWidth - 17;
      const total = items.reduce(
        (sum, item, index) => sum + item.width + (index > 0 ? pillGap : 0),
        0,
      );
      const hidden: string[] = [];
      if (total > available) {
        let used = moreWidth;
        for (const item of items) {
          if (item.held) used += item.width + pillGap;
        }
        let full = false;
        let shown = 0;
        for (const item of items) {
          if (item.held) continue;
          const fits = used + item.width + pillGap <= available;
          const squeezed =
            shown === 0 && used + minSqueezedPill + pillGap <= available;
          if (!full && (fits || squeezed)) {
            used += Math.min(item.width, available - used - pillGap) + pillGap;
            shown += 1;
            if (!fits) full = true;
          } else {
            full = true;
            hidden.push(item.field);
          }
        }
      }
      setOverflowKey(hidden.join("\u0000"));
    };
    const resize = new ResizeObserver(compute);
    resize.observe(track);
    const mutation = new MutationObserver(compute);
    mutation.observe(measure, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    });
    compute();
    return () => {
      resize.disconnect();
      mutation.disconnect();
    };
  }, [trackRef, measureRef]);

  return {
    overflow: new Set(overflowKey ? overflowKey.split("\u0000") : []),
    measured: overflowKey !== null,
  };
}
