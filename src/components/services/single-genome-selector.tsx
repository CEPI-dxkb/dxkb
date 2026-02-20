"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Search, Loader2, ShieldUser, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  fetchGenomeSuggestions,
  fetchGenomesByIds,
  type GenomeSummary,
} from "@/lib/services/genome";
import { toast } from "sonner";

interface SingleGenomeSelectorProps {
  title?: string;
  placeholder?: string;
  helperText?: string;
  value: string;
  onChange: (genomeId: string) => void;
  disabled?: boolean;
  className?: string;
  minQueryLength?: number;
}

const DEFAULT_MIN_QUERY_LENGTH = 0;

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

export function SingleGenomeSelector({
  title,
  placeholder = "e.g. Mycobacterium tuberculosis H37Rv",
  helperText,
  value,
  onChange,
  disabled = false,
  className,
  minQueryLength = DEFAULT_MIN_QUERY_LENGTH,
}: SingleGenomeSelectorProps) {
  const [query, setQuery] = useState(value || "");
  const [suggestions, setSuggestions] = useState<GenomeSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedGenome, setSelectedGenome] = useState<GenomeSummary | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isManualTrigger, setIsManualTrigger] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [dropdownRect, setDropdownRect] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const latestAbortController = useRef<AbortController | null>(null);
  const selectedGenomeIdRef = useRef<string | null>(null);

  // Check if a string looks like a genome ID (numeric pattern like "123.45")
  const isGenomeId = (str: string): boolean => {
    return /^[0-9]+(\.[0-9]+)?$/.test(str.trim());
  };

  // Sync query with value prop, but preserve genome name if value is a genome ID
  useEffect(() => {
    // If value is empty, clear query
    if (!value) {
      if (query) {
        setQuery("");
        setSelectedGenome(null);
        selectedGenomeIdRef.current = null;
      }
      return;
    }

    // If value is a genome ID and we have a matching selectedGenome, keep the genome name displayed
    if (isGenomeId(value)) {
      // Check both state and ref to handle race conditions
      if ((selectedGenome && selectedGenome.genome_id === value) || selectedGenomeIdRef.current === value) {
        // Keep the genome name displayed, don't overwrite with ID
        return;
      }
      // If we have a genome ID but no matching selectedGenome, fetch it
      if (!selectedGenome || selectedGenome.genome_id !== value) {
        setIsLoading(true);
        fetchGenomesByIds([value])
          .then((results) => {
            if (results.length > 0) {
              const genome = results[0];
              selectedGenomeIdRef.current = genome.genome_id;
              setSelectedGenome(genome);
              setQuery(genome.genome_name);
            } else {
              // If genome not found, show the ID
              setQuery(value);
              setSelectedGenome(null);
            }
          })
          .catch(() => {
            // On error, show the ID
            setQuery(value);
            setSelectedGenome(null);
          })
          .finally(() => {
            setIsLoading(false);
          });
        return;
      }
    }

    // If value is not a genome ID (or is a name), sync normally
    // But only if it's different from current query and not matching selectedGenome
    if (value !== query) {
      // If we have a selectedGenome and the value matches its name, keep it
      if (selectedGenome && value === selectedGenome.genome_name) {
        return;
      }
      // Otherwise, update query and clear selectedGenome if value doesn't match
      setQuery(value);
      if (selectedGenome && value !== selectedGenome.genome_id && value !== selectedGenome.genome_name) {
        setSelectedGenome(null);
      }
    }
  }, [value]);

  useEffect(() => {
    // Skip search if manually triggered (handled directly in button click handler)
    // if (isManualTrigger) {
    //   return;
    // }

    // Normal search logic for typed queries
    // Skip search if query matches selected genome (from dropdown click)
    if (selectedGenome && query.trim() === selectedGenome.genome_name) {
      console.log("selectedGenome and query matches, skipping search");
      return;
    }

    console.log("query is:", query);
    if (disabled) {
      setSuggestions([]);
      setError(null);
      setIsLoading(false);
      latestAbortController.current?.abort();
      console.log("shouldSearch is false, skipping search");
      return;
    }

    setIsLoading(true);
    setError(null);

    const controller = new AbortController();
    latestAbortController.current = controller;
    console.log("fetching suggestions for query:", query);
    const timeoutId = window.setTimeout(() => {
      fetchGenomeSuggestions(query, { signal: controller.signal })
        .then((results) => {
          if (!controller.signal.aborted) {
            setSuggestions(results);
            console.log("suggestions are:", results);
          }
        })
        .catch((fetchError) => {
          if (controller.signal.aborted) {
            console.log("request aborted");
            return;
          }
          console.log("fetchError is:", fetchError);
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
  }, [query, minQueryLength, disabled, selectedGenome, isManualTrigger]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
        setHighlightedIndex(-1);
        setIsManualTrigger(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Compute dropdown position for portal (avoids Card overflow-hidden clipping)
  const updateDropdownLayout = useCallback(() => {
    if (!showDropdown || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const preferredHeight = 256; // max-h-64
    const minHeight = 160;
    const gap = 4;
    let top: number;
    let maxHeight: number;
    if (spaceBelow >= preferredHeight) {
      top = rect.bottom + gap;
      maxHeight = preferredHeight;
    } else if (spaceBelow >= minHeight) {
      top = rect.bottom + gap;
      maxHeight = Math.max(spaceBelow - gap, minHeight);
    } else {
      const spaceAbove = rect.top;
      maxHeight = Math.max(spaceAbove - gap, minHeight);
      top = rect.top - maxHeight - gap;
    }
    setDropdownRect({
      top,
      left: rect.left,
      width: rect.width,
      maxHeight,
    });
  }, [showDropdown]);

  useEffect(() => {
    if (showDropdown && containerRef.current) {
      updateDropdownLayout();
    } else {
      setDropdownRect(null);
    }
  }, [showDropdown, updateDropdownLayout]);

  useEffect(() => {
    if (!showDropdown) return;
    const handleUpdate = () => updateDropdownLayout();
    window.addEventListener("scroll", handleUpdate, true);
    window.addEventListener("resize", handleUpdate);
    return () => {
      window.removeEventListener("scroll", handleUpdate, true);
      window.removeEventListener("resize", handleUpdate);
    };
  }, [showDropdown, updateDropdownLayout]);

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

  const handleSelect = (genome: GenomeSummary) => {
    selectedGenomeIdRef.current = genome.genome_id;
    onChange(genome.genome_id);
    setQuery(genome.genome_name);
    setSelectedGenome(genome);
    setSuggestions([]);
    setShowDropdown(false);
    setIsManualTrigger(false);
  };

  const handleDropdownClick = (genome: GenomeSummary) => {
    // Select the genome immediately when clicked
    handleSelect(genome);
  };

  const handleManualDropdownToggle = () => {
    const newShowDropdown = !showDropdown;
    setShowDropdown(newShowDropdown);
    
    if (newShowDropdown) {
      // Opening dropdown - trigger search immediately with blank query
      setIsManualTrigger(true);
      setIsLoading(true);
      setError(null);
      
      // Abort any existing request
      latestAbortController.current?.abort();
      
      const controller = new AbortController();
      latestAbortController.current = controller;
      
      // Always use empty string for blank search when button is clicked
      fetchGenomeSuggestions("", { signal: controller.signal })
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
    } else {
      // Closing dropdown
      setIsManualTrigger(false);
    }
  };

  const handleManualSelect = async () => {
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
        handleManualSelect();
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
          handleDropdownClick(genome);
        } else {
          handleManualSelect();
        }
        break;
      case "Escape":
        event.preventDefault();
        setShowDropdown(false);
        setHighlightedIndex(-1);
        setIsManualTrigger(false);
        break;
    }
  };

  const showEmptyState =
    (shouldSearch(query, minQueryLength) || (isManualTrigger && !query.trim())) &&
    !isLoading &&
    !error &&
    suggestions.length === 0;

  return (
    // TODO: A
    <div className={cn("space-y-2", className)}>
      {title && <Label className="service-card-label">{title}</Label>}
      <div ref={containerRef} className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          ref={inputRef}
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(event) => {
            const newValue = event.target.value;
            setQuery(newValue);
            setSelectedGenome(null); // Clear selected genome when user types manually
            setHighlightedIndex(-1); // Reset highlight when typing
            setIsManualTrigger(false); // Reset manual trigger when user types
            setShowDropdown(true);
            // Clear form value if input is cleared, but don't update while typing
            if (!newValue.trim()) {
              onChange("");
              selectedGenomeIdRef.current = null;
            }
          }}
          onFocus={() => {
            if (query.length > 0 || isManualTrigger) {
              setShowDropdown(true);
            }
          }}
          onKeyDown={handleKeyDown}
          className="w-full pr-12 pl-10"
        />
        <Button
          ref={buttonRef}
            type="button"
            onClick={handleManualDropdownToggle}
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 transition-colors"
            aria-label="Toggle dropdown"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform ${showDropdown ? "rotate-180" : ""}`}
            />
          </Button>
        {showDropdown &&
          (suggestions.length > 0 || isLoading || error || showEmptyState || isManualTrigger) &&
          dropdownRect &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              ref={dropdownRef}
              className="bg-popover scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40 fixed z-40 overflow-y-auto rounded-md border shadow-md"
              style={{
                top: dropdownRect.top,
                left: dropdownRect.left,
                width: dropdownRect.width,
                maxHeight: dropdownRect.maxHeight,
              }}
            >
              {isLoading ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  <span className="text-muted-foreground text-sm">Searching...</span>
                </div>
              ) : error ? (
                <div className="text-destructive p-4 text-sm">{error}</div>
              ) : suggestions.length > 0 ? (
                suggestions.map((genome, index) => {
                  const isHighlighted = highlightedIndex === index;
                  return (
                    <button
                      key={genome.genome_id}
                      ref={(el) => {
                        itemRefs.current[index] = el;
                      }}
                      type="button"
                      className={cn(
                        "flex w-full flex-col items-start gap-1 px-4 py-2 text-left hover:bg-accent rounded-md border-0 bg-transparent cursor-pointer text-sm",
                        isHighlighted && "bg-accent",
                      )}
                      onClick={() => {
                        handleDropdownClick(genome);
                      }}
                      onMouseEnter={() => setHighlightedIndex(index)}
                    >
                      <span className="flex items-center gap-1 truncate text-sm font-medium">
                        {genome.public === false && (
                          <ShieldUser className="text-foreground/90 h-3.5 w-3.5 shrink-0" />
                        )}
                        <span className="truncate">{genome.genome_name}</span>
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
                  {query.trim() ? `No genomes found for "${query.trim()}"` : "No genomes found"}
                </p>
              ) : null}
            </div>,
            document.body
          )}
      </div>
      {helperText && (
        <p className="text-muted-foreground text-xs">{helperText}</p>
      )}
    </div>
  );
}

