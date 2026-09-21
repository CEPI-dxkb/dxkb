import type { WorkspaceItem } from "@/lib/services/workspace/domain";
import {
  buildMiniBrowserItems,
  normalizePath,
  usernameFromWorkspaceRoot,
  type BuildMiniBrowserItemsInput,
} from "@/lib/services/workspace/mini-browser-items";

function makeItem(overrides: Partial<WorkspaceItem> = {}): WorkspaceItem {
  const name = overrides.name ?? "item";
  return {
    id: overrides.path ?? `/alice@bvbrc/home/${name}`,
    name,
    path: `/alice@bvbrc/home/${name}`,
    type: "folder",
    size: 0,
    permissions: { user: "o", global: "n" },
    ...overrides,
  };
}

function build(
  overrides: Partial<BuildMiniBrowserItemsInput> = {},
): WorkspaceItem[] {
  return buildMiniBrowserItems({
    isAtRoot: false,
    userWorkspaces: [],
    shared: [],
    pathItems: [],
    mode: "all",
    showHidden: true,
    ...overrides,
  });
}

const names = (items: WorkspaceItem[]) => items.map((item) => item.name);

describe("normalizePath", () => {
  it("collapses nullish and empty paths to /", () => {
    expect(normalizePath(null)).toBe("/");
    expect(normalizePath(undefined)).toBe("/");
    expect(normalizePath("")).toBe("/");
  });

  it("strips trailing slashes but keeps root as /", () => {
    expect(normalizePath("/alice@bvbrc/home/")).toBe("/alice@bvbrc/home");
    expect(normalizePath("/alice@bvbrc/home///")).toBe("/alice@bvbrc/home");
    expect(normalizePath("/")).toBe("/");
    expect(normalizePath("///")).toBe("/");
  });

  it("leaves an already-normalized path untouched", () => {
    expect(normalizePath("/alice@bvbrc/home")).toBe("/alice@bvbrc/home");
  });
});

describe("usernameFromWorkspaceRoot", () => {
  it("takes the segment before the realm suffix", () => {
    expect(usernameFromWorkspaceRoot("/alice@bvbrc")).toBe("alice");
  });

  it("handles a root without a realm suffix", () => {
    expect(usernameFromWorkspaceRoot("/alice")).toBe("alice");
  });

  it("returns an empty string for an empty root", () => {
    expect(usernameFromWorkspaceRoot("")).toBe("");
  });
});

describe("buildMiniBrowserItems root merging", () => {
  it("lets a user workspace win over a shared entry at the same path", () => {
    const userWorkspace = makeItem({
      name: "mine",
      path: "/alice@bvbrc",
      id: "user-copy",
    });
    const sharedDuplicate = makeItem({
      name: "shared-copy-of-mine",
      path: "/alice@bvbrc",
      id: "shared-copy",
      permissions: { user: "w", global: "n" },
    });

    const result = build({
      isAtRoot: true,
      userWorkspaces: [userWorkspace],
      shared: [sharedDuplicate],
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({ id: "user-copy", name: "mine" }),
    );
  });

  it("drops shared entries without write access", () => {
    const readOnly = makeItem({
      name: "read-only",
      path: "/bob@bvbrc",
      permissions: { user: "r", global: "n" },
    });
    const writable = makeItem({
      name: "writable",
      path: "/carol@bvbrc",
      permissions: { user: "w", global: "n" },
    });
    const noPermissions = makeItem({
      name: "no-permissions",
      path: "/dave@bvbrc",
      permissions: undefined,
    });

    const result = build({
      isAtRoot: true,
      shared: [readOnly, writable, noPermissions],
    });

    expect(names(result)).toEqual(["writable"]);
  });

  it("keeps distinct shared paths alongside user workspaces", () => {
    const result = build({
      isAtRoot: true,
      userWorkspaces: [makeItem({ name: "alice", path: "/alice@bvbrc" })],
      shared: [
        makeItem({
          name: "bob",
          path: "/bob@bvbrc",
          permissions: { user: "a", global: "n" },
        }),
      ],
    });

    expect(names(result)).toEqual(["alice", "bob"]);
  });

  it("ignores pathItems while at root", () => {
    const result = build({
      isAtRoot: true,
      userWorkspaces: [makeItem({ name: "alice", path: "/alice@bvbrc" })],
      pathItems: [makeItem({ name: "should-not-appear" })],
    });

    expect(names(result)).toEqual(["alice"]);
  });
});

describe("buildMiniBrowserItems non-root", () => {
  it("passes through pathItems and ignores the root queries", () => {
    const result = build({
      isAtRoot: false,
      userWorkspaces: [makeItem({ name: "root-only", path: "/alice@bvbrc" })],
      shared: [
        makeItem({
          name: "shared-only",
          path: "/bob@bvbrc",
          permissions: { user: "w", global: "n" },
        }),
      ],
      pathItems: [makeItem({ name: "child" })],
    });

    expect(names(result)).toEqual(["child"]);
  });

  it("returns an empty list when there is nothing to show", () => {
    expect(build()).toEqual([]);
  });
});

describe("buildMiniBrowserItems folders-only mode", () => {
  it("keeps only folder/directory/modelfolder items", () => {
    const pathItems = [
      makeItem({ name: "a-folder", type: "folder" }),
      makeItem({ name: "b-directory", type: "directory" }),
      makeItem({ name: "c-modelfolder", type: "modelfolder" }),
      makeItem({ name: "d-reads", type: "reads" }),
    ];

    expect(names(build({ pathItems, mode: "folders-only" }))).toEqual([
      "a-folder",
      "b-directory",
      "c-modelfolder",
    ]);
  });

  // Deliberate asymmetry: folders-only filters with `isFolder` (which excludes
  // job_result and the *_group types) while the sort uses the wider
  // `isFolderType`. These two assertions pin the real behaviour so the
  // asymmetry cannot be "tidied away" without a failing test.
  it("drops a job_result in folders-only mode", () => {
    const pathItems = [
      makeItem({ name: "a-job", type: "job_result" }),
      makeItem({ name: "b-folder", type: "folder" }),
    ];

    expect(names(build({ pathItems, mode: "folders-only" }))).toEqual([
      "b-folder",
    ]);
  });

  it("still sorts a job_result as a folder in all mode", () => {
    const pathItems = [
      makeItem({ name: "a-file", type: "reads" }),
      makeItem({ name: "z-job", type: "job_result" }),
    ];

    expect(names(build({ pathItems, mode: "all" }))).toEqual([
      "z-job",
      "a-file",
    ]);
  });

  it("drops genome_group, feature_group and experiment_group in folders-only mode", () => {
    const pathItems = [
      makeItem({ name: "genomes", type: "genome_group" }),
      makeItem({ name: "features", type: "feature_group" }),
      makeItem({ name: "experiments", type: "experiment_group" }),
      makeItem({ name: "plain", type: "folder" }),
    ];

    expect(names(build({ pathItems, mode: "folders-only" }))).toEqual([
      "plain",
    ]);
  });

  it("keeps every type in all mode", () => {
    const pathItems = [
      makeItem({ name: "a-reads", type: "reads" }),
      makeItem({ name: "b-folder", type: "folder" }),
    ];

    expect(names(build({ pathItems, mode: "all" }))).toEqual([
      "b-folder",
      "a-reads",
    ]);
  });
});

describe("buildMiniBrowserItems hidden-item filtering", () => {
  it("hides dot-prefixed names when showHidden is false", () => {
    const pathItems = [
      makeItem({ name: ".hidden", type: "folder" }),
      makeItem({ name: "visible", type: "folder" }),
    ];

    expect(names(build({ pathItems, showHidden: false }))).toEqual(["visible"]);
  });

  it("keeps dot-prefixed names when showHidden is true", () => {
    const pathItems = [
      makeItem({ name: ".hidden", type: "folder" }),
      makeItem({ name: "visible", type: "folder" }),
    ];

    expect(names(build({ pathItems, showHidden: true }))).toEqual([
      ".hidden",
      "visible",
    ]);
  });

  it("applies hidden filtering to root-merged items too", () => {
    const result = build({
      isAtRoot: true,
      userWorkspaces: [
        makeItem({ name: ".secret", path: "/alice@bvbrc/.secret" }),
        makeItem({ name: "alice", path: "/alice@bvbrc" }),
      ],
      showHidden: false,
    });

    expect(names(result)).toEqual(["alice"]);
  });
});

describe("buildMiniBrowserItems ordering", () => {
  it("puts folder-like items before files regardless of input order", () => {
    const pathItems = [
      makeItem({ name: "aaa.txt", type: "txt" }),
      makeItem({ name: "zzz-folder", type: "folder" }),
      makeItem({ name: "bbb.txt", type: "txt" }),
      makeItem({ name: "aaa-folder", type: "folder" }),
    ];

    expect(names(build({ pathItems }))).toEqual([
      "aaa-folder",
      "zzz-folder",
      "aaa.txt",
      "bbb.txt",
    ]);
  });

  it("orders names case-insensitively", () => {
    const pathItems = [
      makeItem({ name: "beta", type: "folder" }),
      makeItem({ name: "Alpha", type: "folder" }),
      makeItem({ name: "gamma", type: "folder" }),
      makeItem({ name: "Delta", type: "folder" }),
    ];

    expect(names(build({ pathItems }))).toEqual([
      "Alpha",
      "beta",
      "Delta",
      "gamma",
    ]);
  });

  it("does not mutate or reuse the input arrays", () => {
    const pathItems = [
      makeItem({ name: "zeta", type: "folder" }),
      makeItem({ name: "alpha", type: "folder" }),
    ];
    const pathItemsSnapshot = [...pathItems];
    const userWorkspaces = [makeItem({ name: "u", path: "/alice@bvbrc" })];
    const userWorkspacesSnapshot = [...userWorkspaces];
    const shared = [
      makeItem({
        name: "s",
        path: "/bob@bvbrc",
        permissions: { user: "w", global: "n" },
      }),
    ];
    const sharedSnapshot = [...shared];

    const nonRoot = build({ pathItems });
    expect(names(nonRoot)).toEqual(["alpha", "zeta"]);
    expect(pathItems).toEqual(pathItemsSnapshot);
    expect(nonRoot).not.toBe(pathItems);

    const root = build({ isAtRoot: true, userWorkspaces, shared });
    expect(names(root)).toEqual(["s", "u"]);
    expect(userWorkspaces).toEqual(userWorkspacesSnapshot);
    expect(shared).toEqual(sharedSnapshot);
    expect(root).not.toBe(userWorkspaces);
  });
});
