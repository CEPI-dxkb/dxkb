"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useHotkey } from "@tanstack/react-hotkeys";
import { Search, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AnchoredSuggestionPortal } from "@/components/services/anchored-suggestion-portal";
import { GenomeSuggestionList } from "@/components/services/genome-suggestion-list";
import { cn } from "@/lib/utils";
import { fetchGenomesByIds, type GenomeSummary } from "@/lib/services/genome";
import { toast } from "sonner";
import {
  useGenomeTypeahead,
  shouldSearch,
} from "@/hooks/services/use-genome-typeahead";

interface SingleGenomeSelectorProps {
  id?: string;
  title?: string;
  placeholder?: string;
  helperText?: string;
  value: string;
  onChange: (genomeId: string) => void;
  disabled?: boolean;
  className?: string;
  minQueryLength?: number;
}

// Genome IDs match numeric patterns like "123.45"
function isGenomeId(str: string): boolean {
  return /^[0-9]+(\.[0-9]+)?$/.test(str.trim());
}

function useSingleGenomeSelector({
  id,
  title,
  placeholder = "e.g. Mycobacterium tuberculosis H37Rv",
  helperText,
  value,
  onChange,
  disabled = false,
  className,
  minQueryLength = 0,
}: SingleGenomeSelectorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [isManualTrigger, setIsManualTrigger] = useState(false);
  const selectedGenomeIdRef = useRef<string | null>(null);

  const {
    query,
    setQuery,
    suggestions,
    isLoading,
    setIsLoading,
    error,
    showDropdown,
    setShowDropdown,
    selectedItem: selectedGenome,
    setSelectedItem: setSelectedGenome,
    highlightedIndex,
    setHighlightedIndex,
    inputRef,
    dropdownRef,
    itemRefs,
    updateSuggestions,
    triggerSearch,
  } = useGenomeTypeahead({
    minQueryLength,
    disabled,
    skipFetch: (q, sel) => sel !== null && q.trim() === sel.genome_name,
    additionalClickOutsideRefs: [buttonRef, containerRef],
    onClickOutside: () => {
      setIsManualTrigger(false);
    },
  });

  // Sync query with value prop; resolve genome ID -> name via fetchGenomesByIds.
  const syncValue = useEffectEvent((nextValue: string) => {
    if (!nextValue) {
      if (query) {
        queueMicrotask(() => {
          setQuery("");
          setSelectedGenome(null);
        });
        selectedGenomeIdRef.current = null;
      }
      return;
    }

    if (isGenomeId(nextValue)) {
      if (
        (selectedGenome && selectedGenome.genome_id === nextValue) ||
        selectedGenomeIdRef.current === nextValue
      ) {
        return;
      }
      if (!selectedGenome || selectedGenome.genome_id !== nextValue) {
        queueMicrotask(() => {
          setIsLoading(true);
        });
        fetchGenomesByIds([nextValue])
          .then((results) => {
            if (results.length > 0) {
              const genome = results[0];
              selectedGenomeIdRef.current = genome.genome_id;
              setSelectedGenome(genome);
              setQuery(genome.genome_name);
            } else {
              setQuery(nextValue);
              setSelectedGenome(null);
            }
          })
          .catch(() => {
            setQuery(nextValue);
            setSelectedGenome(null);
          })
          .finally(() => {
            setIsLoading(false);
          });
        return;
      }
    }

    if (nextValue !== query) {
      if (selectedGenome && nextValue === selectedGenome.genome_name) {
        return;
      }
      queueMicrotask(() => {
        setQuery(nextValue);
        if (
          selectedGenome &&
          nextValue !== selectedGenome.genome_id &&
          nextValue !== selectedGenome.genome_name
        ) {
          setSelectedGenome(null);
        }
      });
    }
  });

  useEffect(() => {
    syncValue(value);
  }, [value]);

  const handleSelect = (genome: GenomeSummary) => {
    selectedGenomeIdRef.current = genome.genome_id;
    onChange(genome.genome_id);
    setQuery(genome.genome_name);
    setSelectedGenome(genome);
    updateSuggestions([]);
    setShowDropdown(false);
    setIsManualTrigger(false);
  };

  const handleManualDropdownToggle = () => {
    const next = !showDropdown;
    setShowDropdown(next);
    if (next) {
      setIsManualTrigger(true);
      triggerSearch("");
    } else {
      setIsManualTrigger(false);
    }
  };

  const handleManualSelect = async () => {
    if (selectedGenome) {
      handleSelect(selectedGenome);
      return;
    }

    const trimmed = query.trim();
    if (!trimmed) {
      toast.error("Enter a genome name or ID first");
      return;
    }

    setIsLoading(true);
    const result = await fetchGenomesByIds([trimmed]).then(
      (results) => ({ results }),
      (error: unknown) => ({ error }),
    );
    if ("error" in result) {
      const message =
        result.error instanceof Error
          ? result.error.message
          : "Failed to add genome";
      toast.error(message);
    } else if (result.results.length === 0) {
      toast.error("Genome not found", {
        description: `${trimmed} was not found in BV-BRC`,
      });
    } else {
      handleSelect(result.results[0]);
    }
    setIsLoading(false);
  };

  useHotkey(
    "Enter",
    () => {
      if (!showDropdown || suggestions.length === 0) {
        void handleManualSelect();
      } else if (
        highlightedIndex >= 0 &&
        highlightedIndex < suggestions.length
      ) {
        handleSelect(suggestions[highlightedIndex]);
      } else {
        void handleManualSelect();
      }
    },
    {
      target: inputRef,
      ignoreInputs: false,
      conflictBehavior: "allow",
      preventDefault: true,
    },
  );

  const showEmptyState =
    (shouldSearch(query, minQueryLength) ||
      (isManualTrigger && !query.trim())) &&
    !isLoading &&
    !error &&
    suggestions.length === 0;

  return (
    <div className={cn("space-y-2", className)}>
      {title && <Label className="service-card-label">{title}</Label>}
      <div ref={containerRef} className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          id={id}
          ref={inputRef}
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(event) => {
            const newValue = event.target.value;
            setQuery(newValue);
            setSelectedGenome(null);
            setHighlightedIndex(-1);
            setIsManualTrigger(false);
            setShowDropdown(true);
            if (selectedGenomeIdRef.current !== null) {
              onChange("");
              selectedGenomeIdRef.current = null;
            }
          }}
          onFocus={() => {
            if (query.length > 0 || isManualTrigger) {
              setShowDropdown(true);
            }
          }}
          className="service-card-input w-full pr-12 pl-10"
        />
        <Button
          ref={buttonRef}
          type="button"
          onClick={handleManualDropdownToggle}
          className="bg-primary/15 text-primary hover:bg-primary/25 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/80 absolute top-1/2 right-3 size-4 -translate-y-1/2 transition-colors"
          aria-label="Toggle dropdown"
        >
          <ChevronDown
            className={`size-4 transition-transform ${showDropdown ? "rotate-180" : ""}`}
          />
        </Button>
        <AnchoredSuggestionPortal
          anchorRef={containerRef}
          dropdownRef={dropdownRef}
          open={
            showDropdown &&
            (suggestions.length > 0 ||
              isLoading ||
              !!error ||
              showEmptyState ||
              isManualTrigger)
          }
        >
          <GenomeSuggestionList
            suggestions={suggestions}
            isLoading={isLoading}
            error={error}
            emptyMessage={
              showEmptyState
                ? query.trim()
                  ? `No genomes found for "${query.trim()}"`
                  : "No genomes found"
                : null
            }
            highlightedIndex={highlightedIndex}
            itemRefs={itemRefs}
            onSelect={handleSelect}
            onHighlight={setHighlightedIndex}
            showPrivateIndicator
            itemClassName="rounded-md border-0 bg-transparent text-sm"
          />
        </AnchoredSuggestionPortal>
      </div>
      {helperText && (
        <p className="text-muted-foreground text-xs">{helperText}</p>
      )}
    </div>
  );
}

export function SingleGenomeSelector(props: SingleGenomeSelectorProps) {
  return useSingleGenomeSelector(props);
}
