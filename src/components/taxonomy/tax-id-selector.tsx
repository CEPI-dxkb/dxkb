"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { SearchIcon, ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TaxonomySuggestionContent } from "@/components/taxonomy/taxonomy-suggestion-content";
import { TaxonomyItem, TaxonomySelectorProps } from "@/types";

interface TaxIDSelectorProps extends TaxonomySelectorProps {
  id?: string;
  apiServiceUrl?: string;
  queryFilter?: string;
}

async function searchTaxonById(
  apiUrl: string,
  query: string,
  queryFilter?: string,
  signal?: AbortSignal,
): Promise<TaxonomyItem[]> {
  const searchQuery = `taxon_id:${query.trim()}`;
  const params = new URLSearchParams();
  params.append("q", searchQuery);
  params.append("fl", "taxon_id,taxon_name,lineage_names");
  params.append("sort", "taxon_id asc");

  if (queryFilter) {
    params.append("fq", queryFilter);
  }

  const response = await fetch(`${apiUrl}?${params.toString()}`, {
    headers: { Accept: "application/json" },
    credentials: "include",
    signal,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${String(response.status)}`);
  }

  const data = (await response.json()) as { response?: { docs?: unknown[] } };
  return (data.response?.docs ?? []) as TaxonomyItem[];
}

export function TaxIDSelector({
  id,
  value,
  onChange,
  placeholder = "NCBI Taxonomy ID",
  required = false,
  disabled = false,
  className,
  apiServiceUrl = "/api/services/taxonomy",
  queryFilter,
}: TaxIDSelectorProps) {
  const resolvedApiServiceUrl = apiServiceUrl;
  const [showDropdown, setShowDropdown] = useState(false);
  // Initialize searchQuery from value prop to ensure SSR/client hydration match
  const [searchQuery, setSearchQuery] = useState(
    value ? String(value.taxon_id) : "",
  );
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLDivElement>(null);

  // Debounce the search query
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => {
      clearTimeout(timeoutId);
    };
  }, [searchQuery]);

  const {
    data: results = [],
    isLoading: loading,
    error: queryError,
  } = useQuery<TaxonomyItem[]>({
    queryKey: [
      "taxonomy-search-id",
      resolvedApiServiceUrl,
      debouncedQuery,
      queryFilter,
    ],
    queryFn: ({ signal }) =>
      searchTaxonById(
        resolvedApiServiceUrl,
        debouncedQuery,
        queryFilter,
        signal,
      ),
    enabled: !!debouncedQuery.trim() && !disabled,
    staleTime: 5 * 60 * 1000,
  });

  const error = queryError?.message ?? null;

  // Sync searchQuery with value prop when value is set externally
  const [prevValue, setPrevValue] = useState(value);
  const [prevDisabled, setPrevDisabled] = useState(disabled);
  if (prevValue !== value || prevDisabled !== disabled) {
    setPrevValue(value);
    setPrevDisabled(disabled);
    if (disabled) {
      // When disabled, always sync with value
      setSearchQuery(value ? String(value.taxon_id) : "");
    } else if (value && String(value.taxon_id) !== searchQuery) {
      // When not disabled but value changes externally (e.g., from taxon name selector),
      // update searchQuery only if it doesn't match (to avoid overriding active typing)
      setSearchQuery(String(value.taxon_id));
    } else if (
      !value &&
      prevValue &&
      searchQuery === String(prevValue.taxon_id)
    ) {
      setSearchQuery("");
    }
  }

  const handleSearchChange = (query: string) => {
    if (disabled) return;
    setSearchQuery(query);
    setShowDropdown(query.length > 0);
    if (query.trim() !== String(value?.taxon_id ?? "")) {
      onChange?.(null);
    }
  };

  const handleSelect = (item: TaxonomyItem) => {
    if (disabled) return;
    onChange?.(item);
    setShowDropdown(false);
    setSearchQuery(String(item.taxon_id));
  };

  const handleManualDropdownToggle = () => {
    setShowDropdown(!showDropdown);
  };

  const isValid = !required || !!value;
  const displayResults = results;
  const inputValue = disabled && value ? String(value.taxon_id) : searchQuery;

  return (
    <div className={cn("relative w-full", className)}>
      <div ref={inputRef} className="relative">
        {!disabled && (
          <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        )}
        <Input
          id={id}
          placeholder={
            disabled && !value ? "Select a taxon name first" : placeholder
          }
          value={inputValue}
          onChange={(e) => {
            handleSearchChange(e.target.value);
          }}
          onFocus={() => {
            if (!disabled) {
              setShowDropdown(searchQuery.length > 0);
            }
          }}
          onBlur={() => {
            setTouched(true);
            if (!disabled) {
              setTimeout(() => {
                setShowDropdown(false);
              }, 200);
            }
          }}
          className={cn(
            "w-full",
            !disabled && "px-10",
            disabled && value && "pl-3",
            touched && !isValid && "border-destructive",
          )}
          disabled={disabled}
          readOnly={disabled}
        />
        {!disabled && (
          <Button
            type="button"
            aria-label={showDropdown ? "Hide suggestions" : "Show suggestions"}
            onClick={handleManualDropdownToggle}
            className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronDownIcon
              className={`size-4 transition-transform ${showDropdown ? "rotate-180" : ""}`}
            />
          </Button>
        )}

        {/* Live Search Dropdown - only show when not disabled */}
        {!disabled && showDropdown && (
          <div className="absolute inset-x-0 top-full z-50 mt-1 max-h-64 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent overflow-y-auto rounded-md border bg-popover shadow-md hover:scrollbar-thumb-muted-foreground/40 dark:scrollbar-thumb-muted-foreground/30 dark:hover:scrollbar-thumb-muted-foreground/50">
            <TaxonomySuggestionContent
              results={displayResults}
              loading={loading}
              error={error}
              emptyMessage={
                searchQuery
                  ? `No taxonomy found for ID: ${searchQuery}`
                  : "No results found"
              }
              renderPrimary={(item) =>
                `${String(item.taxon_id)} [${item.taxon_name}]`
              }
              renderSecondary={(item) =>
                item.lineage_names?.length
                  ? item.lineage_names.join(" > ")
                  : null
              }
              onSelect={handleSelect}
            />
          </div>
        )}
      </div>

      {touched && required && !isValid && (
        <p className="mt-1 text-sm text-destructive">
          NCBI Tax ID is required.
        </p>
      )}
    </div>
  );
}
