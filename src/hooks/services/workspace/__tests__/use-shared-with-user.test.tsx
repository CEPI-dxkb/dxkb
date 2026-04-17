import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WorkspaceRepositoryProvider } from "@/contexts/workspace-repository-context";
import { InMemoryWorkspaceRepository } from "@/lib/services/workspace/adapters/in-memory-workspace-repository";
import {
  useSharedWithUser,
  useUserWorkspaces,
} from "@/hooks/services/workspace/use-shared-with-user";

function makeWrapper(repo: InMemoryWorkspaceRepository) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
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

describe("use-shared-with-user", () => {
  it("lists shared root entries through the repository", async () => {
    const repo = new InMemoryWorkspaceRepository({
      directories: {
        "/": [
          {
            name: "shared-by-bob",
            type: "folder",
            userPermission: "r",
            globalPermission: "n",
          },
          {
            name: "owned-by-me",
            type: "folder",
            userPermission: "o",
            globalPermission: "n",
          },
          {
            name: "public-data",
            type: "folder",
            userPermission: "r",
            globalPermission: "r",
          },
        ],
      },
    });

    const { result } = renderHook(
      () => useSharedWithUser({ username: "alice" }),
      { wrapper: makeWrapper(repo) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data?.map((item) => item.name)).toEqual([
      "shared-by-bob",
    ]);
    expect(repo.calls).toEqual([
      { method: "listDirectory", input: { path: "/" } },
    ]);
  });

  it("lists user workspaces through the repository", async () => {
    const repo = new InMemoryWorkspaceRepository({
      directories: {
        "/alice@bvbrc": [{ name: "workspace-a", type: "folder" }],
      },
    });

    const { result } = renderHook(
      () => useUserWorkspaces({ username: "alice" }),
      { wrapper: makeWrapper(repo) },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data?.map((item) => item.path)).toEqual([
      "/alice@bvbrc/workspace-a",
    ]);
    expect(repo.calls).toEqual([
      { method: "listDirectory", input: { path: "/alice@bvbrc" } },
    ]);
  });
});
