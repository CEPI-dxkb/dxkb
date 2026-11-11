import { useState } from "react";

interface Highlight {
  idx: number;
  locked: boolean;
}

export interface StackedChartHighlight {
  activeIdx: number | null;
  isLocked: boolean;
  pressedFor: (idx: number) => boolean;
  activatePill: (idx: number) => void;
  deactivatePill: () => void;
  togglePillLock: (idx: number) => void;
  clearHighlight: () => void;
}

/**
 * Legend highlight state: inactive, hovered, or locked by click. Hover handlers
 * are gated on the lock; `togglePillLock` ignores the gate so a locked pill can
 * be swapped directly.
 */
export function useStackedChartHighlight(): StackedChartHighlight {
  const [highlight, setHighlight] = useState<Highlight | null>(null);

  return {
    activeIdx: highlight?.idx ?? null,
    isLocked: highlight?.locked === true,
    pressedFor: (idx) => highlight?.locked === true && highlight.idx === idx,
    activatePill: (idx) => {
      if (highlight?.locked) return;
      setHighlight({ idx, locked: false });
    },
    deactivatePill: () => {
      if (highlight?.locked) return;
      setHighlight(null);
    },
    togglePillLock: (idx) => {
      setHighlight((prev) =>
        prev?.locked && prev.idx === idx ? null : { idx, locked: true },
      );
    },
    clearHighlight: () => { setHighlight(null); },
  };
}
