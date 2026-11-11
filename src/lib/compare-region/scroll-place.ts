import { rulerHeight } from "./density";
import type { FigureFrame } from "./figure-frame";

export interface ScrollPlace {
  rowIndex: number;
  pinned: boolean;
  offset: number;
  left: number;
}

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
  const maxTop = row.slotTop - rulerHeight;
  const minTop = row.slotBottom - viewHeight;
  return Math.max(
    0,
    minTop > maxTop ? maxTop : Math.min(maxTop, Math.max(minTop, top)),
  );
}
