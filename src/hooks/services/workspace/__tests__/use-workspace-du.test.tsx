import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { InMemoryWorkspaceRepository } from "@/lib/services/workspace/adapters/in-memory-workspace-repository";
import { WorkspaceRepositoryProvider } from "@/contexts/workspace-repository-context";

import { useWorkspaceDu } from "../use-workspace-du";

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

describe("useWorkspaceDu", () => {
  it("maps the tuple response to { sizeBytes, files, folders }", async () => {
    const repo = new InMemoryWorkspaceRepository({
      diskUsage: { "/user@bvbrc/home": [1024, 10, 3, ""] },
    });

    const { result } = renderHook(
      () => useWorkspaceDu("/user@bvbrc/home"),
      { wrapper: makeWrapper(repo) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      sizeBytes: 1024,
      files: 10,
      folders: 3,
    });
  });

  it("returns zeros when the repository has no entry", async () => {
    const repo = new InMemoryWorkspaceRepository();
    const { result } = renderHook(
      () => useWorkspaceDu("/user@bvbrc/home"),
      { wrapper: makeWrapper(repo) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      sizeBytes: 0,
      files: 0,
      folders: 0,
    });
  });

  it("is disabled when path is null", () => {
    const repo = new InMemoryWorkspaceRepository();
    const { result } = renderHook(() => useWorkspaceDu(null), {
      wrapper: makeWrapper(repo),
    });

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(repo.calls.length).toBe(0);
  });

  it("calls repository.diskUsage with the requested path", async () => {
    const repo = new InMemoryWorkspaceRepository({
      diskUsage: { "/user@bvbrc/home": [500, 5, 2, ""] },
    });

    const { result } = renderHook(
      () => useWorkspaceDu("/user@bvbrc/home"),
      { wrapper: makeWrapper(repo) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const call = repo.calls.find((c) => c.method === "diskUsage");
    expect(call).toEqual({
      method: "diskUsage",
      paths: ["/user@bvbrc/home"],
      recursive: true,
    });
  });
});
