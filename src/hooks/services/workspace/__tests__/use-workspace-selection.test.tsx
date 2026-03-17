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
});
