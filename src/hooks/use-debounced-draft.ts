"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { keywordDebounceMs } from "@/components/filterbar/keyword-search";

/**
 * A draft over a committed value that lives elsewhere (usually the URL), committed after `delayMs` of no typing.
 * A `committed` change from outside replaces the draft; this hook's own write landing does not, so text typed since survives.
 * `flushOnUnmount` commits a pending draft when the owner unmounts before the timer fires (a box in a tab that unmounts when hidden).
 */
export function useDebouncedDraft(
  committed: string,
  commit: (value: string) => void,
  {
    normalize = identity,
    delayMs = keywordDebounceMs,
    flushOnUnmount = false,
  }: {
    normalize?: (value: string) => string;
    delayMs?: number;
    flushOnUnmount?: boolean;
  } = {},
): readonly [string, (value: string) => void] {
  const [draft, setDraft] = useState(committed);
  const [previousCommitted, setPreviousCommitted] = useState(committed);
  const [ownCommit, setOwnCommit] = useState<string | null>(null);
  if (previousCommitted !== committed) {
    setPreviousCommitted(committed);
    setOwnCommit(null);
    if (committed !== ownCommit) setDraft(committed);
  }

  // The last value this hook committed, until `committed` next changes: a ref, so an unmount
  // straight after the timer fires (before `ownCommit` renders) still sees it.
  const sentRef = useRef<string | null>(null);
  const sentForRef = useRef(committed);
  const commitDraft = useEffectEvent((value: string) => {
    sentRef.current = value;
    setOwnCommit(value);
    commit(value);
  });

  // A string, so an inline `normalize` does not restart the timer every render.
  const nextCommit = normalize(draft);
  useEffect(() => {
    // Only a real change clears it: an effect replay (StrictMode, an Activity shown again) re-runs
    // this with the same `committed`, and what was sent before it must still count as sent.
    if (sentForRef.current === committed) return;
    sentForRef.current = committed;
    sentRef.current = null;
  }, [committed]);
  const flushPendingDraft = useEffectEvent(() => {
    if (!flushOnUnmount) return;
    // What the owner holds or is about to: a draft back at `committed` while another write is
    // still in flight is a revert, and has to supersede that write.
    if (nextCommit === (sentRef.current ?? committed)) return;
    sentRef.current = nextCommit;
    commit(nextCommit);
  });
  useEffect(
    () => () => {
      flushPendingDraft();
    },
    [],
  );
  useEffect(() => {
    if (nextCommit === committed) return;
    const timeout = setTimeout(() => {
      commitDraft(nextCommit);
    }, delayMs);
    return () => {
      clearTimeout(timeout);
    };
  }, [committed, delayMs, nextCommit]);

  return [draft, setDraft];
}

function identity(value: string): string {
  return value;
}
