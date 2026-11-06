import { renderHook } from "@testing-library/react";
import type { WorkspaceItem } from "@/lib/services/workspace/domain";
import { useWorkspaceFilteredItems } from "@/hooks/services/workspace/use-workspace-filtered-items";

vi.mock("@/lib/services/workspace/helpers", () => ({
  sortItems: vi.fn((items: unknown[]) => items),
}));

const makeItem = (
  overrides: Partial<WorkspaceItem>,
): WorkspaceItem =>
  ({
    name: "file.txt",
    path: "/test/file.txt",
    type: "contigs",
    ...overrides,
  }) as WorkspaceItem;

const defaultOptions = {
  showHiddenFiles: true,
  typeFilter: "all",
  searchQuery: "",
  sort: { field: "name" as const, direction: "asc" as const },
};

describe("useWorkspaceFilteredItems", () => {
  it("returns all items when no filters are active", () => {
    const items = [
      makeItem({ name: "alpha.txt", path: "/alpha.txt" }),
      makeItem({ name: "beta.txt", path: "/beta.txt" }),
      makeItem({ name: ".hidden", path: "/.hidden" }),
    ];

    const { result } = renderHook(() =>
      useWorkspaceFilteredItems(items, defaultOptions),
    );

    expect(result.current).toHaveLength(3);
  });

  it("filters hidden files when showHiddenFiles is false", () => {
    const items = [
      makeItem({ name: "visible.txt", path: "/visible.txt" }),
      makeItem({ name: ".hidden", path: "/.hidden" }),
      makeItem({ name: "another.txt", path: "/another.txt" }),
    ];

    const { result } = renderHook(() =>
      useWorkspaceFilteredItems(items, {
        ...defaultOptions,
        showHiddenFiles: false,
      }),
    );

    expect(result.current).toHaveLength(2);
    expect(result.current.every((i) => !i.name.startsWith("."))).toBe(true);
  });

  it("filters by type", () => {
    const items = [
      makeItem({ name: "a.fasta", type: "contigs" }),
      makeItem({ name: "b.csv", type: "csv" }),
      makeItem({ name: "c.fasta", type: "contigs" }),
    ];

    const { result } = renderHook(() =>
      useWorkspaceFilteredItems(items, {
        ...defaultOptions,
        typeFilter: "contigs",
      }),
    );

    expect(result.current).toHaveLength(2);
    expect(result.current.every((i) => i.type === "contigs")).toBe(true);
  });

  it("filters by search query (case insensitive)", () => {
    const items = [
      makeItem({ name: "Report.pdf", path: "/Report.pdf" }),
      makeItem({ name: "report_v2.pdf", path: "/report_v2.pdf" }),
      makeItem({ name: "data.csv", path: "/data.csv" }),
    ];

    const { result } = renderHook(() =>
      useWorkspaceFilteredItems(items, {
        ...defaultOptions,
        searchQuery: "REPORT",
      }),
    );

    expect(result.current).toHaveLength(2);
    expect(result.current.every((i) => i.name.toLowerCase().includes("report"))).toBe(true);
  });

  it("combines multiple filters", () => {
    const items = [
      makeItem({ name: "Report.contigs", type: "contigs" }),
      makeItem({ name: ".hidden-report", type: "contigs" }),
      makeItem({ name: "report.csv", type: "csv" }),
      makeItem({ name: "data.contigs", type: "contigs" }),
    ];

    const { result } = renderHook(() =>
      useWorkspaceFilteredItems(items, {
        ...defaultOptions,
        showHiddenFiles: false,
        typeFilter: "contigs",
        searchQuery: "report",
      }),
    );

    expect(result.current).toHaveLength(1);
    expect(result.current[0]).toEqual(
      expect.objectContaining({ name: "Report.contigs", type: "contigs" }),
    );
  });

  it("returns the same array reference on a re-render with equal inputs", () => {
    const items = [
      makeItem({ name: "a.txt", path: "/a.txt" }),
      makeItem({ name: "b.txt", path: "/b.txt" }),
    ];

    const { result, rerender } = renderHook(
      ({ searchQuery }) =>
        useWorkspaceFilteredItems(items, {
          ...defaultOptions,
          searchQuery,
          // A fresh sort object each render, as the caller may pass.
          sort: { field: "name", direction: "asc" },
        }),
      { initialProps: { searchQuery: "a" } },
    );

    const first = result.current;
    rerender({ searchQuery: "a" });
    expect(result.current).toBe(first);

    rerender({ searchQuery: "b" });
    expect(result.current).not.toBe(first);
  });
});
