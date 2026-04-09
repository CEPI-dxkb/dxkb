vi.mock("@/lib/services/workspace/public-client", () => ({
  listPublicWorkspaces: vi.fn(),
  listUserPublicWorkspaces: vi.fn(),
  listPublicWorkspacePath: vi.fn(),
}));

import { renderHook, waitFor } from "@testing-library/react";
import { createQueryClientWrapper } from "@/test-helpers/api-route-helpers";
import { usePublicWorkspaceData } from "../use-public-workspace-data";
import {
  listPublicWorkspaces,
  listUserPublicWorkspaces,
  listPublicWorkspacePath,
} from "@/lib/services/workspace/public-client";
import type { WorkspaceBrowserItem } from "@/types/workspace-browser";

const mockItem: WorkspaceBrowserItem = {
  id: "ws-1",
  name: "test-workspace",
  path: "/user@bvbrc/test-workspace",
  type: "folder",
  creation_time: "2024-01-01",
  link_reference: "",
  owner_id: "user@bvbrc",
  size: 0,
  userMeta: {},
  autoMeta: {},
  user_permission: "o",
  global_permission: "r",
  timestamp: 1704067200,
};

describe("usePublicWorkspaceData", () => {
  describe("level: root", () => {
    it("calls listPublicWorkspaces and returns items", async () => {
      vi.mocked(listPublicWorkspaces).mockResolvedValue([mockItem]);
      const wrapper = createQueryClientWrapper();

      const { result } = renderHook(
        () => usePublicWorkspaceData({ level: "root" }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(listPublicWorkspaces).toHaveBeenCalled();
      expect(result.current.items).toEqual([mockItem]);
      expect(result.current.error).toBeNull();
    });
  });

  describe("level: user", () => {
    it("calls listUserPublicWorkspaces when username is provided", async () => {
      vi.mocked(listUserPublicWorkspaces).mockResolvedValue([mockItem]);
      const wrapper = createQueryClientWrapper();

      const { result } = renderHook(
        () => usePublicWorkspaceData({ level: "user", username: "testuser" }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(listUserPublicWorkspaces).toHaveBeenCalledWith("testuser");
      expect(result.current.items).toEqual([mockItem]);
    });

    it("is disabled when username is empty", () => {
      const wrapper = createQueryClientWrapper();

      const { result } = renderHook(
        () => usePublicWorkspaceData({ level: "user", username: "" }),
        { wrapper },
      );

      expect(result.current.isFetching).toBe(false);
      expect(result.current.items).toEqual([]);
    });

    it("is disabled when username is undefined", () => {
      const wrapper = createQueryClientWrapper();

      const { result } = renderHook(
        () => usePublicWorkspaceData({ level: "user" }),
        { wrapper },
      );

      expect(result.current.isFetching).toBe(false);
      expect(result.current.items).toEqual([]);
    });
  });

  describe("level: path", () => {
    it("calls listPublicWorkspacePath when fullPath is provided", async () => {
      vi.mocked(listPublicWorkspacePath).mockResolvedValue([mockItem]);
      const wrapper = createQueryClientWrapper();

      const { result } = renderHook(
        () =>
          usePublicWorkspaceData({
            level: "path",
            fullPath: "/user@bvbrc/public-ws/subfolder",
          }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(listPublicWorkspacePath).toHaveBeenCalledWith(
        "/user@bvbrc/public-ws/subfolder",
      );
      expect(result.current.items).toEqual([mockItem]);
    });

    it("is disabled when fullPath is empty", () => {
      const wrapper = createQueryClientWrapper();

      const { result } = renderHook(
        () => usePublicWorkspaceData({ level: "path", fullPath: "" }),
        { wrapper },
      );

      expect(result.current.isFetching).toBe(false);
      expect(result.current.items).toEqual([]);
    });

    it("is disabled when fullPath is undefined", () => {
      const wrapper = createQueryClientWrapper();

      const { result } = renderHook(
        () => usePublicWorkspaceData({ level: "path" }),
        { wrapper },
      );

      expect(result.current.isFetching).toBe(false);
      expect(result.current.items).toEqual([]);
    });
  });

  it("returns a stable empty items reference across renders (prevents re-render loops)", () => {
    vi.mocked(listPublicWorkspaces).mockReturnValue(new Promise(vi.fn()));
    const wrapper = createQueryClientWrapper();

    const { result, rerender } = renderHook(
      () => usePublicWorkspaceData({ level: "root" }),
      { wrapper },
    );

    const firstItems = result.current.items;
    rerender();
    const secondItems = result.current.items;

    // Must be the same reference to avoid infinite re-render loops
    // in consumers that use the array as a dependency.
    expect(firstItems).toBe(secondItems);
  });

  it("returns empty items array when query has no data yet", () => {
    vi.mocked(listPublicWorkspaces).mockReturnValue(new Promise(vi.fn()));
    const wrapper = createQueryClientWrapper();

    const { result } = renderHook(
      () => usePublicWorkspaceData({ level: "root" }),
      { wrapper },
    );

    expect(result.current.items).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });

  it("exposes error when the query fails", async () => {
    vi.mocked(listPublicWorkspaces).mockRejectedValue(new Error("Network error"));
    const wrapper = createQueryClientWrapper();

    const { result } = renderHook(
      () => usePublicWorkspaceData({ level: "root" }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.error).not.toBeNull());

    expect(result.current.error?.message).toBe("Network error");
    expect(result.current.items).toEqual([]);
  });
});
