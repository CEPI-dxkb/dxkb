import { renderHook, waitFor } from "@testing-library/react";
import { createQueryClientWrapper } from "@/test-helpers/api-route-helpers";
import type { WorkspaceBrowserItem } from "@/types/workspace-browser";

vi.mock("@/lib/services/workspace/shared", () => ({
  listSharedWithUser: vi.fn(),
  listUserWorkspaces: vi.fn(),
  getWorkspaceMetadata: vi.fn(),
  listByFullPath: vi.fn(),
  listPermissions: vi.fn(),
}));

import {
  useSharedWithUser,
  useUserWorkspaces,
  useWorkspaceGet,
  useWorkspaceListByPath,
  useWorkspacePermissions,
} from "../use-shared-with-user";
import {
  listSharedWithUser,
  listUserWorkspaces,
  getWorkspaceMetadata,
  listByFullPath,
  listPermissions,
} from "@/lib/services/workspace/shared";

const makeItem = (
  overrides: Partial<WorkspaceBrowserItem> = {},
): WorkspaceBrowserItem =>
  ({
    name: "file.txt",
    path: "/user@bvbrc/home/file.txt",
    type: "txt",
    ...overrides,
  }) as WorkspaceBrowserItem;

describe("useSharedWithUser", () => {
  it("returns shared items on success", async () => {
    const wrapper = createQueryClientWrapper();
    const items = [makeItem({ name: "shared-folder", type: "folder" })];
    vi.mocked(listSharedWithUser).mockResolvedValue(items);

    const { result } = renderHook(
      () => useSharedWithUser({ username: "testuser" }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(items);
    expect(listSharedWithUser).toHaveBeenCalled();
  });

  it("is disabled when username is empty", () => {
    const wrapper = createQueryClientWrapper();
    const { result } = renderHook(
      () => useSharedWithUser({ username: "" }),
      { wrapper },
    );

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

describe("useUserWorkspaces", () => {
  it("returns user workspaces on success", async () => {
    const wrapper = createQueryClientWrapper();
    const items = [makeItem({ name: "home", type: "folder" })];
    vi.mocked(listUserWorkspaces).mockResolvedValue(items);

    const { result } = renderHook(
      () => useUserWorkspaces({ username: "testuser" }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(items);
    expect(listUserWorkspaces).toHaveBeenCalledWith("testuser");
  });

  it("is disabled when username is empty", () => {
    const wrapper = createQueryClientWrapper();
    const { result } = renderHook(
      () => useUserWorkspaces({ username: "" }),
      { wrapper },
    );

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

describe("useWorkspaceGet", () => {
  it("returns metadata on success", async () => {
    const wrapper = createQueryClientWrapper();
    const rawResult = [[["file.txt", "txt", "/user/home/"]]];
    vi.mocked(getWorkspaceMetadata).mockResolvedValue(rawResult);

    const { result } = renderHook(
      () =>
        useWorkspaceGet({ objectPaths: ["/user@bvbrc/home/file.txt"] }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(rawResult);
    expect(getWorkspaceMetadata).toHaveBeenCalledWith([
      "/user@bvbrc/home/file.txt",
    ]);
  });

  it("is disabled when objectPaths is empty", () => {
    const wrapper = createQueryClientWrapper();
    const { result } = renderHook(
      () => useWorkspaceGet({ objectPaths: [] }),
      { wrapper },
    );

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

describe("useWorkspaceListByPath", () => {
  it("returns directory listing on success", async () => {
    const wrapper = createQueryClientWrapper();
    const items = [makeItem({ name: "child.txt" })];
    vi.mocked(listByFullPath).mockResolvedValue(items);

    const { result } = renderHook(
      () =>
        useWorkspaceListByPath({ fullPath: "/user@bvbrc/home" }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(items);
    expect(listByFullPath).toHaveBeenCalledWith("/user@bvbrc/home");
  });

  it("is disabled when fullPath is empty", () => {
    const wrapper = createQueryClientWrapper();
    const { result } = renderHook(
      () => useWorkspaceListByPath({ fullPath: "" }),
      { wrapper },
    );

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});

describe("useWorkspacePermissions", () => {
  it("returns permissions on success", async () => {
    const wrapper = createQueryClientWrapper();
    const permResult = {
      "/user@bvbrc/home": [["user@bvbrc", "o"] as [string, string]],
    };
    vi.mocked(listPermissions).mockResolvedValue(permResult);

    const { result } = renderHook(
      () =>
        useWorkspacePermissions({ paths: ["/user@bvbrc/home"] }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(permResult);
    expect(listPermissions).toHaveBeenCalledWith(["/user@bvbrc/home"]);
  });

  it("is disabled when paths is empty", () => {
    const wrapper = createQueryClientWrapper();
    const { result } = renderHook(
      () => useWorkspacePermissions({ paths: [] }),
      { wrapper },
    );

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});
