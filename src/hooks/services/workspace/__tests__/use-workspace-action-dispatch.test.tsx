import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { createQueryClientWrapper } from "@/test-helpers/api-route-helpers";
import type { WorkspaceBrowserItem } from "@/types/workspace-browser";
import { useWorkspaceActionDispatch } from "@/hooks/services/workspace/use-workspace-action-dispatch";

const { mockDispatch } = vi.hoisted(() => ({ mockDispatch: vi.fn() }));
vi.mock("@/contexts/workspace-dialog-context", () => ({
  useWorkspaceDialog: () => ({ dispatch: mockDispatch }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/lib/services/workspace/favorites", () => ({
  toggleFavorite: vi.fn(),
}));

vi.mock("@/lib/services/workspace/helpers", () => ({
  expandDownloadPaths: vi.fn(
    (downloadable: WorkspaceBrowserItem[]) =>
      downloadable.map((item) => item.path),
  ),
  getSiblingJobResultPathForDotFolder: vi.fn(() => null),
}));

vi.mock("@/lib/services/workspace/utils", () => ({
  isFolderType: vi.fn((type: string) =>
    ["folder", "directory", "job_result", "modelfolder", "genome_group", "feature_group", "experiment_group"].includes(
      type.toLowerCase(),
    ),
  ),
}));

const makeItem = (
  overrides: Partial<WorkspaceBrowserItem>,
): WorkspaceBrowserItem =>
  ({
    id: "test-id",
    name: "file.txt",
    path: "/user@bvbrc/home/file.txt",
    type: "contigs",
    creation_time: "2025-01-01T00:00:00Z",
    link_reference: "",
    owner_id: "user@bvbrc",
    size: 100,
    userMeta: {},
    autoMeta: {},
    user_permission: "rw",
    global_permission: "n",
    timestamp: 0,
    ...overrides,
  }) as WorkspaceBrowserItem;

describe("useWorkspaceActionDispatch", () => {
  const mockGetDownloadUrls = vi.fn();
  const mockGetArchiveUrl = vi.fn();
  const mockMakeRequest = vi.fn();

  function createDefaultOptions() {
    return {
      currentUser: "user@bvbrc",
      myWorkspaceRoot: "/user@bvbrc/home",
      queryClient: new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      }),
      workspaceDownload: {
        getDownloadUrls: mockGetDownloadUrls,
        getArchiveUrl: mockGetArchiveUrl,
      },
      workspaceClient: {
        makeRequest: mockMakeRequest,
      },
      items: [] as WorkspaceBrowserItem[],
    };
  }

  it("dispatches OPEN_DELETE for delete action", async () => {
    const options = createDefaultOptions();
    const selection = [makeItem({ name: "toDelete.txt", path: "/user@bvbrc/home/toDelete.txt" })];

    const { result } = renderHook(
      () => useWorkspaceActionDispatch(options as never),
      { wrapper: createQueryClientWrapper() },
    );

    await act(async () => {
      await result.current.handleAction("delete", selection);
    });

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "OPEN_DELETE",
      items: selection,
    });
  });

  it("dispatches OPEN_COPY with mode copy for copy action", async () => {
    const options = createDefaultOptions();
    const selection = [makeItem({ name: "toCopy.txt" })];

    const { result } = renderHook(
      () => useWorkspaceActionDispatch(options as never),
      { wrapper: createQueryClientWrapper() },
    );

    await act(async () => {
      await result.current.handleAction("copy", selection);
    });

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "OPEN_COPY",
      items: selection,
      mode: "copy",
    });
  });

  it("dispatches OPEN_COPY with mode move for move action", async () => {
    const options = createDefaultOptions();
    const selection = [makeItem({ name: "toMove.txt" })];

    const { result } = renderHook(
      () => useWorkspaceActionDispatch(options as never),
      { wrapper: createQueryClientWrapper() },
    );

    await act(async () => {
      await result.current.handleAction("move", selection);
    });

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "OPEN_COPY",
      items: selection,
      mode: "move",
    });
  });

  it("dispatches OPEN_EDIT_TYPE for editType action with valid item", async () => {
    const options = createDefaultOptions();
    const item = makeItem({ name: "data.csv", path: "/user@bvbrc/home/data.csv", type: "csv" });

    const { result } = renderHook(
      () => useWorkspaceActionDispatch(options as never),
      { wrapper: createQueryClientWrapper() },
    );

    await act(async () => {
      await result.current.handleAction("editType", [item]);
    });

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "OPEN_EDIT_TYPE",
      item,
    });
  });

  it("does not dispatch for editType when selection[0] has no path", async () => {
    const options = createDefaultOptions();
    const item = makeItem({ name: "nopath.txt", path: "" });

    const { result } = renderHook(
      () => useWorkspaceActionDispatch(options as never),
      { wrapper: createQueryClientWrapper() },
    );

    await act(async () => {
      await result.current.handleAction("editType", [item]);
    });

    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("calls toggleFavorite for folder items on favorite action", async () => {
    const { toggleFavorite } = await import("@/lib/services/workspace/favorites");
    const mockedToggleFavorite = vi.mocked(toggleFavorite);
    mockedToggleFavorite.mockResolvedValue(true);

    const options = createDefaultOptions();
    const folderItem = makeItem({ name: "myFolder", path: "/user@bvbrc/home/myFolder", type: "folder" });

    const { result } = renderHook(
      () => useWorkspaceActionDispatch(options as never),
      { wrapper: createQueryClientWrapper() },
    );

    await act(async () => {
      await result.current.handleAction("favorite", [folderItem]);
    });

    await waitFor(() => {
      expect(mockedToggleFavorite).toHaveBeenCalledWith(
        "/user@bvbrc/home",
        "/user@bvbrc/home/myFolder",
      );
    });
  });

  it("skips favorite action for non-folder items", async () => {
    const { toggleFavorite } = await import("@/lib/services/workspace/favorites");
    const mockedToggleFavorite = vi.mocked(toggleFavorite);

    const options = createDefaultOptions();
    const fileItem = makeItem({ name: "file.txt", path: "/user@bvbrc/home/file.txt", type: "contigs" });

    const { result } = renderHook(
      () => useWorkspaceActionDispatch(options as never),
      { wrapper: createQueryClientWrapper() },
    );

    await act(async () => {
      await result.current.handleAction("favorite", [fileItem]);
    });

    expect(mockedToggleFavorite).not.toHaveBeenCalled();
  });

  it("shows error toast when all selected items are forbidden download types", async () => {
    const { toast } = await import("sonner");

    const options = createDefaultOptions();
    const forbiddenItem = makeItem({ name: "genomes", path: "/user@bvbrc/home/genomes", type: "genome_group" });

    const { result } = renderHook(
      () => useWorkspaceActionDispatch(options as never),
      { wrapper: createQueryClientWrapper() },
    );

    await act(async () => {
      await result.current.handleAction("download", [forbiddenItem]);
    });

    expect(toast.error).toHaveBeenCalledWith(
      "Nothing to download for this selection.",
      expect.objectContaining({
        description: expect.stringContaining("not downloadable"),
      }),
    );
  });

  it("triggers download mutation for single downloadable file", async () => {
    mockGetDownloadUrls.mockResolvedValue([["https://example.com/download/file.txt"]]);

    const fileItem = makeItem({ name: "data.txt", path: "/user@bvbrc/home/data.txt", type: "txt" });
    const options = createDefaultOptions();
    options.items = [fileItem];

    const { result } = renderHook(
      () => useWorkspaceActionDispatch(options as never),
      { wrapper: createQueryClientWrapper() },
    );

    await act(async () => {
      await result.current.handleAction("download", [fileItem]);
    });

    await waitFor(() => {
      expect(mockGetDownloadUrls).toHaveBeenCalledWith([fileItem.path]);
    });
  });

  it("opens 3D viewer in new tab for viewer3d action", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const options = createDefaultOptions();
    const pdbItem = makeItem({ name: "model.pdb", path: "/user@bvbrc/home/model.pdb", type: "pdb" });

    const { result } = renderHook(
      () => useWorkspaceActionDispatch(options as never),
      { wrapper: createQueryClientWrapper() },
    );

    await act(async () => {
      await result.current.handleAction("viewer3d", [pdbItem]);
    });

    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining("/viewer/structure/"),
      "_blank",
      "noopener,noreferrer",
    );
    openSpy.mockRestore();
  });

  it("does not open viewer3d when selection has no path", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const options = createDefaultOptions();
    const item = makeItem({ name: "model.pdb", path: "", type: "pdb" });

    const { result } = renderHook(
      () => useWorkspaceActionDispatch(options as never),
      { wrapper: createQueryClientWrapper() },
    );

    await act(async () => {
      await result.current.handleAction("viewer3d", [item]);
    });

    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it("ignores unknown action ids", async () => {
    const options = createDefaultOptions();
    const selection = [makeItem({})];

    const { result } = renderHook(
      () => useWorkspaceActionDispatch(options as never),
      { wrapper: createQueryClientWrapper() },
    );

    await act(async () => {
      await result.current.handleAction("unknownAction", selection);
    });

    expect(mockDispatch).not.toHaveBeenCalled();
    expect(mockGetDownloadUrls).not.toHaveBeenCalled();
  });

  it("download: folder item dispatches OPEN_DOWNLOAD_OPTIONS", async () => {
    const options = createDefaultOptions();
    const folderItem = makeItem({ name: "myFolder", path: "/user@bvbrc/home/myFolder", type: "folder" });
    options.items = [folderItem];

    const { result } = renderHook(
      () => useWorkspaceActionDispatch(options as never),
      { wrapper: createQueryClientWrapper() },
    );

    await act(async () => {
      await result.current.handleAction("download", [folderItem]);
    });

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "OPEN_DOWNLOAD_OPTIONS",
        defaultName: "myFolder",
      }),
    );
  });

  it("download: multiple items dispatches OPEN_DOWNLOAD_OPTIONS", async () => {
    const options = createDefaultOptions();
    const items = [
      makeItem({ name: "a.txt", path: "/user@bvbrc/home/a.txt" }),
      makeItem({ name: "b.txt", path: "/user@bvbrc/home/b.txt" }),
    ];
    options.items = items;

    const { result } = renderHook(
      () => useWorkspaceActionDispatch(options as never),
      { wrapper: createQueryClientWrapper() },
    );

    await act(async () => {
      await result.current.handleAction("download", items);
    });

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "OPEN_DOWNLOAD_OPTIONS",
      }),
    );
  });

  it("download: job_result item uses name without leading dot", async () => {
    const options = createDefaultOptions();
    const jobItem = makeItem({ name: ".assembly_results", path: "/user@bvbrc/home/.assembly_results", type: "job_result" });
    options.items = [jobItem];

    const { result } = renderHook(
      () => useWorkspaceActionDispatch(options as never),
      { wrapper: createQueryClientWrapper() },
    );

    await act(async () => {
      await result.current.handleAction("download", [jobItem]);
    });

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "OPEN_DOWNLOAD_OPTIONS",
        defaultName: "assembly_results",
      }),
    );
  });

  it("download: dot-folder with sibling job_result uses sibling name", async () => {
    const { getSiblingJobResultPathForDotFolder } = await import("@/lib/services/workspace/helpers");
    vi.mocked(getSiblingJobResultPathForDotFolder).mockReturnValue("/user@bvbrc/home/SiblingJob");

    const options = createDefaultOptions();
    const dotFolder = makeItem({ name: ".hidden", path: "/user@bvbrc/home/.hidden", type: "folder" });
    options.items = [dotFolder];

    const { result } = renderHook(
      () => useWorkspaceActionDispatch(options as never),
      { wrapper: createQueryClientWrapper() },
    );

    await act(async () => {
      await result.current.handleAction("download", [dotFolder]);
    });

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "OPEN_DOWNLOAD_OPTIONS",
        defaultName: "SiblingJob",
      }),
    );
  });

  it("favorite: skips when currentUser is empty", async () => {
    const { toggleFavorite } = await import("@/lib/services/workspace/favorites");
    const mockedToggleFavorite = vi.mocked(toggleFavorite);

    const options = createDefaultOptions();
    options.currentUser = "";
    const folderItem = makeItem({ name: "myFolder", path: "/user@bvbrc/home/myFolder", type: "folder" });

    const { result } = renderHook(
      () => useWorkspaceActionDispatch(options as never),
      { wrapper: createQueryClientWrapper() },
    );

    await act(async () => {
      await result.current.handleAction("favorite", [folderItem]);
    });

    expect(mockedToggleFavorite).not.toHaveBeenCalled();
  });

  it("favorite: skips when myWorkspaceRoot is empty", async () => {
    const { toggleFavorite } = await import("@/lib/services/workspace/favorites");
    const mockedToggleFavorite = vi.mocked(toggleFavorite);

    const options = createDefaultOptions();
    options.myWorkspaceRoot = "";
    const folderItem = makeItem({ name: "myFolder", path: "/user@bvbrc/home/myFolder", type: "folder" });

    const { result } = renderHook(
      () => useWorkspaceActionDispatch(options as never),
      { wrapper: createQueryClientWrapper() },
    );

    await act(async () => {
      await result.current.handleAction("favorite", [folderItem]);
    });

    expect(mockedToggleFavorite).not.toHaveBeenCalled();
  });
});
