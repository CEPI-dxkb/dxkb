/**
 * Keeping the reader's place in the Compare Region Viewer's figure across a
 * density switch, which changes every row's height: the scroll position is
 * saved in rows rather than pixels, then turned back into a `scrollTop` in
 * the new frame.
 */
import { rulerHeight } from "./density";
import type { FigureFrame } from "./figure-frame";

/** Where the figure's scroller stood before a switch, in rows rather than pixels. */
export interface ScrollPlace {
  /** The pinned row, else the row at the top of the view (under the sticky ruler). */
  rowIndex: number;
  pinned: boolean;
  /** Pinned: the row's center, from the scroller's top. Else: how far into its slot the view's top edge was (0–1). */
  offset: number;
  left: number;
}

/**
 * The place `position` (the scroller, or null before it mounts) shows in
 * `frame`: the pinned row when there is one in the frame, else the row under
 * the ruler.
 */
export function scrollPlace(
  position: Pick<HTMLElement, "scrollTop" | "scrollLeft"> | null,
  frame: FigureFrame,
  pinnedRow: number | null,
): ScrollPlace {
  const top = position?.scrollTop ?? 0;
  const left = position?.scrollLeft ?? 0;
  const pinned = pinnedRow === null ? undefined : frame.rows.at(pinnedRow);
  if (pinnedRow !== null && pinned) {
    return {
      rowIndex: pinnedRow,
      pinned: true,
      offset: pinned.center - top,
      left,
    };
  }
  const edge = top + rulerHeight;
  const rowIndex = Math.max(
    0,
    frame.rows.findIndex((row) => row.slotBottom > edge),
  );
  const row = frame.rows.at(rowIndex);
  const offset = row
    ? Math.min(
        1,
        Math.max(0, (edge - row.slotTop) / (row.slotBottom - row.slotTop)),
      )
    : 0;
  return { rowIndex, pinned: false, offset, left };
}

/**
 * The scrollTop that puts `place`'s row back where it was in the new frame:
 * the top row at the same depth under the ruler, or the pinned row at the
 * same height on screen, nudged fully into view if it was not. Never above
 * the top.
 */
export function scrollTopFor(
  place: ScrollPlace,
  frame: FigureFrame,
  viewHeight: number,
): number {
  const row = frame.rows.at(place.rowIndex);
  if (!row) return 0;
  if (!place.pinned) {
    return Math.max(
      0,
      row.slotTop + place.offset * (row.slotBottom - row.slotTop) - rulerHeight,
    );
  }
  const top = row.center - place.offset;
  // In view: the slot's top under the ruler, its bottom above the view's bottom.
  const maxTop = row.slotTop - rulerHeight;
  const minTop = row.slotBottom - viewHeight;
  return Math.max(
    0,
    minTop > maxTop ? maxTop : Math.min(maxTop, Math.max(minTop, top)),
  );
}
