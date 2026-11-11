import type { useResourceCollection as useResourceCollectionHook } from "@/hooks/views/use-resource-collection";

export function createResourceCollectionResult(
  overrides: Partial<ReturnType<typeof useResourceCollectionHook>> = {},
): ReturnType<typeof useResourceCollectionHook> {
  return {
    activeId: null,
    currentTotal: () => Promise.resolve(overrides.total ?? 0),
    detail: null,
    detailError: null,
    facets: {},
    facetsError: null,
    facetStatuses: {},
    isAllPagesSelected: false,
    isDetailLoading: false,
    isFacetsLoading: false,
    isFacetsRefreshing: false,
    isInitialLoading: false,
    isPageLoading: false,
    isPlaceholderData: false,
    prefetchFacets: vi.fn(),
    isRefreshing: false,
    error: null,
    refetch: vi.fn(),
    refetchFacets: vi.fn(),
    rows: [],
    selection: {},
    selectedIds: [],
    sorting: [],
    total: 0,
    setIsAllPagesSelected: vi.fn(),
    setSelection: vi.fn(),
    setPageIndex: vi.fn(),
    setSorting: vi.fn(),
    ...overrides,
  };
}
