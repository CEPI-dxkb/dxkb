import { render } from "@testing-library/react";
import { useState } from "react";
import type { ResourceFacets } from "@/hooks/views/use-resource-collection";
import type { ResourceCollectionFacet } from "../../../resource-collection";
import { CollectionToolbar } from "../../collection-toolbar";
import type { CollectionToolbarProps, FacetStatus } from "../../types";

export const toolbarDefinitions: ResourceCollectionFacet[] = [
  { field: "genome_status", label: "Genome Status" },
  { field: "host_name", label: "Host Name" },
  { field: "isolation_country", label: "Isolation Country" },
  { field: "species", label: "Species" },
];

export const toolbarFacets: ResourceFacets = {
  genome_status: [
    { value: "WGS", count: 20 },
    { value: "Complete", count: 10 },
    { value: "Plasmid", count: 3 },
  ],
  host_name: [
    { value: "Human", count: 5 },
    { value: "", count: 2 },
  ],
  isolation_country: [
    { value: "Germany", count: 7 },
    { value: "France", count: 4 },
  ],
};

type Filters = Record<string, string[]>;

interface ToolbarOptions {
  definitions?: ResourceCollectionFacet[];
  facets?: ResourceFacets;
  statuses?: Partial<Record<string, FacetStatus>>;
  filters?: Filters;
  favorites?: string[];
  overrides?: Partial<CollectionToolbarProps>;
}

export function renderToolbar({
  definitions = toolbarDefinitions,
  facets = toolbarFacets,
  statuses = {},
  filters: initialFilters = {},
  favorites: initialFavorites = ["genome_status", "host_name"],
  overrides = {},
}: ToolbarOptions = {}) {
  const spies = {
    setFieldFavorite: vi.fn<(field: string, favorite: boolean) => void>(),
    toggleValue: vi.fn<(field: string, value: string) => void>(),
    setFieldValues: vi.fn<(field: string, values: string[]) => void>(),
    onFacetsWanted: vi.fn<() => void>(),
    onPrefetchFacets: vi.fn<() => void>(),
    clearAll: vi.fn<() => void>(),
    clearExplicitRql: vi.fn<() => void>(),
  };
  const state = {
    favorites: new Set(initialFavorites),
    filters: initialFilters,
  };

  function Harness() {
    const [favorites, setFavorites] = useState<ReadonlySet<string>>(state.favorites);
    const [filters, setFilters] = useState<Filters>(state.filters);
    state.favorites = new Set(favorites);
    state.filters = filters;

    const setFieldValues = (field: string, values: string[]) => {
      spies.setFieldValues(field, values);
      setFilters((current) => {
        const next = { ...current };
        if (values.length > 0) next[field] = values;
        else Reflect.deleteProperty(next, field);
        return next;
      });
    };

    return (
      <CollectionToolbar
        keyword=""
        onKeywordChange={vi.fn()}
        definitions={definitions}
        favoriteFields={favorites}
        setFieldFavorite={(field, next) => {
          spies.setFieldFavorite(field, next);
          setFavorites((current) => {
            const updated = new Set(current);
            if (next) updated.add(field);
            else updated.delete(field);
            return updated;
          });
        }}
        facets={facets}
        facetStatus={(field) =>
          statuses[field] ?? (facets[field] ? "ready" : "loading")
        }
        facetsRetrying={false}
        facetsUnavailable={false}
        onFacetsWanted={spies.onFacetsWanted}
        onPrefetchFacets={spies.onPrefetchFacets}
        filters={filters}
        toggleValue={(field, value) => {
          spies.toggleValue(field, value);
          const current = filters[field] ?? [];
          setFieldValues(
            field,
            current.includes(value)
              ? current.filter((item) => item !== value)
              : [...current, value],
          );
        }}
        setFieldValues={setFieldValues}
        clearAll={() => {
          spies.clearAll();
          setFilters({});
        }}
        canClear={Object.keys(filters).length > 0}
        explicitRql={undefined}
        clearExplicitRql={spies.clearExplicitRql}
        columns={[]}
        setColumns={vi.fn()}
        resetColumns={vi.fn()}
        {...overrides}
      />
    );
  }

  return { ...render(<Harness />), spies, state };
}
