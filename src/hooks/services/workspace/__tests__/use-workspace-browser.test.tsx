import { renderHook, waitFor } from "@testing-library/react";
import { createQueryClientWrapper } from "@/test-helpers/api-route-helpers";
import type { WorkspaceBrowserItem } from "@/types/workspace-browser";

const { mockMakeRequest } = vi.hoisted(() => ({
  mockMakeRequest: vi.fn(),
}));

vi.mock("@/lib/services/workspace/client", () => {
  return {
    WorkspaceApiClient: class {
      makeRequest = mockMakeRequest;
    },
  };
});

import { useWorkspaceBrowser } from "../use-workspace-browser";

describe("useWorkspaceBrowser", () => {
  it("appends @bvbrc to username without @ symbol", async () => {
    const wrapper = createQueryClientWrapper();
    mockMakeRequest.mockResolvedValue([]);

    const { result } = renderHook(
      () => useWorkspaceBrowser({ username: "testuser", path: "" }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockMakeRequest).toHaveBeenCalledWith(
      "Workspace.ls",
      [
        {
          paths: ["/testuser@bvbrc/home"],
          includeSubDirs: false,
          recursive: false,
        },
      ],
    );
  });

  it("does not double-append @bvbrc when username contains @", async () => {
    const wrapper = createQueryClientWrapper();
    mockMakeRequest.mockResolvedValue([]);

    const { result } = renderHook(
      () =>
        useWorkspaceBrowser({ username: "testuser@bvbrc", path: "" }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockMakeRequest).toHaveBeenCalledWith(
      "Workspace.ls",
      [
        {
          paths: ["/testuser@bvbrc/home"],
          includeSubDirs: false,
          recursive: false,
        },
      ],
    );
  });

  it("strips leading and trailing slashes from the path", async () => {
    const wrapper = createQueryClientWrapper();
    mockMakeRequest.mockResolvedValue([]);

    const { result } = renderHook(
      () =>
        useWorkspaceBrowser({ username: "user", path: "/subdir/nested/" }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockMakeRequest).toHaveBeenCalledWith(
      "Workspace.ls",
      [
        {
          paths: ["/user@bvbrc/home/subdir/nested"],
          includeSubDirs: false,
          recursive: false,
        },
      ],
    );
  });

  it("uses 'home' as the default base", async () => {
    const wrapper = createQueryClientWrapper();
    mockMakeRequest.mockResolvedValue([]);

    const { result } = renderHook(
      () => useWorkspaceBrowser({ username: "user", path: "docs" }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockMakeRequest).toHaveBeenCalledWith(
      "Workspace.ls",
      [
        {
          paths: ["/user@bvbrc/home/docs"],
          includeSubDirs: false,
          recursive: false,
        },
      ],
    );
  });

  it("uses a custom base when provided", async () => {
    const wrapper = createQueryClientWrapper();
    mockMakeRequest.mockResolvedValue([]);

    const { result } = renderHook(
      () =>
        useWorkspaceBrowser({
          username: "user",
          path: "data",
          base: "shared",
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockMakeRequest).toHaveBeenCalledWith(
      "Workspace.ls",
      [
        {
          paths: ["/user@bvbrc/shared/data"],
          includeSubDirs: false,
          recursive: false,
        },
      ],
    );
  });

  it("calls Workspace.ls and returns items on success", async () => {
    const wrapper = createQueryClientWrapper();
    const items = [
      { name: "file1.txt", path: "/user@bvbrc/home/file1.txt", type: "txt" },
      { name: "file2.csv", path: "/user@bvbrc/home/file2.csv", type: "csv" },
    ] as WorkspaceBrowserItem[];

    mockMakeRequest.mockResolvedValue(items);

    const { result } = renderHook(
      () => useWorkspaceBrowser({ username: "user", path: "" }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(items);
  });

  it("is disabled when username is empty", () => {
    const wrapper = createQueryClientWrapper();
    const { result } = renderHook(
      () => useWorkspaceBrowser({ username: "", path: "some/path" }),
      { wrapper },
    );

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it("is disabled when enabled is false", () => {
    const wrapper = createQueryClientWrapper();
    const { result } = renderHook(
      () =>
        useWorkspaceBrowser({
          username: "user",
          path: "",
          enabled: false,
        }),
      { wrapper },
    );

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });
});
