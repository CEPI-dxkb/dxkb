"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Search, Loader2, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  fetchGenomeSuggestions,
  fetchGenomesByIds,
  type GenomeSummary,
} from "@/lib/services/genome";
import { toast } from "sonner";

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

const DEFAULT_MIN_QUERY_LENGTH = 3;

function shouldSearch(query: string, minLength: number): boolean {
  const trimmed = query.trim();

  if (!trimmed) {
    return false;
  }

  if (/^[0-9]+(\.[0-9]+)?$/.test(trimmed)) {
    return trimmed.length >= 2;
  }

  return trimmed.length >= minLength;
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
  minQueryLength = DEFAULT_MIN_QUERY_LENGTH,
}: GenomeNameSelectorProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GenomeSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedGenome, setSelectedGenome] = useState<GenomeSummary | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const latestAbortController = useRef<AbortController | null>(null);
  const selectionDisabled = disabled || selectedGenomeIds.length >= maxSelections;

  useEffect(() => {
    // Skip search if query matches selected genome (from dropdown click)
    if (selectedGenome && query.trim() === selectedGenome.genome_name) {
      return;
    }

    if (!shouldSearch(query, minQueryLength) || selectionDisabled) {
      setSuggestions([]);
      setError(null);
      setIsLoading(false);
      latestAbortController.current?.abort();
      return;
    }

    setIsLoading(true);
    setError(null);

    const controller = new AbortController();
    latestAbortController.current = controller;

    const timeoutId = window.setTimeout(() => {
      fetchGenomeSuggestions(query, { signal: controller.signal })
        .then((results) => {
          if (!controller.signal.aborted) {
            setSuggestions(results);
          }
        })
        .catch((fetchError) => {
          if (controller.signal.aborted) {
            return;
          }

          const message =
            fetchError instanceof Error
              ? fetchError.message
              : "Failed to search genomes";
          setError(message);
          setSuggestions([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsLoading(false);
          }
        });
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [query, minQueryLength, selectionDisabled, selectedGenome]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Reset highlighted index when suggestions change
  useEffect(() => {
    setHighlightedIndex(-1);
    itemRefs.current = [];
  }, [suggestions]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && itemRefs.current[highlightedIndex]) {
      itemRefs.current[highlightedIndex]?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [highlightedIndex]);

  const existingGenomeIds = useMemo(
    () => new Set(selectedGenomeIds.map((id) => id.trim())),
    [selectedGenomeIds],
  );

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
    setSuggestions([]);
    setShowDropdown(false);
  };

  const handleDropdownClick = (genome: GenomeSummary) => {
    // Just populate the input field, don't add yet
    setQuery(genome.genome_name);
    setSelectedGenome(genome);
    setShowDropdown(false);
  };

  const handleManualAdd = async () => {
    // If we have a selected genome from dropdown, use it directly
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

    try {
      const results = await fetchGenomesByIds([trimmed]);

      if (results.length === 0) {
        toast.error("Genome not found", {
          description: `${trimmed} was not found in BV-BRC`,
        });
        return;
      }

      handleSelect(results[0]);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to add genome";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || suggestions.length === 0) {
      if (event.key === "Enter") {
        event.preventDefault();
        handleManualAdd();
      }
      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setHighlightedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        setShowDropdown(true);
        break;
      case "ArrowUp":
        event.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        setShowDropdown(true);
        break;
      case "Enter":
        event.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          const genome = suggestions[highlightedIndex];
          if (!existingGenomeIds.has(genome.genome_id)) {
            handleDropdownClick(genome);
          }
        } else {
          handleManualAdd();
        }
        break;
      case "Escape":
        event.preventDefault();
        setShowDropdown(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  const showEmptyState =
    shouldSearch(query, minQueryLength) &&
    !isLoading &&
    !error &&
    suggestions.length === 0;

  return (
    <div className={cn("space-y-2", className)}>
      {title && <Label className="service-card-label">{title}</Label>}
      <div className="flex items-start gap-2">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            ref={inputRef}
            value={query}
            disabled={selectionDisabled}
            placeholder={selectionDisabled ? "Genome selection limit reached" : placeholder}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedGenome(null); // Clear selected genome when user types manually
              setHighlightedIndex(-1); // Reset highlight when typing
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            onKeyDown={handleKeyDown}
            className="w-full pr-10 pl-10"
          />
          {showDropdown && (suggestions.length > 0 || isLoading || error || showEmptyState) && (
            <div ref={dropdownRef} className="bg-popover scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40 absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border shadow-md">
              {isLoading ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  <span className="text-muted-foreground text-sm">Searching...</span>
                </div>
              ) : error ? (
                <div className="text-destructive p-4 text-sm">{error}</div>
              ) : suggestions.length > 0 ? (
                suggestions.map((genome, index) => {
                  const isDuplicate = existingGenomeIds.has(genome.genome_id);
                  const isHighlighted = highlightedIndex === index;
                  return (
                    <button
                      key={genome.genome_id}
                      ref={(el) => {
                        itemRefs.current[index] = el;
                      }}
                      type="button"
                      className={cn(
                        "flex w-full flex-col items-start gap-1 px-4 py-2 text-left hover:bg-accent",
                        isDuplicate && "cursor-not-allowed opacity-60",
                        isHighlighted && "bg-accent",
                      )}
                      onClick={() => {
                        if (!isDuplicate) {
                          handleDropdownClick(genome);
                        }
                      }}
                      onMouseEnter={() => setHighlightedIndex(index)}
                    >
                      <span className="truncate text-sm font-medium">
                        {genome.genome_name}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {genome.genome_id}
                        {genome.strain ? ` • ${genome.strain}` : ""}
                      </span>
                    </button>
                  );
                })
              ) : showEmptyState ? (
                <p className="text-muted-foreground py-4 text-center text-sm">
                  No genomes found for "{query.trim()}"
                </p>
              ) : null}
            </div>
          )}
        </div>
        <Button
          type="button"
          size="icon"
          variant="outline"
          disabled={selectionDisabled || isLoading}
          onClick={handleManualAdd}
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </div>
      {helperText && (
        <p className="text-muted-foreground text-xs">{helperText}</p>
      )}
      <p className="text-muted-foreground text-xs">
        Selected {selectedGenomeIds.length}/{maxSelections}
      </p>
    </div>
  );
}

