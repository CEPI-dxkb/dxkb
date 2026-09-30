"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { keywordDebounceMs } from "@/components/filterbar/keyword-search";

/**
 * A text box's draft over a committed value that lives elsewhere (usually the
 * URL), committed after `delayMs` of no typing.
 *
 * Next applies History API writes to `useSearchParams` inside a transition, so
 * a text input bound straight to the URL snaps back to the old value on each
 * keystroke and drops fast typing. The box shows the draft instead.
 *
 * - The draft starts as `committed`, and mounting never commits.
 * - A `committed` value that changes from outside (Back/Forward, a link)
 *   replaces the draft, without committing it back.
 * - A `committed` value that is this hook's own write landing does not: the
 *   user may have typed on since, and that text must survive.
 *
 * `normalize` is what the committed value makes of a draft (the filter bar
 * trims its keyword). The hook commits the normalized draft and recognizes it
 * when it lands, so trailing whitespace neither reads as an outside change nor
 * triggers a second commit; the box keeps showing what was typed.
 *
 * `commit` runs through an effect event, so it always sees the latest props.
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
  // What this hook last committed, until a committed value lands.
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
