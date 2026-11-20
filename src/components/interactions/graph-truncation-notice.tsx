"use client";

import { useId } from "react";
import { TriangleAlert } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTrigger,
} from "@/components/ui/popover";

/** `total` is passed only when it is known to be past `limit` (the Graph's `totalShown`). */
export function graphTruncationTitle(limit: number, total?: number): string {
  return total === undefined
    ? `Showing the first ${limit.toLocaleString()} interactions`
    : `Showing the first ${limit.toLocaleString()} of ${total.toLocaleString()} interactions`;
}

export const graphTruncationReason =
  "The graph can't draw them all. Narrow with search or Filters, or use the Table to see every interaction.";

interface GraphTruncationNoticeProps {
  limit: number;
  total?: number;
}

/**
 * One line over the top-left of the canvas, as the circular viewer's notice: the title, and a
 * "Why?" popover with the reason. A polite status, since a capped result is not an error. Its
 * container lets pointer events through to the canvas; only the trigger takes them back.
 *
 * It has no background of its own, so the red must clear 4.5:1 on the canvas fill: the dark
 * themes take `destructive-inverse` because plain `destructive` is 2.9:1 on bvbrc-dark
 * (`src/__tests__/graph-notice-contrast.test.ts` holds the pairs and notes the light-theme ones
 * left out). The trigger keeps a 24px hit area (WCAG 2.5.8) though its text is 11px.
 */
export function GraphTruncationNotice({
  limit,
  total,
}: GraphTruncationNoticeProps) {
  const titleId = useId();
  return (
    <div
      role="status"
      className="flex items-center gap-1 self-start px-1 text-2xs text-destructive dark:text-destructive-inverse"
    >
      <TriangleAlert aria-hidden="true" className="size-3 shrink-0" />
      <span id={titleId}>{graphTruncationTitle(limit, total)}</span>
      <span aria-hidden="true">·</span>
      <Popover>
        <PopoverTrigger
          render={
            <button
              type="button"
              aria-label="Why is the graph limited?"
              className="pointer-events-auto inline-flex min-h-6 min-w-6 items-center justify-center rounded-sm underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
          }
        >
          Why?
        </PopoverTrigger>
        {/* Named by the title beside the trigger, which the popover does not repeat. */}
        <PopoverContent align="start" aria-labelledby={titleId}>
          <PopoverDescription>{graphTruncationReason}</PopoverDescription>
        </PopoverContent>
      </Popover>
    </div>
  );
}
