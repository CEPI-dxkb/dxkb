import { render } from "@testing-library/react";
import { useState } from "react";
import type { ResourceFacets } from "@/hooks/views/use-resource-collection";
import type { ResourceCollectionFacet } from "../../../resource-collection";
import { CollectionToolbar } from "../../collection-toolbar";
import type { CollectionToolbarProps, FacetStatus } from "../../types";

/** Two pinned facets, two in More (one of them never counted). */
export const toolbarDefinitions: ResourceCollectionFacet[] = [
  { field: "genome_status", label: "Genome Status" },
  { field: "host_name", label: "Host Name" },
  {
    field: "isolation_country",
    label: "Isolation Country",
    initiallyVisible: false,
  },
  { field: "species", label: "Species", initiallyVisible: false },
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
  /** Defaults to "ready" for a counted field, else "loading". */
  statuses?: Partial<Record<string, FacetStatus>>;
  filters?: Filters;
  pinned?: string[];
  peeked?: string[];
  overrides?: Partial<CollectionToolbarProps>;
}

/**
 * The toolbar over real state: picks, pins and peeks land as a page's would,
 * and every callback is also a spy.
 */
export function renderToolbar({
  definitions = toolbarDefinitions,
  facets = toolbarFacets,
  statuses = {},
  filters: initialFilters = {},
  pinned: initialPinned = ["genome_status", "host_name"],
  peeked: initialPeeked = [],
  overrides = {},
}: ToolbarOptions = {}) {
  const spies = {
    setFieldPinned: vi.fn<(field: string, pinned: boolean) => void>(),
    setPeekedFields: vi.fn<(fields: ReadonlySet<string>) => void>(),
    toggleValue: vi.fn<(field: string, value: string) => void>(),
    setFieldValues: vi.fn<(field: string, values: string[]) => void>(),
    onFacetsWanted: vi.fn<() => void>(),
    onPrefetchFacets: vi.fn<() => void>(),
    clearAll: vi.fn<() => void>(),
  };
  const state = {
    pinned: new Set(initialPinned),
    peeked: new Set(initialPeeked),
    filters: initialFilters,
  };

  function Harness() {
    const [pinned, setPinned] = useState<ReadonlySet<string>>(state.pinned);
    const [peeked, setPeeked] = useState<ReadonlySet<string>>(state.peeked);
    const [filters, setFilters] = useState<Filters>(state.filters);
    state.pinned = new Set(pinned);
    state.peeked = new Set(peeked);
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
        pinnedFields={pinned}
        setFieldPinned={(field, next) => {
          spies.setFieldPinned(field, next);
          setPinned((current) => {
            const updated = new Set(current);
            if (next) updated.add(field);
            else updated.delete(field);
            return updated;
          });
        }}
        peekedFields={peeked}
        setPeekedFields={(fields) => {
          spies.setPeekedFields(fields);
          setPeeked(fields);
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
        hasExplicitRql={false}
        columns={[]}
        setColumns={vi.fn()}
        resetColumns={vi.fn()}
        {...overrides}
      />
    );
  }

  return { ...render(<Harness />), spies, state };
}
