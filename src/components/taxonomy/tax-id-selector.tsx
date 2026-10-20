"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { SearchIcon, ChevronDownIcon } from "lucide-react";
import { apiGet } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { ServiceInput } from "@/components/services/form-ui/service-input";
import { LookupErrorAlert } from "@/components/services/lookup-error-alert";
import { Button } from "@/components/ui/button";
import { TaxonomySuggestionContent } from "@/components/taxonomy/taxonomy-suggestion-content";
import { taxonomyLookupState } from "@/components/taxonomy/taxonomy-lookup-state";
import { TaxonomyItem, TaxonomySelectorProps } from "@/types";

interface TaxIDSelectorProps extends TaxonomySelectorProps {
  id?: string;
  apiServiceUrl?: string;
  queryFilter?: string;
  /**
   * Draws the error border for a failure the caller reports (a form field's
   * error). Unlike `required`, it adds no message of its own.
   */
  invalid?: boolean;
  /**
   * The form field's error (`fieldErrorMessage(field)`), shown under the
   * input in place of a `FieldErrors` beside it. While nothing is picked
   * because the search failed, the failure shows instead, so an outage never
   * reads as "Taxonomy ID is required".
   */
  fieldError?: string | null;
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
  params.append("fl", "taxon_id,taxon_name");
  params.append("sort", "taxon_id asc");

  if (queryFilter) {
    params.append("fq", queryFilter);
  }

  // A failure carries the proxy's own message ("BV-BRC Taxonomy API error:
  // 503 …"). The proxy relays BV-BRC's `Accept: application/json` reply, a
  // bare array of documents (the Solr `{ response: { docs } }` envelope only
  // comes with application/solr+json), and the API serializes taxon_id as a
  // string.
  const docs = await apiGet<
    (Omit<TaxonomyItem, "taxon_id"> & { taxon_id: number | string })[]
  >(`${apiUrl}?${params.toString()}`, undefined, {
    headers: { Accept: "application/json" },
    signal,
  });
  return docs.map((doc) => ({ ...doc, taxon_id: Number(doc.taxon_id) }));
}

export function TaxIDSelector({
  id,
  value,
  onChange,
  placeholder = "NCBI Taxonomy ID",
  required = false,
  disabled = false,
  className,
  invalid = false,
  fieldError = null,
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
  // The blur close waits so a click on a suggestion lands before the list
  // goes; unmount cancels it so it cannot fire into a torn-down component.
  const blurCloseTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return () => {
      clearTimeout(blurCloseTimeoutRef.current);
    };
  }, []);

  // Debounce the search query
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => {
      clearTimeout(timeoutId);
    };
  }, [searchQuery]);

  const searchResult = useQuery<TaxonomyItem[]>({
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

  const results = searchResult.data ?? [];
  const lookup = taxonomyLookupState(searchResult);

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
  // With nothing picked, a failed search is the reason, not the user: it
  // takes the required message's place (in the list while that is open).
  const shownLookupError = value || disabled ? null : lookup.error;
  const requiredMessage =
    fieldError ??
    (touched && required && !isValid ? "NCBI Tax ID is required." : null);
  const inputValue = disabled && value ? String(value.taxon_id) : searchQuery;

  return (
    <div className={cn("relative w-full", className)}>
      <div ref={inputRef} className="relative">
        {!disabled && (
          <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        )}
        <ServiceInput
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
              clearTimeout(blurCloseTimeoutRef.current);
              blurCloseTimeoutRef.current = setTimeout(() => {
                setShowDropdown(false);
              }, 200);
            }
          }}
          variant={
            invalid || fieldError !== null || (touched && !isValid)
              ? "invalid"
              : "default"
          }
          inset={!disabled ? "both" : value ? "aligned" : "none"}
          className="w-full"
          disabled={disabled}
          readOnly={disabled}
        />
        {!disabled && (
          <Button
            type="button"
            variant="soft"
            aria-label={showDropdown ? "Hide suggestions" : "Show suggestions"}
            onClick={handleManualDropdownToggle}
            className="absolute top-1/2 right-3 size-4 -translate-y-1/2"
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
              loading={lookup.loading}
              error={lookup.error}
              onRetry={lookup.retry}
              emptyMessage={
                searchQuery
                  ? `No taxonomy found for ID: ${searchQuery}`
                  : "No results found"
              }
              renderPrimary={(item) => item.taxon_name}
              renderSecondary={(item) => String(item.taxon_id)}
              onSelect={handleSelect}
            />
          </div>
        )}
      </div>

      {shownLookupError !== null ? (
        showDropdown ? null : (
          <div className="mt-1">
            <LookupErrorAlert
              message={shownLookupError}
              onRetry={() => {
                lookup.retry();
                // Focus reopens the list, where the retry's answer shows.
                inputRef.current?.querySelector("input")?.focus();
              }}
            />
          </div>
        )
      ) : requiredMessage !== null ? (
        <p data-slot="form-message" className="mt-1 text-sm text-destructive">
          {requiredMessage}
        </p>
      ) : null}
    </div>
  );
}
