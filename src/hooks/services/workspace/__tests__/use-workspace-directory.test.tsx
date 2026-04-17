import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { InMemoryWorkspaceRepository } from "@/lib/services/workspace/adapters/in-memory-workspace-repository";
import { WorkspaceRepositoryProvider } from "@/contexts/workspace-repository-context";
import { useWorkspaceDirectory } from "@/hooks/services/workspace/use-workspace-directory";

function makeWrapper(authenticated: InMemoryWorkspaceRepository, publicRepo?: InMemoryWorkspaceRepository) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <WorkspaceRepositoryProvider
          value={{
            authenticated,
            public: publicRepo ?? authenticated,
          }}
        >
          {children}
        </WorkspaceRepositoryProvider>
      </QueryClientProvider>
    );
  };
}

describe("useWorkspaceDirectory", () => {
  it("returns items for home mode", async () => {
    const repo = new InMemoryWorkspaceRepository({
      directories: {
        "/alice@bvbrc/home": [
          { name: "file.fa", type: "contigs" },
          { name: "sub", type: "folder" },
        ],
      },
    });
    const { result } = renderHook(
      () => useWorkspaceDirectory({ kind: "home", username: "alice", path: "" }),
      { wrapper: makeWrapper(repo) },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items.map((i) => i.name)).toEqual(["file.fa", "sub"]);
  });

  it("merges user workspaces and shared root", async () => {
    const repo = new InMemoryWorkspaceRepository({
      directories: {
        "/": [
          {
            name: "sharedByBob",
            type: "folder",
            userPermission: "r",
            globalPermission: "n",
          },
          {
            name: "aliceSelf",
            type: "folder",
            userPermission: "o",
            globalPermission: "n",
          },
        ],
        "/alice@bvbrc": [{ name: "owned-ws", type: "folder" }],
      },
    });
    const { result } = renderHook(
      () => useWorkspaceDirectory({ kind: "sharedRoot", currentUser: "alice" }),
      { wrapper: makeWrapper(repo) },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const names = result.current.items.map((i) => i.name).sort();
    expect(names).toContain("owned-ws");
    expect(names).toContain("sharedByBob");
    expect(names).not.toContain("aliceSelf");
  });

  it("lists shared path contents and derives memberCountByPath", async () => {
    const repo = new InMemoryWorkspaceRepository({
      directories: {
        "/bob@bvbrc/shared": [{ name: "doc.txt", type: "txt" }],
      },
      permissions: {
        "/bob@bvbrc/shared/doc.txt": [
          ["alice", "r"],
          ["carol", "w"],
        ],
      },
    });
    const { result } = renderHook(
      () => useWorkspaceDirectory({ kind: "sharedPath", fullPath: "/bob@bvbrc/shared" }),
      { wrapper: makeWrapper(repo) },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toHaveLength(1);
    await waitFor(() => {
      expect(result.current.memberCountByPath?.["/bob@bvbrc/shared/doc.txt"]).toBe(2);
    });
  });

  it("filters public root to globally permissioned folders", async () => {
    const repo = new InMemoryWorkspaceRepository({
      directories: {
        "/": [
          { name: "public-one", type: "folder", globalPermission: "r" },
          { name: "hidden", type: "folder", globalPermission: "n" },
        ],
      },
    });
    const { result } = renderHook(
      () => useWorkspaceDirectory({ kind: "publicRoot" }),
      { wrapper: makeWrapper(repo, repo) },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items.map((i) => i.name)).toEqual(["public-one"]);
  });

  it("respects enabled=false", async () => {
    const repo = new InMemoryWorkspaceRepository({
      directories: { "/alice@bvbrc/home": [{ name: "x", type: "contigs" }] },
    });
    const { result } = renderHook(
      () =>
        useWorkspaceDirectory(
          { kind: "home", username: "alice", path: "" },
          { enabled: false },
        ),
      { wrapper: makeWrapper(repo) },
    );
    await new Promise((r) => setTimeout(r, 30));
    expect(result.current.items).toEqual([]);
    expect(repo.calls.length).toBe(0);
  });
});
