import { renderHook, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { InMemoryWorkspaceRepository } from "@/lib/services/workspace/adapters/in-memory-workspace-repository";
import { WorkspaceRepositoryProvider } from "@/contexts/workspace-repository-context";
import {
  assertUniqueWorkspaceObjectPaths,
  useWorkspaceObjectSearch,
} from "@/hooks/services/workspace/use-workspace-object-search";
import type { WorkspaceItem } from "@/lib/services/workspace/domain";

function makeWrapper(repo: InMemoryWorkspaceRepository) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <WorkspaceRepositoryProvider
          value={{ authenticated: repo, public: repo }}
        >
          {children}
        </WorkspaceRepositoryProvider>
      </QueryClientProvider>
    );
  };
}

describe("useWorkspaceObjectSearch", () => {
  it("returns workspace items filtered by type preset", async () => {
    const repo = new InMemoryWorkspaceRepository({
      directories: {
        "/alice@bvbrc/home": [
          { name: "x.fq", type: "reads" },
          { name: "y.fa", type: "contigs" },
        ],
      },
    });
    const { result } = renderHook(
      () => useWorkspaceObjectSearch({ username: "alice", types: ["reads"] }),
      { wrapper: makeWrapper(repo) },
    );
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.items.map((i) => i.name)).toEqual(["x.fq"]);
    expect(result.current.objects[0]?.type).toBe("reads");
  });

  it("lists once per distinct type set, sending the types to the server", async () => {
    const repo = new InMemoryWorkspaceRepository({
      directories: {
        "/alice@bvbrc/home": [
          { name: "x.fq", type: "reads" },
          { name: "y.fa", type: "contigs" },
          { name: "out", type: "folder" },
        ],
      },
    });
    const { result } = renderHook(
      () => ({
        reads1: useWorkspaceObjectSearch({ username: "alice", types: ["reads"] }),
        reads2: useWorkspaceObjectSearch({ username: "alice", types: ["reads"] }),
        mixed1: useWorkspaceObjectSearch({
          username: "alice",
          types: ["reads", "contigs"],
        }),
        mixed2: useWorkspaceObjectSearch({
          username: "alice",
          types: ["contigs", "reads"],
        }),
        untyped: useWorkspaceObjectSearch({ username: "alice" }),
        empty: useWorkspaceObjectSearch({ username: "alice", types: [] }),
      }),
      { wrapper: makeWrapper(repo) },
    );

    await waitFor(() => {
      expect(result.current.reads1.items.map((i) => i.name)).toEqual(["x.fq"]);
    });
    await waitFor(() => {
      expect(result.current.untyped.loading).toBe(false);
    });
    expect(result.current.reads2.items.map((i) => i.name)).toEqual(["x.fq"]);
    expect(result.current.mixed1.items.map((i) => i.name).sort()).toEqual([
      "x.fq",
      "y.fa",
    ]);
    expect(result.current.mixed2.items).toEqual(result.current.mixed1.items);
    // An empty type list means every type, as the repository reads it.
    expect(result.current.empty.items).toEqual(result.current.untyped.items);
    expect(result.current.untyped.items).toHaveLength(3);

    // Same type set (in any order) shares a query; each distinct set, and
    // the untyped one, is listed once, with its filter sent to the server.
    const searchedTypes = repo.calls.flatMap((call) =>
      call.method === "searchObjects" ? [call.input.types] : [],
    );
    expect(searchedTypes).toHaveLength(3);
    expect(searchedTypes).toEqual(
      expect.arrayContaining([["reads"], ["reads", "contigs"], undefined]),
    );
  });

  it("sends an empty type list as no filter, whichever field asks first", async () => {
    const repo = new InMemoryWorkspaceRepository({
      directories: {
        "/alice@bvbrc/home": [
          { name: "x.fq", type: "reads" },
          { name: "y.fa", type: "contigs" },
        ],
      },
    });
    const { result } = renderHook(
      () => ({
        empty: useWorkspaceObjectSearch({ username: "alice", types: [] }),
        untyped: useWorkspaceObjectSearch({ username: "alice" }),
      }),
      { wrapper: makeWrapper(repo) },
    );

    await waitFor(() => {
      expect(result.current.empty.loading).toBe(false);
    });
    expect(result.current.empty.items).toHaveLength(2);
    expect(result.current.untyped.items).toEqual(result.current.empty.items);
    const searchedTypes = repo.calls.flatMap((call) =>
      call.method === "searchObjects" ? [call.input.types] : [],
    );
    expect(searchedTypes).toEqual([undefined]);
  });

  it("filters by searchQuery", async () => {
    const repo = new InMemoryWorkspaceRepository({
      directories: {
        "/alice@bvbrc/home": [
          { name: "apple.fq", type: "reads" },
          { name: "banana.fq", type: "reads" },
          { name: "apple2.fq", type: "reads" },
        ],
      },
    });
    const { result } = renderHook(
      () => useWorkspaceObjectSearch({ username: "alice" }),
      { wrapper: makeWrapper(repo) },
    );
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    act(() => {
      result.current.search("apple");
    });
    expect(result.current.filteredItems.map((i) => i.name)).toEqual([
      "apple.fq",
      "apple2.fq",
    ]);
  });

  it("throws when search results contain duplicate paths", () => {
    const item = {
      id: "first-id",
      name: "duplicate.fq",
      path: "/alice@bvbrc/home/duplicate.fq",
      type: "reads",
      size: 1,
    } satisfies WorkspaceItem;

    expect(() =>
      assertUniqueWorkspaceObjectPaths([item, { ...item, id: "second-id" }]),
    ).toThrow(
      "Workspace search returned duplicate object path: /alice@bvbrc/home/duplicate.fq",
    );
  });

  it("reports duplicate paths through the query error state", async () => {
    const repo = new InMemoryWorkspaceRepository();
    const item = {
      id: "first-id",
      name: "duplicate.fq",
      path: "/alice@bvbrc/home/duplicate.fq",
      type: "reads",
      size: 1,
    } satisfies WorkspaceItem;
    vi.spyOn(repo, "searchObjects").mockResolvedValue([
      item,
      { ...item, id: "second-id" },
    ]);

    const { result } = renderHook(
      () => useWorkspaceObjectSearch({ username: "alice" }),
      { wrapper: makeWrapper(repo) },
    );

    await waitFor(() => {
      expect(result.current.error).toBe(
        "Workspace search returned duplicate object path: /alice@bvbrc/home/duplicate.fq",
      );
    });
    expect(result.current.items).toEqual([]);
  });

  it("allows a repeated backend id when paths are distinct", () => {
    const items = [
      {
        id: "shared-id",
        name: "first.fq",
        path: "/alice@bvbrc/home/first.fq",
        type: "reads",
        size: 1,
      },
      {
        id: "shared-id",
        name: "second.fq",
        path: "/alice@bvbrc/home/second.fq",
        type: "reads",
        size: 1,
      },
    ] satisfies WorkspaceItem[];

    expect(assertUniqueWorkspaceObjectPaths(items)).toBe(items);
  });

  it("throws when a search result has no path", () => {
    expect(() =>
      assertUniqueWorkspaceObjectPaths([
        {
          id: "missing-path-id",
          name: "missing.fq",
          path: "",
          type: "reads",
          size: 1,
        },
      ]),
    ).toThrow(
      "Workspace search returned an object without a path: missing-path-id",
    );
  });

  it("clearSearch resets the filter", async () => {
    const repo = new InMemoryWorkspaceRepository({
      directories: {
        "/alice@bvbrc/home": [{ name: "only.fq", type: "reads" }],
      },
    });
    const { result } = renderHook(
      () => useWorkspaceObjectSearch({ username: "alice" }),
      { wrapper: makeWrapper(repo) },
    );
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    act(() => {
      result.current.search("xyz");
    });
    expect(result.current.filteredItems).toHaveLength(0);
    act(() => {
      result.current.clearSearch();
    });
    expect(result.current.filteredItems).toHaveLength(1);
  });

  it("skips the query when username is empty", async () => {
    const repo = new InMemoryWorkspaceRepository();
    const { result } = renderHook(
      () => useWorkspaceObjectSearch({ username: "" }),
      { wrapper: makeWrapper(repo) },
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current.items).toHaveLength(0);
    expect(result.current.objects).toHaveLength(0);
    expect(result.current.filteredItems).toHaveLength(0);
    expect(result.current.filteredObjects).toHaveLength(0);
    expect(repo.calls.length).toBe(0);
  });
});
