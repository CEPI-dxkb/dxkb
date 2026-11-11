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

interface TaxonNameSelectorProps extends TaxonomySelectorProps {
  apiServiceUrl?: string;
  includeEukaryotes?: boolean;
  includeBacteria?: boolean;
  includeViruses?: boolean;
  setBacteriophage?: boolean;
  segmentWildcard?: boolean;
  highlightMatch?: "all" | "first" | "none";
  /** Draws the error border for a caller-reported failure; unlike `required`, adds no message. */
  invalid?: boolean;
  /** The form field's error, shown under the input; a failed search shows instead while nothing is picked. */
  fieldError?: string | null;
}

const rankList = [
  "species",
  "no rank",
  "genus",
  "subspecies",
  "family",
  "order",
  "class",
  "phylum",
  "species group",
  "suborder",
  "varietas",
  "species subgroup",
  "subclass",
  "subgenus",
  "forma",
  "superphylum",
  "superkingdom",
  "tribe",
  "subfamily",
  "subphylum",
];

const boostQuery = [
  "taxon_rank:superkingdom^7000000",
  "taxon_rank:phylum^6000000",
  "taxon_rank:class^5000000",
  "taxon_rank:order^4000000",
  "taxon_rank:family^3000000",
  "taxon_rank:genus^2000000",
  "taxon_rank:species^1000000",
  "taxon_rank:*",
];

function buildSolrQuery(
  query: string,
  opts: {
    includeEukaryotes: boolean;
    includeBacteria: boolean;
    includeViruses: boolean;
    setBacteriophage: boolean;
    segmentWildcard: boolean;
  },
): string {
  const extraSearch: string[] = [];

  const qString = query.replace(/\(|\)|\.|\*|\||\[|\]/g, "");

  let cleanQuery = qString;

  rankList.forEach((rank) => {
    const re = new RegExp(`(\\b)${rank}(\\b)`, "gi");
    const newQuery = cleanQuery.replace(re, "");
    if (newQuery !== cleanQuery) {
      cleanQuery = newQuery.trim();
    }
  });

  let searchQuery = "";
  if (opts.segmentWildcard && cleanQuery) {
    const queryParts = cleanQuery.split(/[ ,]+/);
    if (queryParts.length > 0) {
      extraSearch.push(`(taxon_name:*${queryParts.join("*")}*)`);
      extraSearch.push(`(taxon_name:${queryParts.join(" ")})`);
    }
    searchQuery = `(${extraSearch.join(" OR ")})`;
  } else {
    searchQuery = cleanQuery;
  }

  if (boostQuery.length > 0) {
    searchQuery += ` AND (${boostQuery.join(" OR ")})`;
  }

  const params = new URLSearchParams();

  params.append("q", searchQuery);
  params.append("fl", "taxon_name,taxon_id,taxon_rank,lineage_names,division");
  params.append("qf", "taxon_name");

  if (opts.includeEukaryotes && !opts.setBacteriophage) {
    params.append("fq", "lineage_ids:2759");
  }
  if (opts.includeBacteria && !opts.setBacteriophage) {
    params.append("fq", "lineage_ids:2");
  }
  if (opts.includeViruses && !opts.setBacteriophage) {
    params.append("fq", "lineage_ids:10239");
  }
  if (opts.setBacteriophage) {
    params.append("fq", "taxon_name:*phage*");
  }

  return params.toString();
}

async function searchTaxonByName(
  apiUrl: string,
  query: string,
  filterOpts: {
    includeEukaryotes: boolean;
    includeBacteria: boolean;
    includeViruses: boolean;
    setBacteriophage: boolean;
    segmentWildcard: boolean;
  },
  signal?: AbortSignal,
): Promise<TaxonomyItem[]> {
  const queryParams = buildSolrQuery(query.trim(), filterOpts);

  // `buildSolrQuery` serializes the repeated `fq`, so the string goes on the URL rather than apiGet's `params`.
  return apiGet<TaxonomyItem[]>(`${apiUrl}?${queryParams}`, undefined, {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/solrquery+x-www-form-urlencoded",
    },
    signal,
  });
}

export function TaxonNameSelector({
  value,
  onChange,
  placeholder = "e.g. Bacillus cereus",
  required = false,
  disabled = false,
  className,
  invalid = false,
  fieldError = null,
  apiServiceUrl = "/api/services/taxonomy",
  includeEukaryotes = false,
  includeBacteria = false,
  includeViruses = false,
  setBacteriophage = false,
  segmentWildcard = true,
  highlightMatch: _highlightMatch = "all",
}: TaxonNameSelectorProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState(value?.taxon_name || "");
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLDivElement>(null);
  const isSelectingRef = useRef(false);
  const [prevValue, setPrevValue] = useState<TaxonomyItem | null>(
    value || null,
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => {
      clearTimeout(timeoutId);
    };
  }, [searchQuery]);

  const filterKey = `${String(includeEukaryotes)}-${String(includeBacteria)}-${String(includeViruses)}-${String(setBacteriophage)}-${String(segmentWildcard)}`;

  const searchResult = useQuery<TaxonomyItem[]>({
    queryKey: ["taxonomy-search-name", debouncedQuery, filterKey],
    queryFn: ({ signal }) =>
      searchTaxonByName(
        apiServiceUrl,
        debouncedQuery,
        {
          includeEukaryotes,
          includeBacteria,
          includeViruses,
          setBacteriophage,
          segmentWildcard,
        },
        signal,
      ),
    enabled: !!debouncedQuery.trim(),
    staleTime: 5 * 60 * 1000,
  });

  const results = searchResult.data ?? [];
  const lookup = taxonomyLookupState(searchResult);

  const handleSearchChange = (newValue: string) => {
    setSearchQuery(newValue);
    setShowDropdown(newValue.length > 0);
    if (newValue.trim() === "") {
      onChange?.(null);
    } else if (value && newValue !== value.taxon_name) {
      onChange?.(null);
    }
  };

  const handleSelect = (item: TaxonomyItem) => {
    isSelectingRef.current = true;
    onChange?.(item);
    setShowDropdown(false);
    setSearchQuery(item.taxon_name);
    setTimeout(() => {
      isSelectingRef.current = false;
    }, 0);
  };

  const handleManualDropdownToggle = () => {
    setShowDropdown(!showDropdown);
  };

  // Stores previous props in state to avoid refs-during-render and setState-in-effect lint errors.
  if (prevValue !== value) {
    setPrevValue(value || null);
    if (value && !showDropdown) {
      setSearchQuery(value.taxon_name);
    } else if (
      !value &&
      prevValue &&
      searchQuery === prevValue.taxon_name
    ) {
      // Cleared from outside (the Taxonomy ID box, a form reset): drop the stale name; typed text differs, so it stays.
      setSearchQuery("");
    }
  }

  const inputValue = searchQuery;

  const isValid = !required || !!value;
  const displayResults = results;
  const shownLookupError = value ? null : lookup.error;
  const requiredMessage =
    fieldError ??
    (touched && required && !isValid ? "Taxonomy Name must be provided." : null);

  return (
    <div className={cn("relative w-full", className)}>
      <div ref={inputRef} className="relative">
        <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <ServiceInput
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => {
            handleSearchChange(e.target.value);
          }}
          onFocus={() => {
            setShowDropdown(searchQuery.length > 0);
          }}
          onBlur={() => {
            setTouched(true);
            setTimeout(() => {
              setShowDropdown(false);
            }, 200);
          }}
          variant={
            invalid || fieldError !== null || (touched && !isValid)
              ? "invalid"
              : "default"
          }
          inset="both"
          className="w-full"
          disabled={disabled}
        />
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

        {showDropdown && (
          <div className="absolute inset-x-0 top-full z-50 mt-1 max-h-64 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent overflow-y-auto rounded-md border bg-popover shadow-md hover:scrollbar-thumb-muted-foreground/40 dark:scrollbar-thumb-muted-foreground/30 dark:hover:scrollbar-thumb-muted-foreground/50">
            <TaxonomySuggestionContent
              results={displayResults}
              loading={lookup.loading}
              error={lookup.error}
              onRetry={lookup.retry}
              emptyMessage={
                searchQuery
                  ? `No taxonomy found for: ${searchQuery}`
                  : "No results found"
              }
              renderPrimary={(item) =>
                `[${item.taxon_rank || "unknown"}] ${item.taxon_name}`
              }
              // Plain text, so the dot has one space on each side and the line still truncates.
              renderSecondary={(item) =>
                `ID: ${String(item.taxon_id)}${item.division ? ` • ${item.division}` : ""}`
              }
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
