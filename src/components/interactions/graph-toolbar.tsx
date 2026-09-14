"use client";

import { useEffect, useEffectEvent, useState } from "react";

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
  // Adopt the shared value whenever it changes elsewhere — the Table's box, or a
  // commit of our own — so the input never shows a stale search.
  const [previousValue, setPreviousValue] = useState(filterValue);
  if (previousValue !== filterValue) {
    setPreviousValue(filterValue);
    setDraft(filterValue);
  }

  const commitKeyword = useEffectEvent((value: string) => {
    onFilterChange(value.trim());
  });

  useEffect(() => {
    if (draft === filterValue) return;
    const timeout = setTimeout(() => {
      commitKeyword(draft);
    }, keywordDebounceMs);
    return () => {
      clearTimeout(timeout);
    };
  }, [draft, filterValue]);

  return (
    <div className="mt-0 mb-2 flex flex-wrap items-center gap-2 p-1">
      <KeywordSearch
        value={draft}
        onChange={setDraft}
        placeholder="Search interaction results..."
      />
    </div>
  );
}
