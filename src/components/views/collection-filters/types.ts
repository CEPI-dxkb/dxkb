import type { FacetStatus, ResourceFacets } from "@/hooks/views/use-resource-collection";
import type { ResourceCollectionFacet } from "../resource-collection";

export type { FacetStatus };

/** One table column, as the Columns menu shows it. */
export interface CollectionColumnOption {
  id: string;
  label: string;
  visible: boolean;
  /** Shown when the table has no saved layout. */
  defaultVisible: boolean;
  /** Its place in the default order, 0-based. */
  defaultIndex: number;
}

/** What the Columns menu reads and writes. */
export interface CollectionColumnControls {
  /** Every column, in display order. */
  columns: readonly CollectionColumnOption[];
  /**
   * One layout write: a visibility change (ids left out keep their state),
   * a new order (every id, first to last), or both.
   */
  setColumns: (change: {
    visibility?: Record<string, boolean>;
    order?: string[];
  }) => void;
  /** Back to the default columns and order. */
  resetColumns: () => void;
}

/** Everything the toolbar draws and changes; `ResourceFilterBar` builds it. */
export interface CollectionToolbarProps extends CollectionColumnControls {
  /** The keyword box's draft; the caller debounces it into the URL. */
  keyword: string;
  onKeywordChange: (value: string) => void;
  keywordPlaceholder?: string;

  /** Every facet the resource offers, in profile order. */
  definitions: readonly ResourceCollectionFacet[];
  /** The saved facet set: listed above More, counted up front. */
  pinnedFields: ReadonlySet<string>;
  setFieldPinned: (field: string, pinned: boolean) => void;
  /**
   * Facets outside the saved set counted because the user opened them from
   * More (or from a pill). The toolbar drops an unfiltered one when its menus
   * close.
   */
  peekedFields: ReadonlySet<string>;
  setPeekedFields: (fields: ReadonlySet<string>) => void;

  /** Counts per counted field; a field is absent until its first count lands. */
  facets: ResourceFacets;
  facetStatus: (field: string) => FacetStatus;
  /** Condensed message when counts failed, with a Retry. */
  facetsError?: string;
  onRetryFacets?: () => void;
  facetsRetrying: boolean;
  /** The rows failed too; their alert already says why. */
  facetsUnavailable: boolean;
  /** A menu or pill opened: start (and keep) counting the facets. */
  onFacetsWanted: () => void;
  /** The pointer or focus is on Filters: start counts before the click. */
  onPrefetchFacets: () => void;

  /** Applied filters: field -> values (values in one field are OR'd). */
  filters: Readonly<Partial<Record<string, readonly string[]>>>;
  /** Add the value if absent, remove it if present. */
  toggleValue: (field: string, value: string) => void;
  /** Replace a field's values (empty removes the field). */
  setFieldValues: (field: string, values: string[]) => void;
  clearAll: () => void;
  /** Anything to clear: a keyword, a filter, or an explicit rql. */
  canClear: boolean;
  /** The URL carries a hand-written rql the facets cannot show. */
  hasExplicitRql: boolean;
}
