"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { SearchIcon, Loader2Icon, ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TaxonomyItem, TaxonomySelectorProps } from "@/types";

interface TaxonNameSelectorProps extends TaxonomySelectorProps {
  apiServiceUrl?: string;
  includeEukaryotes?: boolean;
  includeBacteria?: boolean;
  includeViruses?: boolean;
  setBacteriophage?: boolean;
  segmentWildcard?: boolean;
  highlightMatch?: "all" | "first" | "none";
}

const RANK_LIST = [
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

const BOOST_QUERY = [
  "taxon_rank:superkingdom^7000000",
  "taxon_rank:phylum^6000000",
  "taxon_rank:class^5000000",
  "taxon_rank:order^4000000",
  "taxon_rank:family^3000000",
  "taxon_rank:genus^2000000",
  "taxon_rank:species^1000000",
  "taxon_rank:*",
];

// Custom encoding function for SOLR queries - only encode spaces and special URL chars
function encodeSolrQuery(query: string): string {
  return query.replace(/ /g, "%20");
}

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

  // Clean the query string
  const qString = query.replace(/\(|\)|\.|\*|\||\[|\]/g, "");

  // Extract rank parts
  let cleanQuery = qString;

  RANK_LIST.forEach((rank) => {
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
      // Add wildcard searches
      extraSearch.push(`(taxon_name:*${queryParts.join("*")}*)`);
      extraSearch.push(`(taxon_name:${queryParts.join(" ")})`);
    }
    searchQuery = `(${extraSearch.join(" OR ")})`;
  } else {
    searchQuery = cleanQuery;
  }

  // Add boost query for ranking
  if (BOOST_QUERY.length > 0) {
    searchQuery += ` AND (${BOOST_QUERY.join(" OR ")})`;
  }

  // Build the complete query string manually to avoid double encoding
  const params: string[] = [];

  // Use custom encoding for SOLR query - only encode spaces
  params.push(`q=${encodeSolrQuery(searchQuery)}`);
  params.push(`fl=taxon_name,taxon_id,taxon_rank,lineage_names,division`);
  params.push(`qf=taxon_name`);

  // Add filters based on organism type
  if (opts.includeEukaryotes && !opts.setBacteriophage) {
    params.push(`fq=lineage_ids:2759`);
  }
  if (opts.includeBacteria && !opts.setBacteriophage) {
    params.push(`fq=lineage_ids:2`);
  }
  if (opts.includeViruses && !opts.setBacteriophage) {
    params.push(`fq=lineage_ids:10239`);
  }
  if (opts.setBacteriophage) {
    params.push(`fq=taxon_name:*phage*`);
  }

  return params.join("&");
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

  const response = await fetch(`${apiUrl}?${queryParams}`, {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/solrquery+x-www-form-urlencoded",
    },
    credentials: "include",
    signal,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export function TaxonNameSelector({
  value,
  onChange,
  placeholder = "e.g. Bacillus cereus",
  required = false,
  disabled = false,
  className,
  apiServiceUrl = "/api/services/taxonomy",
  includeEukaryotes = false,
  includeBacteria = false,
  includeViruses = false,
  setBacteriophage = false,
  segmentWildcard = true,
  highlightMatch: _highlightMatch = "all",
}: TaxonNameSelectorProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  // Initialize searchQuery from value prop to ensure SSR/client hydration match
  const [searchQuery, setSearchQuery] = useState(value?.taxon_name || "");
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
  const [isManualTrigger, setIsManualTrigger] = useState(false);
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLDivElement>(null);
  const isSelectingRef = useRef(false);
  const [prevValue, setPrevValue] = useState<TaxonomyItem | null>(
    value || null,
  );

  // Debounce the search query
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Stabilize filter flags for queryKey
  const filterKey = `${includeEukaryotes}-${includeBacteria}-${includeViruses}-${setBacteriophage}-${segmentWildcard}`;

  const {
    data: results = [],
    isLoading: loading,
    error: queryError,
  } = useQuery<TaxonomyItem[], Error>({
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

  const error = queryError?.message ?? null;

  const handleSearchChange = (newValue: string) => {
    setSearchQuery(newValue);
    setShowDropdown(newValue.length > 0);
    setIsManualTrigger(false);
    // Clear the selected value when user clears the input or changes it from selected value
    if (newValue.trim() === "") {
      onChange?.(null);
    } else if (value && newValue !== value.taxon_name) {
      // If user is typing something different from the selected value, clear it
      onChange?.(null);
    }
  };

  const handleSelect = useCallback(
    (item: TaxonomyItem) => {
      isSelectingRef.current = true;
      onChange?.(item);
      setShowDropdown(false);
      setSearchQuery(item.taxon_name);
      // Reset the flag after a brief moment
      setTimeout(() => {
        isSelectingRef.current = false;
      }, 0);
    },
    [onChange],
  );

  const handleManualDropdownToggle = () => {
    setShowDropdown(!showDropdown);
    setIsManualTrigger(!showDropdown);
  };

  // Sync searchQuery with value prop when value is set externally.
  // Uses the React-recommended pattern of storing previous props in state
  // to avoid both refs-during-render and setState-in-effect lint errors.
  if (prevValue !== value) {
    setPrevValue(value || null);
    if (value && !showDropdown) {
      setSearchQuery(value.taxon_name);
    }
  }

  // Input always displays searchQuery (what user types or what's selected)
  const inputValue = searchQuery;

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

  return (
    <div className={cn("relative w-full", className)}>
      <div ref={inputRef} className="relative">
        <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          onFocus={() => setShowDropdown(searchQuery.length > 0)}
          onBlur={() => {
            setTouched(true);
            setTimeout(() => setShowDropdown(false), 200);
          }}
          className={cn(
            "w-full pr-10 pl-10",
            touched && !isValid && "border-destructive",
          )}
          disabled={disabled}
        />
        <Button
          type="button"
          onClick={handleManualDropdownToggle}
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 transition-colors"
        >
          <ChevronDownIcon
            className={`h-4 w-4 transition-transform ${showDropdown ? "rotate-180" : ""}`}
          />
        </Button>

        {/* Live Search Dropdown */}
        {showDropdown && (
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
                      [{item.taxon_rank || "unknown"}] {item.taxon_name}
                    </p>
                    <div className="text-muted-foreground flex items-center gap-2 text-xs">
                      <span>ID: {item.taxon_id}</span>
                      {item.division && <span>• {item.division}</span>}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground py-4 text-center text-sm">
                {searchQuery
                  ? `No taxonomy found for: ${searchQuery}`
                  : "No results found"}
              </p>
            )}
          </div>
        )}
      </div>

      {touched && required && !isValid && (
        <p className="text-destructive mt-1 text-sm">
          Taxonomy Name must be provided.
        </p>
      )}
    </div>
  );
}
