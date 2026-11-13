import type { FacetStatus, ResourceFacets } from "@/hooks/views/use-resource-collection";
import type { ResourceCollectionFacet } from "../resource-collection";

export type { FacetStatus };

export interface CollectionColumnOption {
  id: string;
  label: string;
  visible: boolean;
  defaultVisible: boolean;
  defaultIndex: number;
}

export interface CollectionColumnControls {
  columns: readonly CollectionColumnOption[];
  /**
   * One layout write: visibility (ids left out keep their state), a new order
   * (every id, first to last), or both.
   */
  setColumns: (change: {
    visibility?: Record<string, boolean>;
    order?: string[];
  }) => void;
  resetColumns: () => void;
}

export interface ExplicitRqlView {
  /** The `rql` URL value as the link carries it (percent-encoded). */
  raw: string;
  /** One readable line per top-level condition; null when `raw` does not parse. */
  clauses: readonly string[] | null;
}

export interface CollectionToolbarProps extends CollectionColumnControls {
  keyword: string;
  onKeywordChange: (value: string) => void;
  keywordPlaceholder?: string;

  definitions: readonly ResourceCollectionFacet[];
  pinnedFields: ReadonlySet<string>;
  setFieldPinned: (field: string, pinned: boolean) => void;
  peekedFields: ReadonlySet<string>;
  setPeekedFields: (fields: ReadonlySet<string>) => void;

  facets: ResourceFacets;
  facetStatus: (field: string) => FacetStatus;
  facetsError?: string;
  onRetryFacets?: () => void;
  facetsRetrying: boolean;
  facetsUnavailable: boolean;
  onFacetsWanted: () => void;
  onPrefetchFacets: () => void;

  filters: Readonly<Partial<Record<string, readonly string[]>>>;
  toggleValue: (field: string, value: string) => void;
  setFieldValues: (field: string, values: string[]) => void;
  clearAll: () => void;
  canClear: boolean;
  /** Present when the URL carries a hand-written rql the facets cannot show. */
  explicitRql?: ExplicitRqlView;
  /** Drops only the rql: keyword and filters stay (Clear all drops those too). */
  clearExplicitRql: () => void;
}
