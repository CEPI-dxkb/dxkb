import { renderHook, act, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getFolderPathsFromItems,
  getNonEmptyFolderPaths,
  ensureDestinationWriteAccess,
} from "@/lib/services/workspace/helpers";
import { InMemoryWorkspaceRepository } from "@/lib/services/workspace/adapters/in-memory-workspace-repository";
import { WorkspaceApiError } from "@/lib/services/workspace/domain";
import { WorkspaceRepositoryProvider } from "@/contexts/workspace-repository-context";
import type { WorkspaceBrowserItem } from "@/types/workspace-browser";
import {
  useWorkspaceDialogHandlers,
  type UseWorkspaceDialogHandlersOptions,
} from "@/hooks/services/workspace/use-workspace-dialog-handlers";

const { mockDispatch, mockActiveDialog } = vi.hoisted(() => ({
  mockDispatch: vi.fn(),
  mockActiveDialog: { value: null as unknown },
}));

vi.mock("@/contexts/workspace-dialog-context", () => ({
  useWorkspaceDialog: () => ({
    dispatch: mockDispatch,
    state: {
      get activeDialog() {
        return mockActiveDialog.value;
      },
    },
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/services/workspace/helpers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/workspace/helpers")>(
    "@/lib/services/workspace/helpers",
  );
  return {
    ...actual,
    getFolderPathsFromItems: vi.fn(() => []),
    getNonEmptyFolderPaths: vi.fn(() => Promise.resolve([])),
    ensureDestinationWriteAccess: vi.fn(() => Promise.resolve({ ok: true })),
  };
});

vi.mock("@/lib/services/workspace/utils", () => ({
  isFolder: vi.fn((type: string) => type === "folder"),
}));

vi.mock("@/lib/utils", () => ({
  sanitizePathSegment: vi.fn((s: string) => s),
}));

const makeItem = (
  overrides: Partial<WorkspaceBrowserItem>,
): WorkspaceBrowserItem =>
  ({
    id: "item-1",
    name: "file.txt",
    path: "/testuser/home/file.txt",
    type: "contigs",
    creation_time: "2025-01-01",
    link_reference: "",
    owner_id: "testuser",
    size: 100,
    userMeta: {},
    autoMeta: {},
    user_permission: "o",
    global_permission: "n",
    timestamp: 0,
    ...overrides,
  }) as WorkspaceBrowserItem;

function defaultOptions(
  overrides?: Partial<UseWorkspaceDialogHandlersOptions>,
): UseWorkspaceDialogHandlersOptions {
  return {
    currentDirectoryPath: "/testuser/home/",
    currentUserWorkspaceRoot: "/testuser@bvbrc",
    username: "testuser",
    myWorkspaceRoot: "/testuser/",
    clearSelection: vi.fn(),
    ...overrides,
  };
}

function makeWrapper(repo: InMemoryWorkspaceRepository) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
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

describe("useWorkspaceDialogHandlers", () => {
  beforeEach(() => {
    mockActiveDialog.value = null;
    vi.clearAllMocks();
  });

  it("handleConfirmDelete calls repository.delete with item paths", async () => {
    const item = makeItem({ name: "to-delete.txt", path: "/testuser/home/to-delete.txt" });
    mockActiveDialog.value = { type: "delete", items: [item], nonEmptyPaths: [] };
    const repo = new InMemoryWorkspaceRepository();

    const { result } = renderHook(
      () => useWorkspaceDialogHandlers(defaultOptions()),
      { wrapper: makeWrapper(repo) },
    );

    await act(async () => {
      await result.current.handleConfirmDelete();
    });

    await waitFor(() => {
      const deleteCall = repo.calls.find((c) => c.method === "delete");
      expect(deleteCall).toEqual({
        method: "delete",
        paths: ["/testuser/home/to-delete.txt"],
        options: { force: true, deleteDirectories: true },
      });
    });
  });

  it("handleConfirmDelete closes dialog when items array is empty", async () => {
    mockActiveDialog.value = { type: "delete", items: [], nonEmptyPaths: [] };
    const repo = new InMemoryWorkspaceRepository();

    const { result } = renderHook(
      () => useWorkspaceDialogHandlers(defaultOptions()),
      { wrapper: makeWrapper(repo) },
    );
    await act(async () => {
      await result.current.handleConfirmDelete();
    });

    expect(mockDispatch).toHaveBeenCalledWith({ type: "CLOSE" });
    expect(repo.calls.some((c) => c.method === "delete")).toBe(false);
  });

  it("handleConfirmDelete closes dialog when all items have no path", async () => {
    const item = makeItem({ name: "no-path", path: "" });
    mockActiveDialog.value = { type: "delete", items: [item], nonEmptyPaths: [] };
    const repo = new InMemoryWorkspaceRepository();

    const { result } = renderHook(
      () => useWorkspaceDialogHandlers(defaultOptions()),
      { wrapper: makeWrapper(repo) },
    );
    await act(async () => {
      await result.current.handleConfirmDelete();
    });

    expect(mockDispatch).toHaveBeenCalledWith({ type: "CLOSE" });
    expect(repo.calls.some((c) => c.method === "delete")).toBe(false);
  });

  it("handleCopyConfirm calls repository.copy with source/dest pairs", async () => {
    const item = makeItem({ name: "copy-me.txt", path: "/testuser/home/copy-me.txt" });
    mockActiveDialog.value = { type: "copy", items: [item], mode: "copy" };
    const repo = new InMemoryWorkspaceRepository();

    const { result } = renderHook(
      () => useWorkspaceDialogHandlers(defaultOptions()),
      { wrapper: makeWrapper(repo) },
    );
    await act(async () => {
      await result.current.handleCopyConfirm("/testuser/home/dest");
    });

    await waitFor(() => {
      const copyCall = repo.calls.find((c) => c.method === "copy");
      expect(copyCall).toEqual({
        method: "copy",
        input: {
          pairs: [["/testuser/home/copy-me.txt", "/testuser/home/dest/copy-me.txt"]],
          recursive: true,
          move: false,
        },
      });
    });
  });

  it("handleCopyConfirm blocks non-folders to root workspace", async () => {
    const item = makeItem({ name: "file.txt", path: "/testuser/home/file.txt", type: "contigs" });
    mockActiveDialog.value = { type: "copy", items: [item], mode: "copy" };
    const repo = new InMemoryWorkspaceRepository();

    const { result } = renderHook(
      () =>
        useWorkspaceDialogHandlers(
          defaultOptions({ currentUserWorkspaceRoot: "/testuser@bvbrc" }),
        ),
      { wrapper: makeWrapper(repo) },
    );
    await act(async () => {
      await result.current.handleCopyConfirm("/testuser@bvbrc");
    });

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("Copying objects to the top level directory"),
    );
    expect(repo.calls.some((c) => c.method === "copy")).toBe(false);
  });

  it("handleCopyConfirm with move mode passes move: true", async () => {
    const item = makeItem({ name: "move-me.txt", path: "/testuser/home/move-me.txt" });
    mockActiveDialog.value = { type: "copy", items: [item], mode: "move" };
    const repo = new InMemoryWorkspaceRepository();

    const { result } = renderHook(
      () => useWorkspaceDialogHandlers(defaultOptions()),
      { wrapper: makeWrapper(repo) },
    );
    await act(async () => {
      await result.current.handleCopyConfirm("/testuser/home/dest");
    });

    await waitFor(() => {
      const copyCall = repo.calls.find((c) => c.method === "copy");
      expect(copyCall).toMatchObject({ method: "copy", input: { move: true } });
    });
  });

  it("handleCopyConfirm shows error when ensureDestinationWriteAccess fails", async () => {
    vi.mocked(ensureDestinationWriteAccess).mockResolvedValueOnce({
      ok: false,
      errorMessage: "No write access",
    });
    const item = makeItem({ name: "file.txt", path: "/testuser/home/file.txt" });
    mockActiveDialog.value = { type: "copy", items: [item], mode: "copy" };
    const repo = new InMemoryWorkspaceRepository();

    const { result } = renderHook(
      () => useWorkspaceDialogHandlers(defaultOptions()),
      { wrapper: makeWrapper(repo) },
    );
    await act(async () => {
      await result.current.handleCopyConfirm("/readonly/dest");
    });

    expect(toast.error).toHaveBeenCalledWith("No write access");
    expect(repo.calls.some((c) => c.method === "copy")).toBe(false);
  });

  it("handleCreateFolder calls repository.createFolder with parent + name", async () => {
    const repo = new InMemoryWorkspaceRepository();

    const { result } = renderHook(
      () =>
        useWorkspaceDialogHandlers(
          defaultOptions({ currentDirectoryPath: "/testuser/home/projects/" }),
        ),
      { wrapper: makeWrapper(repo) },
    );
    await act(async () => {
      await result.current.handleCreateFolder("New Folder");
    });

    await waitFor(() => {
      const call = repo.calls.find((c) => c.method === "createFolder");
      expect(call).toEqual({
        method: "createFolder",
        path: "/testuser/home/projects/New Folder",
      });
    });
  });

  it("handleCreateFolder skips empty/whitespace names", async () => {
    const repo = new InMemoryWorkspaceRepository();

    const { result } = renderHook(
      () => useWorkspaceDialogHandlers(defaultOptions()),
      { wrapper: makeWrapper(repo) },
    );
    await act(async () => {
      await result.current.handleCreateFolder("   ");
    });

    expect(repo.calls.some((c) => c.method === "createFolder")).toBe(false);
  });

  it("handleCreateWorkspace creates path with username", async () => {
    const repo = new InMemoryWorkspaceRepository();

    const { result } = renderHook(
      () =>
        useWorkspaceDialogHandlers(defaultOptions({ username: "myuser" })),
      { wrapper: makeWrapper(repo) },
    );
    await act(async () => {
      await result.current.handleCreateWorkspace("my-ws");
    });

    await waitFor(() => {
      const call = repo.calls.find((c) => c.method === "createFolder");
      expect(call).toEqual({ method: "createFolder", path: "/myuser/my-ws/" });
    });
  });

  it("handleEditTypeConfirm calls repository.updateObjectType", async () => {
    const item = makeItem({ name: "data.txt", path: "/testuser/home/data.txt", type: "contigs" });
    mockActiveDialog.value = { type: "editType", item };
    const repo = new InMemoryWorkspaceRepository();

    const { result } = renderHook(
      () => useWorkspaceDialogHandlers(defaultOptions()),
      { wrapper: makeWrapper(repo) },
    );
    await act(async () => {
      await result.current.handleEditTypeConfirm("csv");
    });

    await waitFor(() => {
      const call = repo.calls.find((c) => c.method === "updateObjectType");
      expect(call).toEqual({
        method: "updateObjectType",
        path: "/testuser/home/data.txt",
        newType: "csv",
      });
    });
  });

  it("dispatches SET_DELETE_NON_EMPTY_PATHS when delete dialog opens with folders", async () => {
    const folderItem = makeItem({
      name: "my-folder",
      path: "/testuser/home/my-folder",
      type: "folder",
    });

    vi.mocked(getFolderPathsFromItems).mockReturnValue([
      "/testuser/home/my-folder",
    ]);
    vi.mocked(getNonEmptyFolderPaths).mockResolvedValue([
      "/testuser/home/my-folder",
    ]);

    mockActiveDialog.value = {
      type: "delete",
      items: [folderItem],
      nonEmptyPaths: [],
    };
    const repo = new InMemoryWorkspaceRepository();

    renderHook(() => useWorkspaceDialogHandlers(defaultOptions()), {
      wrapper: makeWrapper(repo),
    });

    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith({
        type: "SET_DELETE_NON_EMPTY_PATHS",
        paths: ["/testuser/home/my-folder"],
      });
    });
  });

  it("copy onError with overwrite error code -32603 shows 'Can not overwrite'", async () => {
    const item = makeItem({ name: "dup.txt", path: "/testuser/home/dup.txt" });
    mockActiveDialog.value = { type: "copy", items: [item], mode: "copy" };
    const repo = new InMemoryWorkspaceRepository({
      errors: {
        copy: new WorkspaceApiError("Copy failed", "Workspace.copy", {
          error: { code: -32603 },
        }),
      },
    });

    const { result } = renderHook(
      () => useWorkspaceDialogHandlers(defaultOptions()),
      { wrapper: makeWrapper(repo) },
    );
    await act(async () => {
      await result.current.handleCopyConfirm("/testuser/home/dest");
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("Can not overwrite"),
        expect.anything(),
      );
    });
  });

  it("copy onError with generic error shows err.message", async () => {
    const item = makeItem({ name: "fail.txt", path: "/testuser/home/fail.txt" });
    mockActiveDialog.value = { type: "copy", items: [item], mode: "copy" };
    const repo = new InMemoryWorkspaceRepository({
      errors: { copy: new Error("Network problem") },
    });

    const { result } = renderHook(
      () => useWorkspaceDialogHandlers(defaultOptions()),
      { wrapper: makeWrapper(repo) },
    );
    await act(async () => {
      await result.current.handleCopyConfirm("/testuser/home/dest");
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Network problem", expect.anything());
    });
  });

  it("copy onError with string apiResponse shows it as description", async () => {
    const item = makeItem({ name: "err.txt", path: "/testuser/home/err.txt" });
    mockActiveDialog.value = { type: "copy", items: [item], mode: "copy" };
    const repo = new InMemoryWorkspaceRepository({
      errors: {
        copy: new WorkspaceApiError(
          "Copy failed",
          "Workspace.copy",
          "detailed reason",
        ),
      },
    });

    const { result } = renderHook(
      () => useWorkspaceDialogHandlers(defaultOptions()),
      { wrapper: makeWrapper(repo) },
    );
    await act(async () => {
      await result.current.handleCopyConfirm("/testuser/home/dest");
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Copy failed",
        expect.objectContaining({ description: "detailed reason" }),
      );
    });
  });

  it("handleCopyConfirm with filenameOverride uses override for first item", async () => {
    const item = makeItem({ name: "original.txt", path: "/testuser/home/original.txt" });
    mockActiveDialog.value = { type: "copy", items: [item], mode: "copy" };
    const repo = new InMemoryWorkspaceRepository();

    const { result } = renderHook(
      () => useWorkspaceDialogHandlers(defaultOptions()),
      { wrapper: makeWrapper(repo) },
    );
    await act(async () => {
      await result.current.handleCopyConfirm("/testuser/home/dest", "renamed.txt");
    });

    await waitFor(() => {
      const copyCall = repo.calls.find((c) => c.method === "copy");
      expect(copyCall).toMatchObject({
        method: "copy",
        input: {
          pairs: [["/testuser/home/original.txt", "/testuser/home/dest/renamed.txt"]],
        },
      });
    });
  });

  it("handleCopyConfirm with empty selection does nothing", async () => {
    mockActiveDialog.value = { type: "copy", items: [], mode: "copy" };
    const repo = new InMemoryWorkspaceRepository();

    const { result } = renderHook(
      () => useWorkspaceDialogHandlers(defaultOptions()),
      { wrapper: makeWrapper(repo) },
    );
    await act(async () => {
      await result.current.handleCopyConfirm("/testuser/home/dest");
    });

    expect(repo.calls.some((c) => c.method === "copy")).toBe(false);
  });

  it("delete mutation onError shows toast.error", async () => {
    const item = makeItem({ name: "undel.txt", path: "/testuser/home/undel.txt" });
    mockActiveDialog.value = { type: "delete", items: [item], nonEmptyPaths: [] };
    const repo = new InMemoryWorkspaceRepository({
      errors: { delete: new Error("Permission denied") },
    });

    const { result } = renderHook(
      () => useWorkspaceDialogHandlers(defaultOptions()),
      { wrapper: makeWrapper(repo) },
    );
    await act(async () => {
      await result.current.handleConfirmDelete();
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Permission denied");
    });
  });

  it("handleConfirmDelete returns early when dialog type is not delete", async () => {
    mockActiveDialog.value = { type: "copy", items: [], mode: "copy" };
    const repo = new InMemoryWorkspaceRepository();

    const { result } = renderHook(
      () => useWorkspaceDialogHandlers(defaultOptions()),
      { wrapper: makeWrapper(repo) },
    );
    await act(async () => {
      await result.current.handleConfirmDelete();
    });

    expect(repo.calls.some((c) => c.method === "delete")).toBe(false);
    expect(mockDispatch).not.toHaveBeenCalledWith({ type: "CLOSE" });
  });

  it("handleCopyConfirm closes dialog when items have null path/name", async () => {
    const item = makeItem({ name: null as unknown as string, path: null as unknown as string });
    mockActiveDialog.value = { type: "copy", items: [item], mode: "copy" };
    const repo = new InMemoryWorkspaceRepository();

    const { result } = renderHook(
      () => useWorkspaceDialogHandlers(defaultOptions()),
      { wrapper: makeWrapper(repo) },
    );
    await act(async () => {
      await result.current.handleCopyConfirm("/testuser/home/dest");
    });

    expect(mockDispatch).toHaveBeenCalledWith({ type: "CLOSE" });
    expect(repo.calls.some((c) => c.method === "copy")).toBe(false);
  });
});
