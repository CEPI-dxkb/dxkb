import { renderHook, act, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { createQueryClientWrapper } from "@/test-helpers/api-route-helpers";
import {
  getFolderPathsFromItems,
  getNonEmptyFolderPaths,
  ensureDestinationWriteAccess,
} from "@/lib/services/workspace/helpers";
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

vi.mock("@/lib/services/workspace/helpers", () => ({
  getFolderPathsFromItems: vi.fn(() => []),
  getNonEmptyFolderPaths: vi.fn(() => Promise.resolve([])),
  ensureDestinationWriteAccess: vi.fn(() => Promise.resolve({ ok: true })),
}));

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

function createMockOptions(
  overrides?: Partial<UseWorkspaceDialogHandlersOptions>,
): UseWorkspaceDialogHandlersOptions {
  return {
    workspaceCrud: {
      delete: vi.fn(() => Promise.resolve()),
      copyByPaths: vi.fn(() => Promise.resolve()),
      createFolderByPath: vi.fn(() => Promise.resolve()),
      updateObjectType: vi.fn(() => Promise.resolve()),
    } as unknown as UseWorkspaceDialogHandlersOptions["workspaceCrud"],
    workspaceDownload: {
      getDownloadUrls: vi.fn(),
      getArchiveUrl: vi.fn(),
    } as unknown as UseWorkspaceDialogHandlersOptions["workspaceDownload"],
    workspaceClient: {
      makeRequest: vi.fn(),
    } as unknown as UseWorkspaceDialogHandlersOptions["workspaceClient"],
    currentDirectoryPath: "/testuser/home/",
    currentUserWorkspaceRoot: "/testuser@bvbrc",
    username: "testuser",
    myWorkspaceRoot: "/testuser/",
    clearSelection: vi.fn(),
    ...overrides,
  };
}

describe("useWorkspaceDialogHandlers", () => {
  const wrapper = createQueryClientWrapper();

  beforeEach(() => {
    mockActiveDialog.value = null;
  });

  it("handleConfirmDelete calls workspaceCrud.delete with item paths", async () => {
    const item = makeItem({ name: "to-delete.txt", path: "/testuser/home/to-delete.txt" });
    mockActiveDialog.value = {
      type: "delete",
      items: [item],
      nonEmptyPaths: [],
    };

    const options = createMockOptions();
    const { result } = renderHook(
      () => useWorkspaceDialogHandlers(options),
      { wrapper },
    );

    await act(async () => {
      await result.current.handleConfirmDelete();
    });

    await waitFor(() => {
      expect(options.workspaceCrud.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          objects: ["/testuser/home/to-delete.txt"],
          force: true,
          deleteDirectories: true,
        }),
      );
    });
  });

  it("handleConfirmDelete closes dialog when items array is empty", async () => {
    mockActiveDialog.value = {
      type: "delete",
      items: [],
      nonEmptyPaths: [],
    };

    const options = createMockOptions();
    const { result } = renderHook(
      () => useWorkspaceDialogHandlers(options),
      { wrapper },
    );

    await act(async () => {
      await result.current.handleConfirmDelete();
    });

    expect(mockDispatch).toHaveBeenCalledWith({ type: "CLOSE" });
    expect(options.workspaceCrud.delete).not.toHaveBeenCalled();
  });

  it("handleConfirmDelete closes dialog when all items have no path", async () => {
    const item = makeItem({ name: "no-path", path: "" });
    mockActiveDialog.value = {
      type: "delete",
      items: [item],
      nonEmptyPaths: [],
    };

    const options = createMockOptions();
    const { result } = renderHook(
      () => useWorkspaceDialogHandlers(options),
      { wrapper },
    );

    await act(async () => {
      await result.current.handleConfirmDelete();
    });

    expect(mockDispatch).toHaveBeenCalledWith({ type: "CLOSE" });
    expect(options.workspaceCrud.delete).not.toHaveBeenCalled();
  });

  it("handleCopyConfirm calls copyByPaths with source/dest pairs", async () => {
    const item = makeItem({
      name: "copy-me.txt",
      path: "/testuser/home/copy-me.txt",
    });
    mockActiveDialog.value = {
      type: "copy",
      items: [item],
      mode: "copy",
    };

    const options = createMockOptions();
    const { result } = renderHook(
      () => useWorkspaceDialogHandlers(options),
      { wrapper },
    );

    await act(async () => {
      await result.current.handleCopyConfirm("/testuser/home/dest");
    });

    await waitFor(() => {
      expect(options.workspaceCrud.copyByPaths).toHaveBeenCalledWith(
        expect.objectContaining({
          objects: [["/testuser/home/copy-me.txt", "/testuser/home/dest/copy-me.txt"]],
          recursive: true,
          move: false,
        }),
      );
    });
  });

  it("handleCopyConfirm blocks non-folders to root workspace", async () => {
    const item = makeItem({
      name: "file.txt",
      path: "/testuser/home/file.txt",
      type: "contigs",
    });
    mockActiveDialog.value = {
      type: "copy",
      items: [item],
      mode: "copy",
    };

    const options = createMockOptions({
      currentUserWorkspaceRoot: "/testuser@bvbrc",
    });
    const { result } = renderHook(
      () => useWorkspaceDialogHandlers(options),
      { wrapper },
    );

    await act(async () => {
      await result.current.handleCopyConfirm("/testuser@bvbrc");
    });

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("Copying objects to the top level directory"),
    );
    expect(options.workspaceCrud.copyByPaths).not.toHaveBeenCalled();
  });

  it("handleCopyConfirm with move mode passes move: true", async () => {
    const item = makeItem({
      name: "move-me.txt",
      path: "/testuser/home/move-me.txt",
    });
    mockActiveDialog.value = {
      type: "copy",
      items: [item],
      mode: "move",
    };

    const options = createMockOptions();
    const { result } = renderHook(
      () => useWorkspaceDialogHandlers(options),
      { wrapper },
    );

    await act(async () => {
      await result.current.handleCopyConfirm("/testuser/home/dest");
    });

    await waitFor(() => {
      expect(options.workspaceCrud.copyByPaths).toHaveBeenCalledWith(
        expect.objectContaining({
          move: true,
        }),
      );
    });
  });

  it("handleCopyConfirm shows error when ensureDestinationWriteAccess fails", async () => {
    vi.mocked(ensureDestinationWriteAccess).mockResolvedValueOnce({
      ok: false,
      errorMessage: "No write access",
    });

    const item = makeItem({
      name: "file.txt",
      path: "/testuser/home/file.txt",
    });
    mockActiveDialog.value = {
      type: "copy",
      items: [item],
      mode: "copy",
    };

    const options = createMockOptions();
    const { result } = renderHook(
      () => useWorkspaceDialogHandlers(options),
      { wrapper },
    );

    await act(async () => {
      await result.current.handleCopyConfirm("/readonly/dest");
    });

    expect(toast.error).toHaveBeenCalledWith("No write access");
    expect(options.workspaceCrud.copyByPaths).not.toHaveBeenCalled();
  });

  it("handleCreateFolder calls createFolderByPath with parent + name", async () => {
    const options = createMockOptions({
      currentDirectoryPath: "/testuser/home/projects/",
    });
    const { result } = renderHook(
      () => useWorkspaceDialogHandlers(options),
      { wrapper },
    );

    await act(async () => {
      await result.current.handleCreateFolder("New Folder");
    });

    await waitFor(() => {
      expect(options.workspaceCrud.createFolderByPath).toHaveBeenCalledWith(
        "/testuser/home/projects/New Folder",
      );
    });
  });

  it("handleCreateFolder skips empty/whitespace names", async () => {
    const options = createMockOptions();
    const { result } = renderHook(
      () => useWorkspaceDialogHandlers(options),
      { wrapper },
    );

    await act(async () => {
      await result.current.handleCreateFolder("   ");
    });

    expect(options.workspaceCrud.createFolderByPath).not.toHaveBeenCalled();
  });

  it("handleCreateWorkspace creates path with username", async () => {
    const options = createMockOptions({ username: "myuser" });
    const { result } = renderHook(
      () => useWorkspaceDialogHandlers(options),
      { wrapper },
    );

    await act(async () => {
      await result.current.handleCreateWorkspace("my-ws");
    });

    await waitFor(() => {
      expect(options.workspaceCrud.createFolderByPath).toHaveBeenCalledWith(
        "/myuser/my-ws/",
      );
    });
  });

  it("handleEditTypeConfirm calls updateObjectType", async () => {
    const item = makeItem({
      name: "data.txt",
      path: "/testuser/home/data.txt",
      type: "contigs",
    });
    mockActiveDialog.value = {
      type: "editType",
      item,
    };

    const options = createMockOptions();
    const { result } = renderHook(
      () => useWorkspaceDialogHandlers(options),
      { wrapper },
    );

    await act(async () => {
      await result.current.handleEditTypeConfirm("csv");
    });

    await waitFor(() => {
      expect(options.workspaceCrud.updateObjectType).toHaveBeenCalledWith(
        "/testuser/home/data.txt",
        "csv",
      );
    });
  });

  it("useEffect dispatches SET_DELETE_NON_EMPTY_PATHS when delete dialog opens with folders", async () => {
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

    const options = createMockOptions();
    renderHook(
      () => useWorkspaceDialogHandlers(options),
      { wrapper },
    );

    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith({
        type: "SET_DELETE_NON_EMPTY_PATHS",
        paths: ["/testuser/home/my-folder"],
      });
    });
  });

  it("copy onError with overwrite error code -32603 shows 'Can not overwrite' message", async () => {
    const item = makeItem({ name: "dup.txt", path: "/testuser/home/dup.txt" });
    mockActiveDialog.value = { type: "copy", items: [item], mode: "copy" };

    const options = createMockOptions();
    vi.mocked(options.workspaceCrud.copyByPaths as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      Object.assign(new Error("Copy failed"), {
        apiResponse: { error: { code: -32603 } },
      }),
    );

    const { result } = renderHook(
      () => useWorkspaceDialogHandlers(options),
      { wrapper },
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

    const options = createMockOptions();
    vi.mocked(options.workspaceCrud.copyByPaths as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Network problem"),
    );

    const { result } = renderHook(
      () => useWorkspaceDialogHandlers(options),
      { wrapper },
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

    const options = createMockOptions();
    vi.mocked(options.workspaceCrud.copyByPaths as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      Object.assign(new Error("Copy failed"), { apiResponse: "detailed reason" }),
    );

    const { result } = renderHook(
      () => useWorkspaceDialogHandlers(options),
      { wrapper },
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

    const options = createMockOptions();
    const { result } = renderHook(
      () => useWorkspaceDialogHandlers(options),
      { wrapper },
    );

    await act(async () => {
      await result.current.handleCopyConfirm("/testuser/home/dest", "renamed.txt");
    });

    await waitFor(() => {
      expect(options.workspaceCrud.copyByPaths).toHaveBeenCalledWith(
        expect.objectContaining({
          objects: [["/testuser/home/original.txt", "/testuser/home/dest/renamed.txt"]],
        }),
      );
    });
  });

  it("handleCopyConfirm with empty selection does nothing", async () => {
    mockActiveDialog.value = { type: "copy", items: [], mode: "copy" };

    const options = createMockOptions();
    const { result } = renderHook(
      () => useWorkspaceDialogHandlers(options),
      { wrapper },
    );

    await act(async () => {
      await result.current.handleCopyConfirm("/testuser/home/dest");
    });

    expect(options.workspaceCrud.copyByPaths).not.toHaveBeenCalled();
  });

  it("delete mutation onError shows toast.error", async () => {
    const item = makeItem({ name: "undel.txt", path: "/testuser/home/undel.txt" });
    mockActiveDialog.value = { type: "delete", items: [item], nonEmptyPaths: [] };

    const options = createMockOptions();
    vi.mocked(options.workspaceCrud.delete as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Permission denied"),
    );

    const { result } = renderHook(
      () => useWorkspaceDialogHandlers(options),
      { wrapper },
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

    const options = createMockOptions();
    const { result } = renderHook(
      () => useWorkspaceDialogHandlers(options),
      { wrapper },
    );

    await act(async () => {
      await result.current.handleConfirmDelete();
    });

    expect(options.workspaceCrud.delete).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalledWith({ type: "CLOSE" });
  });

  it("handleCopyConfirm closes dialog when items have null path/name", async () => {
    const item = makeItem({ name: null as unknown as string, path: null as unknown as string });
    mockActiveDialog.value = { type: "copy", items: [item], mode: "copy" };

    const options = createMockOptions();
    const { result } = renderHook(
      () => useWorkspaceDialogHandlers(options),
      { wrapper },
    );

    await act(async () => {
      await result.current.handleCopyConfirm("/testuser/home/dest");
    });

    expect(mockDispatch).toHaveBeenCalledWith({ type: "CLOSE" });
    expect(options.workspaceCrud.copyByPaths).not.toHaveBeenCalled();
  });
});
