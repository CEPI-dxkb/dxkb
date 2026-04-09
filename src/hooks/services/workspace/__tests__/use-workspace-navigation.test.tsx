import { renderHook, act } from "@testing-library/react";
import type { WorkspaceBrowserItem } from "@/types/workspace-browser";
import { useWorkspaceNavigation } from "@/hooks/services/workspace/use-workspace-navigation";

vi.mock("@/lib/services/workspace/utils", () => ({
  isFolderType: vi.fn((type: string) => type === "folder"),
}));

vi.mock("@/lib/utils", () => ({
  encodeWorkspaceSegment: vi.fn((s: string) => s),
  sanitizePathSegment: vi.fn((s: string) => s),
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

describe("useWorkspaceNavigation", () => {
  const mockRouter = { push: vi.fn() };
  const mockClearSelection = vi.fn();

  const defaultProps = {
    mode: "home" as const,
    username: "testuser",
    path: "",
    router: mockRouter,
    clearSelection: mockClearSelection,
  };

  it("navigateToItem in home mode builds correct URL with username and path segments", () => {
    const item = makeItem({ name: "my-folder", type: "folder" });

    const { result } = renderHook(() =>
      useWorkspaceNavigation({ ...defaultProps, path: "documents" }),
    );

    act(() => {
      result.current.navigateToItem(item);
    });

    expect(mockRouter.push).toHaveBeenCalledWith(
      "/workspace/testuser/home/documents/my-folder",
    );
    expect(mockClearSelection).toHaveBeenCalled();
  });

  it("navigateToItem in non-home mode builds URL from item.path", () => {
    const item = makeItem({
      name: "shared-folder",
      path: "/shareduser/shared-folder",
      type: "folder",
    });

    const { result } = renderHook(() =>
      useWorkspaceNavigation({
        ...defaultProps,
        mode: "shared",
      }),
    );

    act(() => {
      result.current.navigateToItem(item);
    });

    expect(mockRouter.push).toHaveBeenCalledWith(
      "/workspace/shareduser/shared-folder",
    );
    expect(mockClearSelection).toHaveBeenCalled();
  });

  it("handleItemDoubleClick navigates for folders", () => {
    const folder = makeItem({
      name: "projects",
      path: "/testuser/projects",
      type: "folder",
    });

    const { result } = renderHook(() =>
      useWorkspaceNavigation(defaultProps),
    );

    act(() => {
      result.current.handleItemDoubleClick(folder);
    });

    expect(mockRouter.push).toHaveBeenCalled();
  });

  it("handleItemDoubleClick navigates for job_result type", () => {
    const jobResult = makeItem({
      name: "assembly-result",
      path: "/testuser/assembly-result",
      type: "job_result",
    });

    const { result } = renderHook(() =>
      useWorkspaceNavigation(defaultProps),
    );

    act(() => {
      result.current.handleItemDoubleClick(jobResult);
    });

    expect(mockRouter.push).toHaveBeenCalled();
  });

  it("navigateToItem in home mode uses basePath instead of path when provided", () => {
    const item = makeItem({ name: "child-folder", type: "folder" });

    const { result } = renderHook(() =>
      useWorkspaceNavigation({
        ...defaultProps,
        path: "original/path",
        basePath: "override/base",
      }),
    );

    act(() => {
      result.current.navigateToItem(item);
    });

    expect(mockRouter.push).toHaveBeenCalledWith(
      "/workspace/testuser/home/override/base/child-folder",
    );
  });

  it("navigateToItem in home mode falls back to path when basePath is undefined", () => {
    const item = makeItem({ name: "sub", type: "folder" });

    const { result } = renderHook(() =>
      useWorkspaceNavigation({
        ...defaultProps,
        path: "fallback/path",
        basePath: undefined,
      }),
    );

    act(() => {
      result.current.navigateToItem(item);
    });

    expect(mockRouter.push).toHaveBeenCalledWith(
      "/workspace/testuser/home/fallback/path/sub",
    );
  });

  it("navigateToItem in public mode builds URL from item.path", () => {
    const item = makeItem({
      name: "public-doc",
      path: "/shared/public-doc",
      type: "folder",
    });

    const { result } = renderHook(() =>
      useWorkspaceNavigation({ ...defaultProps, mode: "public" }),
    );

    act(() => {
      result.current.navigateToItem(item);
    });

    expect(mockRouter.push).toHaveBeenCalledWith(
      "/workspace/public/shared/public-doc",
    );
  });

  it("handleItemDoubleClick ignores non-folder/non-job types", () => {
    const regularFile = makeItem({
      name: "data.csv",
      path: "/testuser/data.csv",
      type: "csv",
    });

    const { result } = renderHook(() =>
      useWorkspaceNavigation(defaultProps),
    );

    act(() => {
      result.current.handleItemDoubleClick(regularFile);
    });

    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});
