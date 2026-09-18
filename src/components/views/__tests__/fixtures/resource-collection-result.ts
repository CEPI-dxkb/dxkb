import type { useResourceCollection as useResourceCollectionHook } from "@/hooks/views/use-resource-collection";

/**
 * A minimal, valid `useResourceCollection` return value: every field a test does not
 * override stays at its "nothing loaded yet" default. Shared by every
 * `resource-collection*.test.tsx` suite (including `resource-child-collection.test.tsx`,
 * where it was first extracted as `realCollectionResult`) so there is one typed builder
 * for this hook's shape, not a near-identical one per file. Not promoted to
 * `src/test-helpers/` — nothing outside these suites stubs this hook.
 */
export function createResourceCollectionResult(
  overrides: Partial<ReturnType<typeof useResourceCollectionHook>> = {},
): ReturnType<typeof useResourceCollectionHook> {
  return {
    activeId: null,
    detail: null,
    detailError: null,
    facets: {},
    isAllPagesSelected: false,
    isDetailLoading: false,
    isInitialLoading: false,
    isRefreshing: false,
    error: null,
    refetch: vi.fn(),
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
