import { renderHook, waitFor, act } from "@testing-library/react";
import { createQueryClientWrapper } from "@/test-helpers/api-route-helpers";
import { useWorkspaceObjects } from "@/hooks/services/workspace/use-workspace-objects";

const { mockListObjects } = vi.hoisted(() => ({
  mockListObjects: vi.fn(),
}));

vi.mock("@/lib/workspace-client", () => ({
  WorkspaceApi: class MockWorkspaceApi {
    ls = {
      listObjects: mockListObjects,
    };
  },
}));

describe("useWorkspaceObjects", () => {
  it("fetches objects with @bvbrc path format", async () => {
    mockListObjects.mockResolvedValue([
      { name: "file1.txt", type: "file" },
    ]);

    const wrapper = createQueryClientWrapper();
    renderHook(
      () =>
        useWorkspaceObjects({
          user: "alice",
          path: "/home/",
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(mockListObjects).toHaveBeenCalled();
    });

    expect(mockListObjects).toHaveBeenCalledWith(
      expect.objectContaining({
        paths: ["/alice@bvbrc/home/"],
        recursive: true,
      }),
    );
  });

  it("applies type filtering when types are provided", async () => {
    mockListObjects.mockResolvedValue([
      { name: "file1.txt", type: "file" },
      { name: "folder1", type: "folder" },
      { name: "job1", type: "job" },
    ]);

    const wrapper = createQueryClientWrapper();
    const { result } = renderHook(
      () =>
        useWorkspaceObjects({
          user: "alice",
          types: ["file"],
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.objects.length).toBeGreaterThan(0);
    });

    expect(mockListObjects).toHaveBeenCalledWith(
      expect.objectContaining({
        query: { type: ["file"] },
      }),
    );

    // The hook filters results by type as well
    expect(result.current.objects.every((o) => o.type === "file")).toBe(true);
  });

  it("fetches all objects when no types are specified", async () => {
    mockListObjects.mockResolvedValue([
      { name: "file1.txt", type: "file" },
      { name: "folder1", type: "folder" },
    ]);

    const wrapper = createQueryClientWrapper();
    const { result } = renderHook(
      () =>
        useWorkspaceObjects({
          user: "alice",
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.objects).toHaveLength(2);
    });

    // Without types, listObjects is called without a query.type field
    expect(mockListObjects).toHaveBeenCalledWith(
      expect.objectContaining({
        excludeDirectories: false,
        excludeObjects: false,
        recursive: true,
      }),
    );
  });

  it("does not fetch when autoLoad is false", async () => {
    const wrapper = createQueryClientWrapper();
    const { result } = renderHook(
      () =>
        useWorkspaceObjects({
          user: "alice",
          autoLoad: false,
        }),
      { wrapper },
    );

    // Give it a moment to ensure no fetch was triggered
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockListObjects).not.toHaveBeenCalled();
    expect(result.current.objects).toEqual([]);
  });

  it("does not fetch when user is empty", async () => {
    const wrapper = createQueryClientWrapper();
    const { result } = renderHook(
      () =>
        useWorkspaceObjects({
          user: "",
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockListObjects).not.toHaveBeenCalled();
    expect(result.current.objects).toEqual([]);
  });

  it("filters objects by search query on name", async () => {
    mockListObjects.mockResolvedValue([
      { name: "alpha.txt", type: "file" },
      { name: "beta.fasta", type: "file" },
      { name: "gamma.txt", type: "file" },
    ]);

    const wrapper = createQueryClientWrapper();
    const { result } = renderHook(
      () =>
        useWorkspaceObjects({
          user: "alice",
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.objects).toHaveLength(3);
    });

    act(() => {
      result.current.search("alpha");
    });

    expect(result.current.filteredObjects).toHaveLength(1);
    expect(result.current.filteredObjects[0]).toEqual(
      expect.objectContaining({ name: "alpha.txt" }),
    );
  });

  it("clearSearch resets the search query", async () => {
    mockListObjects.mockResolvedValue([
      { name: "alpha.txt", type: "file" },
      { name: "beta.fasta", type: "file" },
    ]);

    const wrapper = createQueryClientWrapper();
    const { result } = renderHook(
      () =>
        useWorkspaceObjects({
          user: "alice",
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.objects).toHaveLength(2);
    });

    act(() => {
      result.current.search("alpha");
    });

    expect(result.current.filteredObjects).toHaveLength(1);

    act(() => {
      result.current.clearSearch();
    });

    expect(result.current.searchQuery).toBe("");
    expect(result.current.filteredObjects).toHaveLength(2);
  });

  it("returns all objects as filteredObjects when search query is empty", async () => {
    mockListObjects.mockResolvedValue([
      { name: "file1.txt", type: "file" },
      { name: "file2.txt", type: "file" },
    ]);

    const wrapper = createQueryClientWrapper();
    const { result } = renderHook(
      () =>
        useWorkspaceObjects({
          user: "alice",
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.objects).toHaveLength(2);
    });

    expect(result.current.filteredObjects).toEqual(result.current.objects);
  });
});
