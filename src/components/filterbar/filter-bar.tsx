import { useEffect, useEffectEvent, useRef, useState } from "react";
import { buildRql, combineRql } from "./filter-utils";
import { KeywordSearch } from "./keyword-search";
import { SelectedFilters } from "./selected-filters";
import { FacetPanel } from "./facet-panel";
import { SelectedFilter } from "@/types/filters";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMounted } from "@/hooks/use-is-mounted";
import { useTableLayout } from "@/hooks/use-table-layout";
import type { DataResource } from "@/lib/data-api";
import {
  applyBooleanOverrides,
  diffBooleanOverrides,
} from "@/lib/table-layout";
import { useUiPreference } from "@/lib/ui-preferences/provider";

interface ColumnField {
  id: string;
  label: string;
  visible: boolean;
  facet?: boolean;
  facet_hidden?: boolean;
}

interface FilterBarProps {
  facetFields: ColumnField[];
  onFilterChange: (rql: string) => void;
  resource: DataResource;
  /** RQL predicate the list is already filtered by, which facet counts respect. */
  query: string;
  keywordValue?: string;
  onKeywordChange?: (value: string) => void;
  keywordMode?: "server" | "loaded";
}

export function FilterBar({
  facetFields,
  onFilterChange,
  resource,
  query,
  keywordValue,
  onKeywordChange,
  keywordMode = "server",
}: FilterBarProps) {
  const [internalKeywords, setInternalKeywords] = useState<string[]>([]);
  const keywords =
    keywordValue === undefined
      ? internalKeywords
      : keywordValue.split(" ").filter(Boolean);
  const setKeywords = (nextKeywords: string[]) => {
    if (keywordValue === undefined) setInternalKeywords(nextKeywords);
    else locallyRequestedKeywords.current = nextKeywords.join(" ");
    onKeywordChange?.(nextKeywords.join(" "));
  };
  const [selected, setSelected] = useState<SelectedFilter[]>([]);
  const [showFacets, setShowFacets] = useUiPreference("facetPanelOpen");
  const [layout, updateLayout] = useTableLayout(`search:${resource}`);
  // The saved facet set reads as empty until the render after hydration, and
  // useIsMounted flips in that same render, so counts wait for the set shown.
  const facetsSettled = useIsMounted();
  const locallyRequestedKeywords = useRef<string | null>(null);
  const syncExternalKeywords = useEffectEvent((value: string) => {
    if (locallyRequestedKeywords.current === value) {
      locallyRequestedKeywords.current = null;
      return;
    }
    onFilterChange(
      buildRql({ selected, keywords: value.split(" ").filter(Boolean) }),
    );
  });

  useEffect(() => {
    if (keywordValue !== undefined) syncExternalKeywords(keywordValue);
  }, [keywordValue]);

  const updateFilters = (
    nextSelected: SelectedFilter[],
    nextKeywords: string[],
  ) => {
    setSelected(nextSelected);
    setKeywords(nextKeywords);
    onFilterChange(
      buildRql({
        selected: nextSelected,
        keywords: keywordMode === "loaded" ? [] : nextKeywords,
      }),
    );
  };
  const clearAll = () => {
    updateFilters([], []);
  };

  const configurableFacetFields = facetFields.filter((field) => field.facet);
  const defaultFacetVisibility = Object.fromEntries(
    configurableFacetFields.map((field) => [
      field.id,
      field.facet_hidden !== true,
    ]),
  );
  const facetVisibility = applyBooleanOverrides(
    defaultFacetVisibility,
    layout.facets,
  );
  const activeFacetFields = configurableFacetFields.filter(
    (field) => facetVisibility[field.id],
  );

  const filterRql = buildRql({
    selected,
    keywords: keywordMode === "loaded" ? [] : keywords,
  });
  const facetQuery = combineRql(query, filterRql);

  return (
    <div className="mt-0 mb-2 flex flex-col gap-1 p-1 text-sm">
      {/* TOP ROW */}
      <div className="flex items-start justify-between gap-2">
        {/* LEFT SIDE */}
        <div className="flex flex-1 flex-col gap-1">
          <KeywordSearch
            value={keywords.join(" ")}
            onChange={(val) => {
              if (keywordMode === "loaded") {
                setKeywords(val.split(" ").filter(Boolean));
                return;
              }
              updateFilters(selected, val.split(" ").filter(Boolean));
            }}
          />

          <SelectedFilters
            selected={selected}
            onRemove={(idx) => {
              updateFilters(
                selected.filter((_, index) => index !== idx),
                keywords,
              );
            }}
          />
        </div>

        <div className="flex items-center gap-2">
          {/* FACET CHOOSER — the shared menu primitive supplies the menu role,
              keyboard handling, Escape and focus return the hand-rolled popup
              it replaces had none of, and takes over the outside-click
              dismissal that popup implemented with its own document-level
              `mousedown` listener. */}
          {showFacets && configurableFacetFields.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="toolbar"
                  >
                    Facets
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="max-h-64 w-56">
                {configurableFacetFields.map((field) => (
                  <DropdownMenuCheckboxItem
                    key={field.id}
                    checked={facetVisibility[field.id]}
                    onCheckedChange={(checked) => {
                      updateLayout({
                        facets: diffBooleanOverrides(defaultFacetVisibility, {
                          ...facetVisibility,
                          [field.id]: checked,
                        }),
                      });
                    }}
                  >
                    {field.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* CLEAR ALL */}
          <Button
            type="button"
            variant="outline"
            onClick={clearAll}
            disabled={selected.length === 0 && keywords.length === 0}
            size="toolbar"
          >
            Clear All Filters
          </Button>

          {/* SHOW/HIDE FILTERS */}
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setShowFacets((prev) => !prev);
            }}
            size="toolbar"
          >
            {showFacets ? "Hide Filters" : "Show Filters"}
          </Button>
        </div>
      </div>

      {/* FACET PANEL */}
      {showFacets && (
        <FacetPanel
          fields={activeFacetFields}
          resource={resource}
          query={facetQuery}
          enabled={facetsSettled}
          onSelect={(field, value) => {
            const exists = selected.some(
              (filter) => filter.field === field && filter.value === value,
            );
            if (!exists) {
              updateFilters(
                [...selected, { field, value, op: "eq" as const }],
                keywords,
              );
            }
          }}
        />
      )}
    </div>
  );
}
