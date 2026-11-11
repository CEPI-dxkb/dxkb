"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { keywordDebounceMs } from "@/components/filterbar/keyword-search";

/**
 * A draft over a committed value that lives elsewhere (usually the URL), committed after `delayMs` of no typing.
 * A `committed` change from outside replaces the draft; this hook's own write landing does not, so text typed since survives.
 */
export function useDebouncedDraft(
  committed: string,
  commit: (value: string) => void,
  {
    normalize = identity,
    delayMs = keywordDebounceMs,
  }: {
    normalize?: (value: string) => string;
    delayMs?: number;
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

  const commitDraft = useEffectEvent((value: string) => {
    setOwnCommit(value);
    commit(value);
  });

  // A string, so an inline `normalize` does not restart the timer every render.
  const nextCommit = normalize(draft);
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
