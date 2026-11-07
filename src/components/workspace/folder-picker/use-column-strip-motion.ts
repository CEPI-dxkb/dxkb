import { useLayoutEffect, useRef, type RefObject } from "react";
import type { PickerView } from "@/lib/services/workspace/picker-views";
import {
  captureColumns,
  playColumnTransition,
  type ColumnsSnapshot,
} from "./folder-picker-motion";

interface ColumnStripMotionInput {
  /** The scrolling strip, owned by the dialog (its initial focus reads it). */
  stripRef: RefObject<HTMLDivElement | null>;
  place: PickerView;
  /** Index of the newest column: the number of selected folders. */
  lastIndex: number;
  currentIndex: number;
  /** The deepest selected folder; a change means a new column opened. */
  lastPath: string;
}

/**
 * Column open/close motion for the strip: the content and overlay refs to
 * attach, and `prepareTransition`, which every navigation calls first to
 * snapshot the strip as it is on screen.
 */
export function useColumnStripMotion({
  stripRef,
  place,
  lastIndex,
  currentIndex,
  lastPath,
}: ColumnStripMotionInput) {
  const contentRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const snapshotRef = useRef<ColumnsSnapshot | null>(null);

  /** Record the strip as it is on screen; every navigation calls this first. */
  const prepareTransition = () => {
    const strip = stripRef.current;
    const overlay = overlayRef.current;
    snapshotRef.current =
      strip && overlay
        ? captureColumns({ strip, overlay, place, depth: lastIndex })
        : null;
  };

  // Keep the newest column fully in view, without scrolling the column that
  // holds the selection off the left edge, then animate from the snapshot.
  // A layout effect, so the new layout never paints before its animation.
  useLayoutEffect(() => {
    const strip = stripRef.current;
    const content = contentRef.current;
    const overlay = overlayRef.current;
    const snapshot = snapshotRef.current;
    snapshotRef.current = null;
    if (!strip || !content || !overlay) return;
    const column = (index: number) =>
      strip.querySelector<HTMLElement>(
        `[data-picker-column="${String(index)}"]`,
      );
    const last = column(lastIndex);
    const anchor = column(Math.max(currentIndex, 0));
    if (!last) return;
    const revealLast = last.offsetLeft + last.offsetWidth - strip.clientWidth;
    const left = Math.max(
      0,
      Math.min(revealLast, anchor?.offsetLeft ?? revealLast),
    );
    playColumnTransition({
      strip,
      content,
      overlay,
      snapshot,
      scrollLeft: left,
      place,
      depth: lastIndex,
    });
  }, [stripRef, place, lastPath, lastIndex, currentIndex]);

  return { contentRef, overlayRef, prepareTransition };
}
