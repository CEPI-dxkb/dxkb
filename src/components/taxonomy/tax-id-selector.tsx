"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { SearchIcon, Loader2Icon, ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TaxonomyItem, TaxonomySelectorProps } from "@/types";

interface TaxIDSelectorProps extends TaxonomySelectorProps {
  apiServiceUrl?: string;
  queryFilter?: string;
}

export function TaxIDSelector({
  value,
  onChange,
  placeholder = "NCBI Taxonomy ID",
  required = false,
  disabled = false,
  className,
  apiServiceUrl = "/api/services/taxonomy",
  queryFilter,
}: TaxIDSelectorProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  // Initialize searchQuery from value prop to ensure SSR/client hydration match
  const [searchQuery, setSearchQuery] = useState(
    value ? String(value.taxon_id) : "",
  );
  const [results, setResults] = useState<TaxonomyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isManualTrigger, setIsManualTrigger] = useState(false);
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLDivElement>(null);

  // Debounced search function
  const debouncedSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setResults([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Build query for exact taxon_id match
        const searchQuery = `taxon_id:${query.trim()}`;
        const params = new URLSearchParams();
        params.append("q", searchQuery);
        params.append("fl", "taxon_id,taxon_name,lineage_names");
        params.append("sort", "taxon_id asc");

        if (queryFilter) {
          params.append("fq", queryFilter);
        }

        const response = await fetch(`${apiServiceUrl}?${params.toString()}`, {
          headers: {
            Accept: "application/json",
          },
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Handle SOLR response format
        const docs = data?.response?.docs || [];
        setResults(docs);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to search taxonomy";
        setError(errorMessage);
        console.error("TaxID search error:", err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [apiServiceUrl, queryFilter],
  );

  // Sync searchQuery with value prop when value is set externally
  useEffect(() => {
    if (disabled) {
      // When disabled, always sync with value
      if (value) {
        setSearchQuery(String(value.taxon_id));
      } else {
        setSearchQuery("");
      }
    } else if (value && String(value.taxon_id) !== searchQuery) {
      // When not disabled but value changes externally (e.g., from taxon name selector),
      // update searchQuery only if it doesn't match (to avoid overriding active typing)
      setSearchQuery(String(value.taxon_id));
    }
  }, [value, disabled]);

  // Debounce the search (only when not disabled)
  useEffect(() => {
    if (disabled) return;

    const timeoutId = setTimeout(() => {
      if (searchQuery) {
        debouncedSearch(searchQuery);
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, debouncedSearch, disabled]);

  const handleSearchChange = (value: string) => {
    if (disabled) return;
    setSearchQuery(value);
    setShowDropdown(value.length > 0);
    setIsManualTrigger(false);
    // Clear the selected value when user clears the input
    if (value.trim() === "") {
      onChange?.(null);
    }
  };

  const handleSelect = useCallback(
    (item: TaxonomyItem) => {
      if (disabled) return;
      onChange?.(item);
      setShowDropdown(false);
      setSearchQuery(String(item.taxon_id));
    },
    [onChange, disabled],
  );

  const handleManualDropdownToggle = () => {
    setShowDropdown(!showDropdown);
    setIsManualTrigger(!showDropdown);
  };

  const displayValue = useMemo(() => {
    if (!value) return "";
    return `${value.taxon_id} [${value.taxon_name}]`;
  }, [value]);

  const isValid = useMemo(() => {
    if (!required) return true;
    return !!value;
  }, [required, value]);

  // Use filtered results from search, with manual trigger override
  const displayResults = useMemo(() => {
    if (isManualTrigger) {
      return results; // Show all results when manually triggered
    }
    return results;
  }, [results, isManualTrigger]);

  // Determine what to display in the input
  const inputValue = useMemo(() => {
    if (disabled && value) {
      return String(value.taxon_id);
    }
    return searchQuery;
  }, [disabled, value, searchQuery]);

  return (
    <div className={cn("relative w-full", className)}>
      <div ref={inputRef} className="relative">
        {!disabled && (
          <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        )}
        <Input
          placeholder={
            disabled && !value ? "Select a taxon name first" : placeholder
          }
          value={inputValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          onFocus={() => {
            if (!disabled) {
              setShowDropdown(searchQuery.length > 0);
            }
          }}
          onBlur={() => {
            setTouched(true);
            if (!disabled) {
              setTimeout(() => setShowDropdown(false), 200);
            }
          }}
          className={cn(
            "w-full",
            !disabled && "pr-10 pl-10",
            disabled && value && "pl-3",
            touched && !isValid && "border-destructive",
          )}
          disabled={disabled}
          readOnly={disabled}
        />
        {!disabled && (
          <Button
            type="button"
            onClick={handleManualDropdownToggle}
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 transition-colors"
          >
            <ChevronDownIcon
              className={`h-4 w-4 transition-transform ${showDropdown ? "rotate-180" : ""}`}
            />
          </Button>
        )}

        {/* Live Search Dropdown - only show when not disabled */}
        {!disabled && showDropdown && (
          <div className="bg-popover scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40 dark:scrollbar-thumb-muted-foreground/30 dark:hover:scrollbar-thumb-muted-foreground/50 absolute top-full right-0 left-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-md border shadow-md">
            {error ? (
              <div className="text-destructive p-4 text-sm">Error: {error}</div>
            ) : loading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                <span className="text-muted-foreground text-sm">
                  Searching...
                </span>
              </div>
            ) : displayResults.length > 0 ? (
              displayResults.map((item) => (
                <div
                  key={item.taxon_id}
                  className="hover:bg-accent flex cursor-pointer items-center justify-between p-2"
                  onClick={() => handleSelect(item)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {item.taxon_id} [{item.taxon_name}]
                    </p>
                    {item.lineage_names && item.lineage_names.length > 0 && (
                      <p className="text-muted-foreground truncate text-xs">
                        {item.lineage_names.join(" > ")}
                      </p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground py-4 text-center text-sm">
                {searchQuery
                  ? `No taxonomy found for ID: ${searchQuery}`
                  : "No results found"}
              </p>
            )}
          </div>
        )}
      </div>

      {touched && required && !isValid && (
        <p className="text-destructive mt-1 text-sm">
          NCBI Tax ID is required.
        </p>
      )}
    </div>
  );
}
