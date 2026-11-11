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
 * Debounces here, not in the shell, because the Table's own timer is inside `ResourceFilterBar` and
 * a second one would double its latency.
 */
export function GraphToolbar({
  filterValue,
  onFilterChange,
}: GraphToolbarProps) {
  const [draft, setDraft] = useState(filterValue);
  const draftRef = useRef(draft);
  const isDraftCommittedRef = useRef(true);
  // Adopt the shared value when it changes elsewhere, but not our own commit: it is the draft
  // trimmed, and taking it back would delete a trailing space being typed.
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

  const nextKeyword = draft.trim();

  // Track the draft shown, not the shared value: if our commit lands after the user typed on, the
  // kept draft still needs its unmount flush.
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
