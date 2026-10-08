"use client";

import { useRef, useState } from "react";
import { useHotkey } from "@tanstack/react-hotkeys";
import { ChevronDown, Search, Loader2, Plus } from "lucide-react";
import { ServiceInput } from "@/components/services/form-ui/service-input";
import { Button } from "@/components/ui/button";
import { GenomeSuggestionList } from "@/components/services/genome-suggestion-list";
import { ServiceLabel } from "@/components/services/form-ui/service-label";
import { cn } from "@/lib/utils";
import { fetchGenomesByIds, type GenomeSummary } from "@/lib/services/genome";
import { toast } from "sonner";
import {
  useGenomeTypeahead,
  shouldSearch,
} from "@/hooks/services/use-genome-typeahead";

interface GenomeNameSelectorProps {
  title?: string;
  placeholder?: string;
  helperText?: string;
  onSelect: (genome: GenomeSummary) => void;
  selectedGenomeIds?: string[];
  maxSelections?: number;
  disabled?: boolean;
  className?: string;
  minQueryLength?: number;
}

export function GenomeNameSelector({
  title = "Select Genome",
  placeholder = "Genome...",
  helperText,
  onSelect,
  selectedGenomeIds = [],
  maxSelections = 20,
  disabled = false,
  className,
  minQueryLength = 3,
}: GenomeNameSelectorProps) {
  const selectionDisabled =
    disabled || selectedGenomeIds.length >= maxSelections;

  const existingGenomeIds = new Set(selectedGenomeIds.map((id) => id.trim()));
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  // Set while the list was opened from the toggle, which searches whatever
  // has been typed (an empty query lists genomes) without the typing
  // threshold. Typing, picking, closing or clicking outside clears it.
  const [isManualTrigger, setIsManualTrigger] = useState(false);

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
    disabled: selectionDisabled,
    skipFetch: (q, sel) => sel !== null && q.trim() === sel.genome_name,
    additionalClickOutsideRefs: [toggleRef],
    onClickOutside: () => {
      setIsManualTrigger(false);
    },
  });

  const handleSelect = (genome: GenomeSummary) => {
    if (existingGenomeIds.has(genome.genome_id)) {
      toast.error("Genome already added", {
        description: `${genome.genome_name} (${genome.genome_id}) is already in the list`,
      });
      return;
    }
    onSelect(genome);
    setQuery("");
    setSelectedGenome(null);
    updateSuggestions([]);
    setShowDropdown(false);
  };

  const handleDropdownClick = (genome: GenomeSummary) => {
    setQuery(genome.genome_name);
    setSelectedGenome(genome);
    setShowDropdown(false);
    setIsManualTrigger(false);
  };

  const handleManualAdd = async () => {
    if (selectedGenome) {
      handleSelect(selectedGenome);
      return;
    }

    const trimmed = query.trim();
    if (!trimmed) {
      toast.error("Enter a genome name or ID first");
      return;
    }

    if (existingGenomeIds.has(trimmed)) {
      toast.error("Genome already added", {
        description: `${trimmed} is already in the list`,
      });
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
        void handleManualAdd();
      } else if (
        highlightedIndex >= 0 &&
        highlightedIndex < suggestions.length
      ) {
        const genome = suggestions[highlightedIndex];
        if (!existingGenomeIds.has(genome.genome_id)) {
          handleDropdownClick(genome);
        }
      } else {
        void handleManualAdd();
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
    (shouldSearch(query, minQueryLength) || isManualTrigger) &&
    !isLoading &&
    !error &&
    suggestions.length === 0;

  // Focus alone sets showDropdown, so the toggle follows the list actually on
  // screen; otherwise it would read "Hide" over nothing and its first click
  // would do nothing.
  const isListOpen =
    showDropdown &&
    (suggestions.length > 0 || isLoading || !!error || showEmptyState);

  const handleToggle = () => {
    if (isListOpen) {
      setShowDropdown(false);
      setIsManualTrigger(false);
      return;
    }
    setShowDropdown(true);
    setIsManualTrigger(true);
    triggerSearch(query);
  };

  return (
    <div className={cn("space-y-2", className)}>
      {title && <ServiceLabel>{title}</ServiceLabel>}
      <div className="flex items-start gap-2">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <ServiceInput
            ref={inputRef}
            value={query}
            disabled={selectionDisabled}
            placeholder={
              selectionDisabled ? "Genome selection limit reached" : placeholder
            }
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedGenome(null);
              setHighlightedIndex(-1);
              setIsManualTrigger(false);
              setShowDropdown(true);
            }}
            onFocus={() => {
              setShowDropdown(true);
            }}
            inset="both"
            className="w-full"
          />
          <Button
            ref={toggleRef}
            type="button"
            variant="soft"
            aria-label={isListOpen ? "Hide suggestions" : "Show suggestions"}
            aria-expanded={isListOpen}
            disabled={selectionDisabled}
            onClick={handleToggle}
            className="absolute top-1/2 right-3 size-4 -translate-y-1/2"
          >
            <ChevronDown
              className={`size-4 transition-transform ${isListOpen ? "rotate-180" : ""}`}
            />
          </Button>
          {isListOpen && (
              <div
                ref={dropdownRef}
                className="absolute z-50 mt-1 max-h-64 w-full scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent overflow-y-auto rounded-md border bg-popover shadow-md hover:scrollbar-thumb-muted-foreground/40"
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
                  onSelect={handleDropdownClick}
                  onHighlight={setHighlightedIndex}
                  isDisabled={(genome) =>
                    existingGenomeIds.has(genome.genome_id)
                  }
                />
              </div>
            )}
        </div>
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label="Add genome"
          disabled={selectionDisabled || isLoading}
          onClick={() => {
            void handleManualAdd();
          }}
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
        </Button>
      </div>
      {helperText && (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      )}
      <p className="text-xs text-muted-foreground">
        Selected {selectedGenomeIds.length}/{maxSelections}
      </p>
    </div>
  );
}
