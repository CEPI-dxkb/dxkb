import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { http, HttpResponse } from "msw";
import { WorkspaceRepositoryProvider } from "@/contexts/workspace-repository-context";
import { useWorkspacePickerListing } from "@/hooks/services/workspace/use-workspace-picker-listing";
import { recentWorkspaceFoldersStorageKey } from "@/lib/recent-workspace-folders";
import { InMemoryWorkspaceRepository } from "@/lib/services/workspace/adapters/in-memory-workspace-repository";
import type { PickerLocation } from "@/lib/services/workspace/picker-views";
import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper } from "@/test-helpers/react";

const username = "alice@bvbrc";
const home = "/alice@bvbrc/home";

function makeRepository(errors?: { listDirectory?: Error }) {
  return new InMemoryWorkspaceRepository({
    directories: {
      "/": [{ name: "bob-ws", type: "folder" }],
      "/alice@bvbrc": [{ name: "home", type: "folder" }],
      [home]: [
        { name: "Alpha", type: "folder" },
        { name: "reads.fq", type: "reads" },
      ],
    },
    errors,
  });
}

function makeWrapper(repository: InMemoryWorkspaceRepository) {
  const QueryWrapper = createQueryClientWrapper();
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryWrapper>
        <WorkspaceRepositoryProvider
          value={{ authenticated: repository, public: repository }}
        >
          {children}
        </WorkspaceRepositoryProvider>
      </QueryWrapper>
    );
  };
}

function renderListing(
  location: PickerLocation,
  repository = makeRepository(),
  user = username,
) {
  const rendered = renderHook(
    () => useWorkspacePickerListing({ location, username: user }),
    { wrapper: makeWrapper(repository) },
  );
  return { ...rendered, repository };
}

function listedPaths(repository: InMemoryWorkspaceRepository) {
  return repository.calls.flatMap((call) =>
    call.method === "listDirectory" ? [call.input.path] : [],
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("useWorkspacePickerListing", () => {
  it("lists a folder unfiltered, leaving the filtering to the picker", async () => {
    const { result, repository } = renderListing({ kind: "path", path: home });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items.map((item) => item.name)).toEqual([
      "Alpha",
      "reads.fq",
    ]);
    expect(result.current.error).toBeNull();
    expect(listedPaths(repository)).toEqual([home]);
  });

  it("lists the user's workspace root for My Workspaces", async () => {
    const { result, repository } = renderListing({
      kind: "list",
      view: "myWorkspaces",
    });

    await waitFor(() => {
      expect(result.current.items.map((item) => item.name)).toEqual(["home"]);
    });
    expect(listedPaths(repository)).toEqual(["/alice@bvbrc"]);
  });

  it.each(["shared", "public"] as const)(
    "lists the workspace root for %s",
    async (view) => {
      const { result, repository } = renderListing({ kind: "list", view });

      await waitFor(() => {
        expect(result.current.items.map((item) => item.name)).toEqual([
          "bob-ws",
        ]);
      });
      expect(listedPaths(repository)).toEqual(["/"]);
    },
  );

  it("reports a failed listing with its own message", async () => {
    const { result } = renderListing(
      { kind: "path", path: home },
      makeRepository({ listDirectory: new Error("Workspace is offline") }),
    );

    await waitFor(() => {
      expect(result.current.error?.message).toBe("Workspace is offline");
    });
    expect(result.current.items).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  function serveFavorites(folders: string[]) {
    server.use(
      http.post("*/api/services/workspace", () =>
        HttpResponse.json({
          jsonrpc: "2.0",
          id: 1,
          result: [[[["meta"], JSON.stringify({ folders })]]],
        }),
      ),
    );
  }

  it("turns favorite paths into folder rows", async () => {
    serveFavorites([`${home}/Alpha/`, `${home}/Beta`]);
    const { result, repository } = renderListing({
      kind: "list",
      view: "favorites",
    });

    await waitFor(() => {
      expect(result.current.items).toHaveLength(2);
    });
    expect(result.current.items).toEqual([
      expect.objectContaining({
        name: "Alpha",
        path: `${home}/Alpha`,
        type: "folder",
        ownerId: "alice@bvbrc",
      }),
      expect.objectContaining({ name: "Beta", ownerId: "alice@bvbrc" }),
    ]);
    expect(result.current.isLoading).toBe(false);
    // The user's own folders are always writable, so nothing more is fetched.
    expect(listedPaths(repository)).toEqual([]);
  });

  it("gives a favorite in another user's workspace that workspace's permissions", async () => {
    serveFavorites([`${home}/Alpha`, "/bob@bvbrc/ws/Results"]);
    // In-memory `/` rows are `/${name}`, so the name carries the owner to give
    // the row the real `/owner/workspace` path.
    const repository = new InMemoryWorkspaceRepository({
      directories: {
        "/": [
          {
            name: "bob@bvbrc/ws",
            type: "folder",
            ownerId: "bob@bvbrc",
            userPermission: "w",
            globalPermission: "n",
          },
        ],
      },
    });
    const { result } = renderListing(
      { kind: "list", view: "favorites" },
      repository,
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.items).toEqual([
      expect.objectContaining({ name: "Alpha", permissions: undefined }),
      expect.objectContaining({
        name: "Results",
        ownerId: "bob@bvbrc",
        permissions: { user: "w", global: "n" },
      }),
    ]);
    expect(listedPaths(repository)).toEqual(["/"]);
  });

  it("reports a failed permissions lookup with its own message", async () => {
    serveFavorites(["/bob@bvbrc/ws/Results"]);
    const { result } = renderListing(
      { kind: "list", view: "favorites" },
      makeRepository({ listDirectory: new Error("Workspace is offline") }),
    );

    await waitFor(() => {
      expect(result.current.error?.message).toBe("Workspace is offline");
    });
    expect(result.current.isLoading).toBe(false);
  });

  it("reads recent folders from storage, for this user only, in order", () => {
    localStorage.setItem(
      recentWorkspaceFoldersStorageKey,
      JSON.stringify([
        { path: `${home}/Zeta`, visitedAt: 3 },
        { path: "/bob@bvbrc/home/Mine", visitedAt: 2 },
        { path: `${home}/Alpha`, visitedAt: 1 },
      ]),
    );

    const { result, repository } = renderListing({
      kind: "list",
      view: "recent",
    });

    expect(result.current).toEqual({
      items: [
        expect.objectContaining({ name: "Zeta", path: `${home}/Zeta` }),
        expect.objectContaining({ name: "Alpha", path: `${home}/Alpha` }),
      ],
      isLoading: false,
      error: null,
    });
    expect(listedPaths(repository)).toEqual([]);
  });

  it("lists nothing while signed out", () => {
    const { result, repository } = renderListing(
      { kind: "path", path: home },
      makeRepository(),
      "",
    );

    expect(result.current.items).toEqual([]);
    expect(listedPaths(repository)).toEqual([]);
  });

  it("shares one request between columns that list the same folder", async () => {
    const repository = makeRepository();
    const wrapper = makeWrapper(repository);
    const location = { kind: "path", path: home } as const;
    const first = renderHook(
      () => useWorkspacePickerListing({ location, username }),
      { wrapper },
    );
    const second = renderHook(
      () => useWorkspacePickerListing({ location, username }),
      { wrapper },
    );

    await waitFor(() => {
      expect(first.result.current.items).toHaveLength(2);
      expect(second.result.current.items).toHaveLength(2);
    });
    expect(listedPaths(repository)).toEqual([home]);
  });
});
