"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

import {
  KeywordSearch,
  keywordDebounceMs,
} from "@/components/filterbar/keyword-search";

interface GraphToolbarProps {
  filterValue: string;
  onFilterChange: (value: string) => void;
}

/**
 * The Graph's keyword box, holding a draft and committing on a timer.
 *
 * The keyword is a request predicate for the Graph *and* for the Table that
 * shares the value, so committing on every input event turned one search into
 * one graph request plus one collection request per character — a five-character
 * search issued ten, against the Data API gateway's per-IP rate limit. The
 * Table's own box (`ResourceFilterBar`) already debounces; this mirrors its
 * draft-and-commit shape and reuses `keywordDebounceMs`, so both boxes writing
 * the shared value settle identically.
 *
 * Debouncing lives here rather than in the shell because the Table's timer is
 * inside `ResourceFilterBar` and cannot be bypassed from above: a second timer
 * in the shell would stack on top of it and double the Table's search latency.
 */
export function GraphToolbar({
  filterValue,
  onFilterChange,
}: GraphToolbarProps) {
  const [draft, setDraft] = useState(filterValue);
  const draftRef = useRef(draft);
  const isDraftCommittedRef = useRef(true);
  // Adopt the shared value whenever it changes elsewhere — the Table's box — so
  // the input never shows a stale search. Our own commit landing is not adopted:
  // it is the draft trimmed, and taking it back would delete a trailing space the
  // user is about to type past.
  const [previousValue, setPreviousValue] = useState(filterValue);
  const [ownCommit, setOwnCommit] = useState<string | null>(null);
  if (previousValue !== filterValue) {
    setPreviousValue(filterValue);
    setOwnCommit(null);
    if (filterValue !== ownCommit) setDraft(filterValue);
  }

  const commitKeyword = useEffectEvent((value: string) => {
    const keyword = value.trim();
    setOwnCommit(keyword);
    onFilterChange(keyword);
  });

  // A draft that only adds whitespace to the shared value has nothing to commit.
  const nextKeyword = draft.trim();

  // Track the draft actually shown, not the shared value: when our own commit
  // lands after the user typed on, the kept draft still needs its unmount flush.
  useEffect(() => {
    draftRef.current = draft;
    isDraftCommittedRef.current = nextKeyword === filterValue;
  }, [draft, nextKeyword, filterValue]);

  useEffect(() => {
    if (nextKeyword === filterValue) return;
    const timeout = setTimeout(() => {
      isDraftCommittedRef.current = true;
      commitKeyword(nextKeyword);
    }, keywordDebounceMs);
    return () => {
      clearTimeout(timeout);
    };
  }, [nextKeyword, filterValue]);

  useEffect(() => {
    return () => {
      if (!isDraftCommittedRef.current) commitKeyword(draftRef.current);
    };
  }, []);

  return (
    <div className="mt-0 mb-2 flex flex-wrap items-center gap-2 p-1">
      <KeywordSearch
        value={draft}
        onChange={(value) => {
          draftRef.current = value;
          isDraftCommittedRef.current = false;
          setDraft(value);
        }}
        placeholder="Search interaction results..."
      />
    </div>
  );
}
