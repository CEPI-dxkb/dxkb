"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import { useHotkeys } from "@tanstack/react-hotkeys";
import {
  fetchGenomeSuggestions,
  type GenomeSummary,
} from "@/lib/services/genome";

export function shouldSearch(query: string, minLength: number): boolean {
  const trimmed = query.trim();
  if (!trimmed) return false;
  if (/^[0-9]+(\.[0-9]+)?$/.test(trimmed)) return trimmed.length >= 2;
  return trimmed.length >= minLength;
}

interface UseGenomeTypeaheadOptions {
  minQueryLength?: number;
  disabled?: boolean;
  /** Return true to skip the debounced fetch for this query + selected-item combination. */
  skipFetch?: (query: string, selected: GenomeSummary | null) => boolean;
  /** Additional refs (e.g. toggle buttons) whose clicks should NOT close the dropdown. */
  additionalClickOutsideRefs?: RefObject<Element | null>[];
  /** Called when the user clicks outside all tracked refs. */
  onClickOutside?: () => void;
}

export interface UseGenomeTypeaheadReturn {
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
  suggestions: GenomeSummary[];
  isLoading: boolean;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  error: string | null;
  showDropdown: boolean;
  setShowDropdown: Dispatch<SetStateAction<boolean>>;
  selectedItem: GenomeSummary | null;
  setSelectedItem: Dispatch<SetStateAction<GenomeSummary | null>>;
  highlightedIndex: number;
  setHighlightedIndex: Dispatch<SetStateAction<number>>;
  inputRef: RefObject<HTMLInputElement | null>;
  dropdownRef: RefObject<HTMLDivElement | null>;
  itemRefs: RefObject<(HTMLButtonElement | null)[]>;
  latestAbortController: RefObject<AbortController | null>;
  /** Set suggestions + reset itemRefs + highlightedIndex atomically. */
  updateSuggestions: (next: GenomeSummary[]) => void;
  /** Fire a fetch immediately (no debounce), bypassing shouldSearch. */
  triggerSearch: (overrideQuery: string) => void;
}

export function useGenomeTypeahead({
  minQueryLength = 0,
  disabled = false,
  skipFetch,
  additionalClickOutsideRefs = [],
  onClickOutside,
}: UseGenomeTypeaheadOptions): UseGenomeTypeaheadReturn {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GenomeSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedItem, setSelectedItem] = useState<GenomeSummary | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const latestAbortController = useRef<AbortController | null>(null);
  const onClickOutsideRef = useRef(onClickOutside);
  const additionalRefsRef = useRef(additionalClickOutsideRefs);
  const skipCurrentFetch = skipFetch?.(query, selectedItem) ?? false;
  useLayoutEffect(() => {
    onClickOutsideRef.current = onClickOutside;
    additionalRefsRef.current = additionalClickOutsideRefs;
  });

  const updateSuggestions = (next: GenomeSummary[]) => {
    itemRefs.current = [];
    setSuggestions(next);
    setHighlightedIndex(-1);
  };

  // Debounced fetch. Whichever request started last (this run or a
  // `triggerSearch`) owns the results and loading state: starting one aborts
  // the one before, and an aborted request never writes either.
  useEffect(() => {
    latestAbortController.current?.abort();
    const controller = new AbortController();
    latestAbortController.current = controller;
    const shouldReset =
      !skipCurrentFetch && (!shouldSearch(query, minQueryLength) || disabled);

    const timeoutId = window.setTimeout(
      () => {
        // `triggerSearch` aborts this controller to take over. Running anyway
        // would set loading for a fetch that can never clear it.
        if (controller.signal.aborted) return;
        // The query is the picked item's name: keep its suggestions, but a
        // search this run superseded can no longer clear the loading state.
        if (skipCurrentFetch) {
          setIsLoading(false);
          return;
        }
        if (shouldReset) {
          itemRefs.current = [];
          setSuggestions([]);
          setHighlightedIndex(-1);
          setError(null);
          setIsLoading(false);
          return;
        }

        setIsLoading(true);
        setError(null);

        fetchGenomeSuggestions(query, { signal: controller.signal })
          .then((results) => {
            if (!controller.signal.aborted) {
              itemRefs.current = [];
              setSuggestions(results);
              setHighlightedIndex(-1);
            }
          })
          .catch((fetchError: unknown) => {
            if (controller.signal.aborted) return;
            const message =
              fetchError instanceof Error
                ? fetchError.message
                : "Failed to search genomes";
            setError(message);
            itemRefs.current = [];
            setSuggestions([]);
            setHighlightedIndex(-1);
          })
          .finally(() => {
            if (!controller.signal.aborted) setIsLoading(false);
          });
      },
      skipCurrentFetch || shouldReset ? 0 : 250,
    );

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [query, minQueryLength, disabled, selectedItem, skipCurrentFetch]);

  // Click-outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInsideDropdown = dropdownRef.current?.contains(target) ?? false;
      const isInsideInput = inputRef.current?.contains(target) ?? false;
      const isInsideExtra = additionalRefsRef.current.some(
        (ref) => ref.current?.contains(target) ?? false,
      );
      if (!isInsideDropdown && !isInsideInput && !isInsideExtra) {
        setShowDropdown(false);
        setHighlightedIndex(-1);
        onClickOutsideRef.current?.();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && itemRefs.current[highlightedIndex]) {
      itemRefs.current[highlightedIndex]?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [highlightedIndex]);

  useHotkeys(
    [
      {
        hotkey: "ArrowDown",
        callback: () => {
          setHighlightedIndex((prev) =>
            prev < suggestions.length - 1 ? prev + 1 : prev,
          );
          setShowDropdown(true);
        },
      },
      {
        hotkey: "ArrowUp",
        callback: () => {
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
          setShowDropdown(true);
        },
      },
      {
        hotkey: "Escape",
        callback: () => {
          setShowDropdown(false);
          setHighlightedIndex(-1);
        },
      },
    ],
    {
      target: inputRef,
      ignoreInputs: false,
      conflictBehavior: "allow",
      preventDefault: true,
    },
  );

  const triggerSearch = (overrideQuery: string) => {
    latestAbortController.current?.abort();
    const controller = new AbortController();
    latestAbortController.current = controller;
    setIsLoading(true);
    setError(null);

    fetchGenomeSuggestions(overrideQuery, { signal: controller.signal })
      .then((results) => {
        if (!controller.signal.aborted) {
          itemRefs.current = [];
          setSuggestions(results);
          setHighlightedIndex(-1);
        }
      })
      .catch((fetchError: unknown) => {
        if (controller.signal.aborted) return;
        const message =
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to search genomes";
        setError(message);
        itemRefs.current = [];
        setSuggestions([]);
        setHighlightedIndex(-1);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
  };

  return {
    query,
    setQuery,
    suggestions,
    isLoading,
    setIsLoading,
    error,
    showDropdown,
    setShowDropdown,
    selectedItem,
    setSelectedItem,
    highlightedIndex,
    setHighlightedIndex,
    inputRef,
    dropdownRef,
    itemRefs,
    latestAbortController,
    updateSuggestions,
    triggerSearch,
  };
}
