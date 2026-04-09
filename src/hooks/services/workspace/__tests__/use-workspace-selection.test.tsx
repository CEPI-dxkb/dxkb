import { renderHook, act } from "@testing-library/react";
import type { WorkspaceBrowserItem } from "@/types/workspace-browser";
import { useWorkspaceSelection } from "@/hooks/services/workspace/use-workspace-selection";

vi.mock("@/lib/workspace/table-selection", () => ({
  computeNextSelection: vi.fn((_ordered, _current, _anchor, clicked) => ({
    nextSelection: [clicked],
    nextAnchorPath: clicked.path,
  })),
  normalizePath: vi.fn((p: string) => p || "/"),
}));

const makeItem = (
  overrides: Partial<WorkspaceBrowserItem>,
): WorkspaceBrowserItem =>
  ({
    name: "file.txt",
    path: "/test/file.txt",
    type: "contigs",
    ...overrides,
  }) as WorkspaceBrowserItem;

describe("useWorkspaceSelection", () => {
  const defaultProps = {
    processedItems: [] as WorkspaceBrowserItem[],
    panelManuallyHidden: false,
    setPanelExpanded: vi.fn(),
  };

  it("initializes with empty selection", () => {
    const { result } = renderHook(() => useWorkspaceSelection(defaultProps));

    expect(result.current.selectedItems).toEqual([]);
    expect(result.current.anchorPath).toBeNull();
    expect(result.current.primaryItem).toBeNull();
    expect(result.current.selectedPaths).toEqual([]);
  });

  it("handleSelectItem updates selection", () => {
    const item = makeItem({ name: "clicked.txt", path: "/clicked.txt" });
    const processedItems = [item];

    const { result } = renderHook(() =>
      useWorkspaceSelection({ ...defaultProps, processedItems }),
    );

    act(() => {
      result.current.handleSelectItem(item);
    });

    expect(result.current.selectedItems).toEqual([item]);
    expect(result.current.primaryItem).toEqual(
      expect.objectContaining({ name: "clicked.txt" }),
    );
  });

  it("clearSelection resets to empty", () => {
    const item = makeItem({ name: "selected.txt", path: "/selected.txt" });
    const processedItems = [item];

    const { result } = renderHook(() =>
      useWorkspaceSelection({ ...defaultProps, processedItems }),
    );

    act(() => {
      result.current.handleSelectItem(item);
    });

    expect(result.current.selectedItems).toHaveLength(1);

    act(() => {
      result.current.clearSelection();
    });

    expect(result.current.selectedItems).toEqual([]);
    expect(result.current.anchorPath).toBeNull();
    expect(result.current.primaryItem).toBeNull();
  });

  it("syncs selected items when processedItems reference changes", () => {
    const itemV1 = makeItem({ name: "data.txt", path: "/test/data.txt", size: 100 } as Partial<WorkspaceBrowserItem>);
    const itemV2 = makeItem({ name: "data.txt", path: "/test/data.txt", size: 200 } as Partial<WorkspaceBrowserItem>);

    const initialProps = {
      ...defaultProps,
      processedItems: [itemV1],
    };

    const { result, rerender } = renderHook(
      (props) => useWorkspaceSelection(props),
      { initialProps },
    );

    // Select the item
    act(() => {
      result.current.handleSelectItem(itemV1);
    });
    expect(result.current.selectedItems).toHaveLength(1);

    // Rerender with new processedItems containing updated version of same item
    rerender({
      ...defaultProps,
      processedItems: [itemV2],
    });

    // Selection should now reference the updated item
    expect(result.current.selectedItems).toHaveLength(1);
    expect(result.current.selectedItems[0]).toBe(itemV2);
  });

  it("does not update selection when processedItems reference is the same", () => {
    const items = [makeItem({ name: "a.txt", path: "/a.txt" })];

    const initialProps = {
      ...defaultProps,
      processedItems: items,
    };

    const { result, rerender } = renderHook(
      (props) => useWorkspaceSelection(props),
      { initialProps },
    );

    act(() => {
      result.current.handleSelectItem(items[0]);
    });

    const selectionBefore = result.current.selectedItems;

    // Rerender with same reference
    rerender(initialProps);

    expect(result.current.selectedItems).toBe(selectionBefore);
  });

  it("does not update selection when no items are selected", () => {
    const itemsV1 = [makeItem({ name: "a.txt", path: "/a.txt" })];
    const itemsV2 = [makeItem({ name: "a.txt", path: "/a.txt" })];

    const initialProps = {
      ...defaultProps,
      processedItems: itemsV1,
    };

    const { result, rerender } = renderHook(
      (props) => useWorkspaceSelection(props),
      { initialProps },
    );

    // No selection — selectedItems should remain empty
    rerender({ ...defaultProps, processedItems: itemsV2 });

    expect(result.current.selectedItems).toEqual([]);
  });
});
