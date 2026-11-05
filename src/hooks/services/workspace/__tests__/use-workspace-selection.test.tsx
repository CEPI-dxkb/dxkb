import { renderHook, act } from "@testing-library/react";
import type { WorkspaceItem } from "@/lib/services/workspace/domain";
import { useWorkspaceFilteredItems } from "@/hooks/services/workspace/use-workspace-filtered-items";
import { useWorkspaceSelection } from "@/hooks/services/workspace/use-workspace-selection";

const makeItem = (overrides: Partial<WorkspaceItem>): WorkspaceItem =>
  ({
    name: "file.txt",
    path: "/test/file.txt",
    type: "contigs",
    ...overrides,
  }) as WorkspaceItem;

describe("useWorkspaceSelection", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const defaultProps = {
    processedItems: [] as WorkspaceItem[],
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

  it("settles when processed items are recreated on every render", () => {
    const items = [makeItem({ name: "a.txt", path: "/a.txt" })];

    expect(() =>
      renderHook(() => {
        const processedItems = useWorkspaceFilteredItems(items, {
          showHiddenFiles: false,
          typeFilter: "all",
          searchQuery: "",
          sort: { field: "name", direction: "asc" },
        });
        return useWorkspaceSelection({ ...defaultProps, processedItems });
      }),
    ).not.toThrow();
  });

  it("keeps handleSelectItem identity across a selection change and still selects", () => {
    const items = [
      makeItem({ name: "a.txt", path: "/a.txt" }),
      makeItem({ name: "b.txt", path: "/b.txt" }),
      makeItem({ name: "c.txt", path: "/c.txt" }),
    ];
    const { result } = renderHook(() =>
      useWorkspaceSelection({ ...defaultProps, processedItems: items }),
    );
    const handler = result.current.handleSelectItem;

    act(() => {
      result.current.handleSelectItem(items[0]);
    });
    expect(result.current.handleSelectItem).toBe(handler);
    expect(result.current.selectedPaths).toEqual(["a.txt"]);

    act(() => {
      result.current.handleSelectItem(items[2], {
        ctrlOrMeta: false,
        shift: true,
      });
    });
    expect(result.current.handleSelectItem).toBe(handler);
    expect(result.current.selectedPaths).toEqual([
      "a.txt",
      "b.txt",
      "c.txt",
    ]);

    act(() => {
      result.current.handleSelectItem(items[1], {
        ctrlOrMeta: true,
        shift: false,
      });
    });
    expect(result.current.selectedPaths).toEqual(["a.txt", "c.txt"]);
  });

  it("updates selection immediately and defers panel expansion", () => {
    vi.useFakeTimers();
    const item = makeItem({
      name: "clicked-folder",
      path: "/clicked-folder",
      type: "folder",
    });
    const processedItems = [item];
    const setPanelExpanded = vi.fn();

    const { result } = renderHook(() =>
      useWorkspaceSelection({
        ...defaultProps,
        processedItems,
        setPanelExpanded,
      }),
    );

    act(() => {
      result.current.handleSelectItem(item);
    });

    expect(result.current.selectedItems).toEqual([item]);
    expect(result.current.primaryItem).toEqual(
      expect.objectContaining({ name: "clicked-folder" }),
    );
    expect(setPanelExpanded).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(setPanelExpanded).toHaveBeenCalledWith(true);
  });

  it("does not expand folder details before the double-click window closes", () => {
    vi.useFakeTimers();
    const folder = makeItem({ type: "folder", path: "/folder" });
    const setPanelExpanded = vi.fn();
    const { result } = renderHook(() =>
      useWorkspaceSelection({
        ...defaultProps,
        processedItems: [folder],
        setPanelExpanded,
      }),
    );

    act(() => {
      result.current.handleSelectItem(folder);
      vi.advanceTimersByTime(499);
    });

    expect(setPanelExpanded).not.toHaveBeenCalled();
  });

  it("opens file details immediately without waiting for folder navigation", () => {
    vi.useFakeTimers();
    const file = makeItem({ type: "txt", path: "/file.txt" });
    const setPanelExpanded = vi.fn();
    const { result } = renderHook(() =>
      useWorkspaceSelection({
        ...defaultProps,
        processedItems: [file],
        setPanelExpanded,
      }),
    );

    act(() => {
      result.current.handleSelectItem(file);
    });

    expect(setPanelExpanded).toHaveBeenCalledOnce();
    expect(setPanelExpanded).toHaveBeenCalledWith(true);
  });

  it("cancels pending folder details when navigation clears selection", () => {
    vi.useFakeTimers();
    const folder = makeItem({ type: "folder", path: "/folder" });
    const setPanelExpanded = vi.fn();
    const { result } = renderHook(() =>
      useWorkspaceSelection({
        ...defaultProps,
        processedItems: [folder],
        setPanelExpanded,
      }),
    );

    act(() => {
      result.current.handleSelectItem(folder);
      result.current.clearSelection();
      vi.runAllTimers();
    });

    expect(setPanelExpanded).not.toHaveBeenCalled();
    expect(result.current.selectedItems).toEqual([]);
  });

  it("cancels pending folder details when a file is selected next", () => {
    vi.useFakeTimers();
    const folder = makeItem({ type: "folder", path: "/folder" });
    const file = makeItem({ type: "txt", path: "/file.txt" });
    const setPanelExpanded = vi.fn();
    const { result } = renderHook(() =>
      useWorkspaceSelection({
        ...defaultProps,
        processedItems: [folder, file],
        setPanelExpanded,
      }),
    );

    act(() => {
      result.current.handleSelectItem(folder);
      result.current.handleSelectItem(file);
      vi.runAllTimers();
    });

    expect(setPanelExpanded).toHaveBeenCalledOnce();
    expect(result.current.primaryItem).toBe(file);
  });

  it("never auto-opens details when the panel was manually hidden", () => {
    vi.useFakeTimers();
    const folder = makeItem({ type: "folder", path: "/folder" });
    const file = makeItem({ type: "txt", path: "/file.txt" });
    const setPanelExpanded = vi.fn();
    const { result } = renderHook(() =>
      useWorkspaceSelection({
        processedItems: [folder, file],
        panelManuallyHidden: true,
        setPanelExpanded,
      }),
    );

    act(() => {
      result.current.handleSelectItem(folder);
      result.current.handleSelectItem(file);
      vi.runAllTimers();
    });

    expect(setPanelExpanded).not.toHaveBeenCalled();
  });

  it("cancels pending folder details when the panel is manually hidden", () => {
    vi.useFakeTimers();
    const folder = makeItem({ type: "folder", path: "/folder" });
    const setPanelExpanded = vi.fn();
    const initialProps = {
      processedItems: [folder],
      panelManuallyHidden: false,
      setPanelExpanded,
    };
    const { result, rerender } = renderHook(
      (props) => useWorkspaceSelection(props),
      { initialProps },
    );

    act(() => {
      result.current.handleSelectItem(folder);
    });
    rerender({ ...initialProps, panelManuallyHidden: true });
    act(() => {
      vi.runAllTimers();
    });

    expect(setPanelExpanded).not.toHaveBeenCalled();
  });

  it("cancels pending folder details when the browser unmounts", () => {
    vi.useFakeTimers();
    const folder = makeItem({ type: "folder", path: "/folder" });
    const setPanelExpanded = vi.fn();
    const { result, unmount } = renderHook(() =>
      useWorkspaceSelection({
        ...defaultProps,
        processedItems: [folder],
        setPanelExpanded,
      }),
    );

    act(() => {
      result.current.handleSelectItem(folder);
    });
    unmount();
    act(() => {
      vi.runAllTimers();
    });

    expect(setPanelExpanded).not.toHaveBeenCalled();
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
    const itemV1 = makeItem({
      name: "data.txt",
      path: "/test/data.txt",
      size: 100,
    });
    const itemV2 = makeItem({
      name: "data.txt",
      path: "/test/data.txt",
      size: 200,
    });

    const initialProps = {
      ...defaultProps,
      processedItems: [itemV1],
    };

    const { result, rerender } = renderHook(
      (props) => useWorkspaceSelection(props),
      { initialProps },
    );

    act(() => {
      result.current.handleSelectItem(itemV1);
    });

    rerender({
      ...defaultProps,
      processedItems: [itemV2],
    });

    expect(result.current.selectedItems).toEqual([itemV2]);
    expect(result.current.primaryItem).toBe(itemV2);
    expect(result.current.selectedPaths).toEqual(["test/data.txt"]);
  });

  it("preserves selected items that are temporarily filtered out", () => {
    const selected = makeItem({ name: "selected.txt", path: "/selected.txt" });
    const visible = makeItem({ name: "visible.txt", path: "/visible.txt" });
    const initialProps = {
      ...defaultProps,
      processedItems: [selected, visible],
    };
    const { result, rerender } = renderHook(
      (props) => useWorkspaceSelection(props),
      { initialProps },
    );

    act(() => {
      result.current.handleSelectItem(selected);
    });
    rerender({ ...defaultProps, processedItems: [visible] });

    expect(result.current.selectedItems).toEqual([selected]);
    expect(result.current.primaryItem).toBe(selected);
  });

  it("refreshes a multi-selection without changing its order", () => {
    const alphaV1 = makeItem({
      name: "alpha.txt",
      path: "/alpha.txt",
      size: 1,
    });
    const betaV1 = makeItem({ name: "beta.txt", path: "/beta.txt", size: 2 });
    const alphaV2 = { ...alphaV1, size: 10 };
    const betaV2 = { ...betaV1, size: 20 };
    const initialProps = {
      ...defaultProps,
      processedItems: [alphaV1, betaV1],
    };
    const { result, rerender } = renderHook(
      (props) => useWorkspaceSelection(props),
      { initialProps },
    );

    act(() => {
      result.current.handleSelectItem(alphaV1);
    });
    act(() => {
      result.current.handleSelectItem(betaV1, {
        ctrlOrMeta: true,
        shift: false,
      });
    });
    rerender({
      ...defaultProps,
      processedItems: [betaV2, alphaV2],
    });

    expect(result.current.selectedItems).toEqual([alphaV2, betaV2]);
    expect(result.current.primaryItem).toBe(betaV2);
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
