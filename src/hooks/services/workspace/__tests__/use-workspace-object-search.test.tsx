import { renderHook, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { InMemoryWorkspaceRepository } from "@/lib/services/workspace/adapters/in-memory-workspace-repository";
import { WorkspaceRepositoryProvider } from "@/contexts/workspace-repository-context";
import { useWorkspaceObjectSearch } from "@/hooks/services/workspace/use-workspace-object-search";

function makeWrapper(repo: InMemoryWorkspaceRepository) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <WorkspaceRepositoryProvider value={{ authenticated: repo, public: repo }}>
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
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items.map((i) => i.name)).toEqual(["x.fq"]);
    expect(result.current.objects[0]?.type).toBe("reads");
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
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.search("apple"));
    expect(result.current.filteredItems.map((i) => i.name)).toEqual([
      "apple.fq",
      "apple2.fq",
    ]);
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
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.search("xyz"));
    expect(result.current.filteredItems).toHaveLength(0);
    act(() => result.current.clearSearch());
    expect(result.current.filteredItems).toHaveLength(1);
  });

  it("skips the query when username is empty", async () => {
    const repo = new InMemoryWorkspaceRepository();
    const { result } = renderHook(
      () => useWorkspaceObjectSearch({ username: "" }),
      { wrapper: makeWrapper(repo) },
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current.items).toEqual([]);
    expect(repo.calls.length).toBe(0);
  });
});
