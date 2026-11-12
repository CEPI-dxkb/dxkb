import { renderHook, act, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { toast } from "sonner";
import { server } from "@/test-helpers/msw-server";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { WorkspaceItem } from "@/lib/services/workspace/domain";
import { InMemoryWorkspaceRepository } from "@/lib/services/workspace/adapters/in-memory-workspace-repository";
import { WorkspaceRepositoryProvider } from "@/contexts/workspace-repository-context";
import { useWorkspaceActionDispatch } from "@/hooks/services/workspace/use-workspace-action-dispatch";

function makeWrapper(repo: InMemoryWorkspaceRepository) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <WorkspaceRepositoryProvider value={{ authenticated: repo, public: repo }}>
          {children}
        </WorkspaceRepositoryProvider>
      </QueryClientProvider>
    );
  };
}

const { mockDispatch, mockPush } = vi.hoisted(() => ({
  mockDispatch: vi.fn(),
  mockPush: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));
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
    (downloadable: WorkspaceItem[]) =>
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
  overrides: Partial<WorkspaceItem>,
): WorkspaceItem =>
  ({
    id: "test-id",
    name: "file.txt",
    path: "/user@bvbrc/home/file.txt",
    type: "contigs",
    createdAt: "2025-01-01T00:00:00Z",
    linkReference: "",
    ownerId: "user@bvbrc",
    size: 100,
    permissions: { user: "rw", global: "n" },
    timestamp: 0,
    ...overrides,
  });

describe("useWorkspaceActionDispatch", () => {
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
      items: [] as WorkspaceItem[],
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dispatches OPEN_DELETE for delete action", () => {
    const options = createDefaultOptions();
    const selection = [makeItem({ name: "toDelete.txt", path: "/user@bvbrc/home/toDelete.txt" })];

    const { result } = renderHook(
      () => useWorkspaceActionDispatch(options as never),
      { wrapper: makeWrapper(new InMemoryWorkspaceRepository()) },
    );

    act(() => {
      result.current.handleAction("delete", selection);
    });

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "OPEN_DELETE",
      items: selection,
    });
  });

  it("dispatches OPEN_COPY with mode copy for copy action", () => {
    const options = createDefaultOptions();
    const selection = [makeItem({ name: "toCopy.txt" })];

    const { result } = renderHook(
      () => useWorkspaceActionDispatch(options as never),
      { wrapper: makeWrapper(new InMemoryWorkspaceRepository()) },
    );

    act(() => {
      result.current.handleAction("copy", selection);
    });

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "OPEN_COPY",
      items: selection,
      mode: "copy",
    });
  });

  it("dispatches OPEN_COPY with mode move for move action", () => {
    const options = createDefaultOptions();
    const selection = [makeItem({ name: "toMove.txt" })];

    const { result } = renderHook(
      () => useWorkspaceActionDispatch(options as never),
      { wrapper: makeWrapper(new InMemoryWorkspaceRepository()) },
    );

    act(() => {
      result.current.handleAction("move", selection);
    });

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "OPEN_COPY",
      items: selection,
      mode: "move",
    });
  });

  it("dispatches OPEN_EDIT_TYPE for editType action with valid item", () => {
    const options = createDefaultOptions();
    const item = makeItem({ name: "data.csv", path: "/user@bvbrc/home/data.csv", type: "csv" });

    const { result } = renderHook(
      () => useWorkspaceActionDispatch(options as never),
      { wrapper: makeWrapper(new InMemoryWorkspaceRepository()) },
    );

    act(() => {
      result.current.handleAction("editType", [item]);
    });

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "OPEN_EDIT_TYPE",
      item,
    });
  });

  it("does not dispatch for editType when selection[0] has no path", () => {
    const options = createDefaultOptions();
    const item = makeItem({ name: "nopath.txt", path: "" });

    const { result } = renderHook(
      () => useWorkspaceActionDispatch(options as never),
      { wrapper: makeWrapper(new InMemoryWorkspaceRepository()) },
    );

    act(() => {
      result.current.handleAction("editType", [item]);
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
      { wrapper: makeWrapper(new InMemoryWorkspaceRepository()) },
    );

    act(() => {
      result.current.handleAction("favorite", [folderItem]);
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
      { wrapper: makeWrapper(new InMemoryWorkspaceRepository()) },
    );

    act(() => {
      result.current.handleAction("favorite", [fileItem]);
    });

    expect(mockedToggleFavorite).not.toHaveBeenCalled();
  });

  it("shows error toast when all selected items are forbidden download types", async () => {
    const { toast } = await import("sonner");

    const options = createDefaultOptions();
    const forbiddenItem = makeItem({ name: "genomes", path: "/user@bvbrc/home/genomes", type: "genome_group" });

    const { result } = renderHook(
      () => useWorkspaceActionDispatch(options as never),
      { wrapper: makeWrapper(new InMemoryWorkspaceRepository()) },
    );

    act(() => {
      result.current.handleAction("download", [forbiddenItem]);
    });

    expect(toast.error).toHaveBeenCalledWith(
      "Nothing to download for this selection.",
      expect.objectContaining({
        description: expect.stringContaining("not downloadable") as string,
      }),
    );
  });

  it("triggers download mutation for single downloadable file", async () => {
    const fileItem = makeItem({ name: "data.txt", path: "/user@bvbrc/home/data.txt", type: "txt" });
    const options = createDefaultOptions();
    options.items = [fileItem];
    const repo = new InMemoryWorkspaceRepository({
      downloadUrls: { [fileItem.path]: ["https://example.com/download/file.txt"] },
    });

    const { result } = renderHook(
      () => useWorkspaceActionDispatch(options as never),
      { wrapper: makeWrapper(repo) },
    );

    act(() => {
      result.current.handleAction("download", [fileItem]);
    });

    await waitFor(() => {
      const call = repo.calls.find((c) => c.method === "getDownloadUrls");
      expect(call).toEqual({ method: "getDownloadUrls", paths: [fileItem.path] });
    });
  });

  it("opens 3D viewer in new tab for viewer3d action", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const options = createDefaultOptions();
    const pdbItem = makeItem({ name: "model.pdb", path: "/user@bvbrc/home/model.pdb", type: "pdb" });

    const { result } = renderHook(
      () => useWorkspaceActionDispatch(options as never),
      { wrapper: makeWrapper(new InMemoryWorkspaceRepository()) },
    );

    act(() => {
      result.current.handleAction("viewer3d", [pdbItem]);
    });

    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining("/viewer/structure/"),
      "_blank",
      "noopener,noreferrer",
    );
    openSpy.mockRestore();
  });

  it("does not open viewer3d when selection has no path", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const options = createDefaultOptions();
    const item = makeItem({ name: "model.pdb", path: "", type: "pdb" });

    const { result } = renderHook(
      () => useWorkspaceActionDispatch(options as never),
      { wrapper: makeWrapper(new InMemoryWorkspaceRepository()) },
    );

    act(() => {
      result.current.handleAction("viewer3d", [item]);
    });

    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  describe("view action", () => {
    const groupItem = makeItem({
      name: "Brucella Group",
      path: "/user@bvbrc/home/Genome Groups/Brucella Group",
      type: "genome_group",
    });

    function serveGroup(response: () => Response) {
      const requested: string[][] = [];
      server.use(
        http.post("/api/services/workspace", async ({ request }) => {
          const body = (await request.json()) as {
            params: [{ objects: string[] }];
          };
          requested.push(body.params[0].objects);
          return response();
        }),
      );
      return requested;
    }

    function renderDispatch() {
      return renderHook(
        () => useWorkspaceActionDispatch(createDefaultOptions() as never),
        { wrapper: makeWrapper(new InMemoryWorkspaceRepository()) },
      );
    }

    it("opens the Genomes table scoped to the group's members", async () => {
      const requested = serveGroup(() =>
        HttpResponse.json({
          result: [
            [
              [
                "metadata",
                JSON.stringify({ id_list: { genome_id: ["29461.10", "1218315.3"] } }),
              ],
            ],
          ],
        }),
      );
      const { result } = renderDispatch();

      act(() => {
        result.current.handleAction("view", [groupItem]);
      });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          "/genome?rql=in(genome_id,(29461.10,1218315.3))&tab=genomes",
        );
      });
      expect(requested).toEqual([[groupItem.path]]);
      expect(result.current.isViewingGroup).toBe(false);
    });

    it("shows a toast instead of navigating for an empty group", async () => {
      serveGroup(() =>
        HttpResponse.json({
          result: [[["metadata", JSON.stringify({ id_list: { genome_id: [] } })]]],
        }),
      );
      const { result } = renderDispatch();

      act(() => {
        result.current.handleAction("view", [groupItem]);
      });

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "This genome group has no genomes.",
        );
      });
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("shows the workspace error when the group cannot be read", async () => {
      serveGroup(() =>
        HttpResponse.json(
          { error: { message: "_ERROR_Object not found_ERROR_" } },
          { status: 500 },
        ),
      );
      const { result } = renderDispatch();

      act(() => {
        result.current.handleAction("view", [groupItem]);
      });

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Object not found");
      });
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("ignores a selection that is not a genome group", () => {
      const requested = serveGroup(() => HttpResponse.json({}));
      const { result } = renderDispatch();

      act(() => {
        result.current.handleAction("view", [makeItem({ type: "feature_group" })]);
      });

      expect(requested).toEqual([]);
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  it("ignores unknown action ids", () => {
    const options = createDefaultOptions();
    const selection = [makeItem({})];
    const repo = new InMemoryWorkspaceRepository();

    const { result } = renderHook(
      () => useWorkspaceActionDispatch(options as never),
      { wrapper: makeWrapper(repo) },
    );

    act(() => {
      result.current.handleAction("unknownAction", selection);
    });

    expect(mockDispatch).not.toHaveBeenCalled();
    expect(repo.calls.some((c) => c.method === "getDownloadUrls")).toBe(false);
  });

  it("download: folder item dispatches OPEN_DOWNLOAD_OPTIONS", () => {
    const options = createDefaultOptions();
    const folderItem = makeItem({ name: "myFolder", path: "/user@bvbrc/home/myFolder", type: "folder" });
    options.items = [folderItem];

    const { result } = renderHook(
      () => useWorkspaceActionDispatch(options as never),
      { wrapper: makeWrapper(new InMemoryWorkspaceRepository()) },
    );

    act(() => {
      result.current.handleAction("download", [folderItem]);
    });

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "OPEN_DOWNLOAD_OPTIONS",
        defaultName: "myFolder",
      }),
    );
  });

  it("download: multiple items dispatches OPEN_DOWNLOAD_OPTIONS", () => {
    const options = createDefaultOptions();
    const items = [
      makeItem({ name: "a.txt", path: "/user@bvbrc/home/a.txt" }),
      makeItem({ name: "b.txt", path: "/user@bvbrc/home/b.txt" }),
    ];
    options.items = items;

    const { result } = renderHook(
      () => useWorkspaceActionDispatch(options as never),
      { wrapper: makeWrapper(new InMemoryWorkspaceRepository()) },
    );

    act(() => {
      result.current.handleAction("download", items);
    });

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "OPEN_DOWNLOAD_OPTIONS",
      }),
    );
  });

  it("download: job_result item uses name without leading dot", () => {
    const options = createDefaultOptions();
    const jobItem = makeItem({ name: ".assembly_results", path: "/user@bvbrc/home/.assembly_results", type: "job_result" });
    options.items = [jobItem];

    const { result } = renderHook(
      () => useWorkspaceActionDispatch(options as never),
      { wrapper: makeWrapper(new InMemoryWorkspaceRepository()) },
    );

    act(() => {
      result.current.handleAction("download", [jobItem]);
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
      { wrapper: makeWrapper(new InMemoryWorkspaceRepository()) },
    );

    act(() => {
      result.current.handleAction("download", [dotFolder]);
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
      { wrapper: makeWrapper(new InMemoryWorkspaceRepository()) },
    );

    act(() => {
      result.current.handleAction("favorite", [folderItem]);
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
      { wrapper: makeWrapper(new InMemoryWorkspaceRepository()) },
    );

    act(() => {
      result.current.handleAction("favorite", [folderItem]);
    });

    expect(mockedToggleFavorite).not.toHaveBeenCalled();
  });
});
