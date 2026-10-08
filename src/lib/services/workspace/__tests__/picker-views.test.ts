import type { WorkspaceItem } from "../domain";
import {
  buildPickerItems,
  canWriteTo,
  emptyListingMessage,
  filterListing,
  folderNameError,
  folderStubItems,
  initialColumnChain,
  isOwnPath,
  isPickerItemNavigable,
  lastSegment,
  listingSourceFor,
  locationForView,
  pathSegments,
  pickerCommitState,
  pickerHomePath,
  pickerViewOptions,
  stubsNeedWorkspaces,
  viewForLocation,
  viewLabel,
  visibleFolderRows,
} from "../picker-views";

const username = "alice@bvbrc";
const home = "/alice@bvbrc/home";

function item(
  path: string,
  type: string,
  permissions?: WorkspaceItem["permissions"],
): WorkspaceItem {
  return {
    id: path,
    name: path.split("/").pop() ?? "",
    path,
    type,
    size: 0,
    permissions,
  };
}

describe("locationForView", () => {
  it("maps Home to the user's home folder", () => {
    expect(locationForView("home", username)).toEqual({
      kind: "path",
      path: home,
    });
  });

  it("maps every other view to its listing", () => {
    expect(locationForView("myWorkspaces", username)).toEqual({
      kind: "list",
      view: "myWorkspaces",
    });
    expect(locationForView("recent", username)).toEqual({
      kind: "list",
      view: "recent",
    });
  });
});

describe("viewLabel", () => {
  it("labels every view as the sidebar does", () => {
    expect(pickerViewOptions.map((option) => viewLabel(option.value))).toEqual([
      "Home",
      "My Workspaces",
      "Shared Workspaces",
      "Public Workspaces",
      "Favorites",
      "Recently Used",
    ]);
  });
});

describe("pathSegments", () => {
  it("ignores leading, trailing and repeated slashes", () => {
    expect(pathSegments("//alice@bvbrc//home/a/")).toEqual([
      "alice@bvbrc",
      "home",
      "a",
    ]);
    expect(pathSegments("")).toEqual([]);
    expect(pathSegments("/")).toEqual([]);
  });
});

describe("isOwnPath", () => {
  it("covers the user's workspaces and everything inside them", () => {
    expect(isOwnPath("/alice@bvbrc", username)).toBe(true);
    expect(isOwnPath("/alice@bvbrc/projects/x", username)).toBe(true);
    expect(pickerHomePath(username)).toBe(home);
  });

  it("does not take a longer name with the same start for the user's", () => {
    expect(isOwnPath("/alice@bvbrc.org/home", username)).toBe(false);
    expect(isOwnPath("/bob@bvbrc/alice@bvbrc", username)).toBe(false);
  });

  it("owns nothing while signed out", () => {
    expect(isOwnPath("/alice@bvbrc/home", "")).toBe(false);
  });
});

describe("initialColumnChain", () => {
  it("opens at Home with nothing selected when there is no value", () => {
    expect(initialColumnChain("", username)).toEqual({
      view: "home",
      chain: [],
    });
    expect(initialColumnChain("/alice@bvbrc", username)).toEqual({
      view: "home",
      chain: [],
    });
  });

  it("selects Home itself when the value is the home folder", () => {
    expect(initialColumnChain(`${home}/`, username)).toEqual({
      view: "home",
      chain: [],
    });
  });

  it("selects every folder from Home down to the value", () => {
    expect(initialColumnChain(`${home}/Experiments/Run1`, username)).toEqual({
      view: "home",
      chain: [`${home}/Experiments`, `${home}/Experiments/Run1`],
    });
  });

  it("starts the user's other workspaces at the workspace root", () => {
    expect(initialColumnChain("/alice@bvbrc/projects/a", username)).toEqual({
      view: "myWorkspaces",
      chain: ["/alice@bvbrc/projects", "/alice@bvbrc/projects/a"],
    });
  });

  it("opens another user's workspace under Shared", () => {
    expect(initialColumnChain("/bob@bvbrc/lab", username)).toEqual({
      view: "shared",
      chain: ["/bob@bvbrc/lab"],
    });
    expect(initialColumnChain("/bob@bvbrc/lab/a/b", username)).toEqual({
      view: "shared",
      chain: ["/bob@bvbrc/lab", "/bob@bvbrc/lab/a", "/bob@bvbrc/lab/a/b"],
    });
  });

  it("treats a missing value like an empty one", () => {
    expect(initialColumnChain(undefined, username)).toEqual({
      view: "home",
      chain: [],
    });
  });

  it("tidies stray slashes in the value", () => {
    expect(initialColumnChain(`//alice@bvbrc//home/a//b/`, username)).toEqual({
      view: "home",
      chain: [`${home}/a`, `${home}/a/b`],
    });
  });

  it("does not take a workspace whose name starts with home for Home", () => {
    expect(initialColumnChain("/alice@bvbrc/homework/x", username)).toEqual({
      view: "myWorkspaces",
      chain: ["/alice@bvbrc/homework", "/alice@bvbrc/homework/x"],
    });
  });

  it("works for users of another realm", () => {
    const legacy = "carol@patricbrc.org";
    expect(
      initialColumnChain("/carol@patricbrc.org/home/Data", legacy),
    ).toEqual({ view: "home", chain: ["/carol@patricbrc.org/home/Data"] });
  });
});

describe("viewForLocation", () => {
  it("reports Home for paths inside the home folder", () => {
    expect(
      viewForLocation({ kind: "path", path: `${home}/a` }, username, "shared"),
    ).toBe("home");
  });

  it("reports My Workspaces for the user's other workspaces", () => {
    expect(
      viewForLocation(
        { kind: "path", path: "/alice@bvbrc/projects/x" },
        username,
        "shared",
      ),
    ).toBe("myWorkspaces");
  });

  it("reports the origin view for another user's workspace", () => {
    const location = { kind: "path", path: "/bob@bvbrc/ws/a" } as const;
    expect(viewForLocation(location, username, "public")).toBe("public");
    expect(viewForLocation(location, username, "shared")).toBe("shared");
  });

  it("reports the listing's own view", () => {
    expect(
      viewForLocation({ kind: "list", view: "favorites" }, username, "shared"),
    ).toBe("favorites");
  });
});

describe("listingSourceFor", () => {
  it("lists folders and the user's workspace root as directories", () => {
    expect(listingSourceFor({ kind: "path", path: home }, username)).toEqual({
      kind: "directory",
      path: home,
    });
    expect(
      listingSourceFor({ kind: "list", view: "myWorkspaces" }, username),
    ).toEqual({ kind: "directory", path: "/alice@bvbrc" });
  });

  it("lists favorites and recent folders from their own sources", () => {
    expect(
      listingSourceFor({ kind: "list", view: "favorites" }, username),
    ).toEqual({ kind: "favorites" });
    expect(listingSourceFor({ kind: "list", view: "recent" }, username)).toEqual(
      { kind: "recent" },
    );
  });

  it("lists shared and public workspaces from the root listing", () => {
    expect(listingSourceFor({ kind: "list", view: "shared" }, username)).toEqual(
      { kind: "root" },
    );
    expect(listingSourceFor({ kind: "list", view: "public" }, username)).toEqual(
      { kind: "root" },
    );
  });
});

describe("filterListing", () => {
  const root = [
    item("/alice@bvbrc", "folder", { user: "o", global: "n" }),
    item("/bob@bvbrc/writable", "folder", { user: "w", global: "n" }),
    item("/bob@bvbrc/readonly", "folder", { user: "r", global: "n" }),
    item("/carol@bvbrc/public", "folder", { user: "r", global: "r" }),
  ];

  it("keeps only writable shared workspaces when picking a folder", () => {
    expect(
      filterListing({
        location: { kind: "list", view: "shared" },
        items: root,
        target: { kind: "folder" },
      }).map((entry) => entry.path),
    ).toEqual(["/bob@bvbrc/writable"]);
  });

  it("keeps read-only shared workspaces when picking a file", () => {
    expect(
      filterListing({
        location: { kind: "list", view: "shared" },
        items: root,
        target: { kind: "object", types: ["reads"] },
      }).map((entry) => entry.path),
    ).toEqual(["/bob@bvbrc/writable", "/bob@bvbrc/readonly"]);
  });

  it("leaves folders and the other listings alone", () => {
    for (const location of [
      { kind: "path", path: home },
      { kind: "list", view: "favorites" },
      { kind: "list", view: "recent" },
      { kind: "list", view: "myWorkspaces" },
    ] as const) {
      expect(
        filterListing({ location, items: root, target: { kind: "folder" } }),
      ).toBe(root);
    }
  });

  it("keeps only globally readable workspaces for Public", () => {
    expect(
      filterListing({
        location: { kind: "list", view: "public" },
        items: root,
        target: { kind: "folder" },
      }).map((entry) => entry.path),
    ).toEqual(["/carol@bvbrc/public"]);
  });
});

describe("buildPickerItems", () => {
  const listing = [
    item(`${home}/zeta`, "folder"),
    item(`${home}/reads.fq`, "reads"),
    item(`${home}/.hidden`, "folder"),
    item(`${home}/Alpha`, "folder"),
    item(`${home}/notes.txt`, "txt"),
    item(`${home}/job`, "job_result"),
  ];

  it("shows only visible folders, sorted, when picking a folder", () => {
    expect(
      buildPickerItems({
        items: listing,
        target: { kind: "folder" },
        showAll: false,
      }).map((entry) => entry.name),
    ).toEqual(["Alpha", "zeta"]);
  });

  it("also shows files of the requested types when picking a file", () => {
    expect(
      buildPickerItems({
        items: listing,
        target: { kind: "object", types: ["reads"] },
        showAll: false,
      }).map((entry) => entry.name),
    ).toEqual(["Alpha", "zeta", "reads.fq"]);
  });

  it("shows everything, folder-like items first, with show all", () => {
    expect(
      buildPickerItems({
        items: listing,
        target: { kind: "folder" },
        showAll: true,
      }).map((entry) => entry.name),
    ).toEqual([".hidden", "Alpha", "job", "zeta", "notes.txt", "reads.fq"]);
  });

  it("sorts names without regard to case", () => {
    expect(
      buildPickerItems({
        items: [
          item(`${home}/beta`, "folder"),
          item(`${home}/Alpha`, "folder"),
          item(`${home}/alpha2`, "folder"),
        ],
        target: { kind: "folder" },
        showAll: false,
      }).map((entry) => entry.name),
    ).toEqual(["Alpha", "alpha2", "beta"]);
  });

  it("keeps the given order when asked", () => {
    expect(
      buildPickerItems({
        items: [item(`${home}/b`, "folder"), item(`${home}/a`, "folder")],
        target: { kind: "folder" },
        showAll: false,
        keepOrder: true,
      }).map((entry) => entry.name),
    ).toEqual(["b", "a"]);
  });
});

describe("visibleFolderRows", () => {
  const location = { kind: "path", path: home } as const;
  const listing = [
    item(`${home}/zeta`, "folder"),
    item(`${home}/reads.fq`, "reads"),
    item(`${home}/.hidden`, "folder"),
    item(`${home}/.notes`, "txt"),
    item(`${home}/Alpha`, "folder"),
  ];

  it("shows only visible folders by default", () => {
    expect(
      visibleFolderRows(location, listing, false).map((entry) => entry.name),
    ).toEqual(["Alpha", "zeta"]);
  });

  it("adds files with Show files, but never hidden items", () => {
    expect(
      visibleFolderRows(location, listing, true).map((entry) => entry.name),
    ).toEqual(["Alpha", "zeta", "reads.fq"]);
  });

  it("shows folder-like items such as job results only with Show files", () => {
    const withJob = [...listing, item(`${home}/job`, "job_result")];
    expect(
      visibleFolderRows(location, withJob, false).map((entry) => entry.name),
    ).toEqual(["Alpha", "zeta"]);
    expect(
      visibleFolderRows(location, withJob, true).map((entry) => entry.name),
    ).toEqual(["Alpha", "job", "zeta", "reads.fq"]);
  });

  it("drops read-only shared workspaces, which cannot take results", () => {
    const root = [
      item("/bob@bvbrc/writable", "folder", { user: "w", global: "n" }),
      item("/bob@bvbrc/readonly", "folder", { user: "r", global: "n" }),
    ];
    expect(
      visibleFolderRows({ kind: "list", view: "shared" }, root, true).map(
        (entry) => entry.path,
      ),
    ).toEqual(["/bob@bvbrc/writable"]);
  });

  it("keeps Recently Used in the order it was used", () => {
    const recent = [item(`${home}/b`, "folder"), item(`${home}/a`, "folder")];
    expect(
      visibleFolderRows({ kind: "list", view: "recent" }, recent, false).map(
        (entry) => entry.name,
      ),
    ).toEqual(["b", "a"]);
  });
});

describe("lastSegment", () => {
  it("names a path by its last segment", () => {
    expect(lastSegment(`${home}/Experiments/`)).toBe("Experiments");
    expect(lastSegment("/")).toBe("");
  });
});

describe("folderStubItems", () => {
  it("builds folder rows named after the last path segment", () => {
    expect(folderStubItems([`${home}/Experiments/`])).toEqual([
      expect.objectContaining({
        name: "Experiments",
        path: `${home}/Experiments`,
        type: "folder",
        ownerId: "alice@bvbrc",
      }),
    ]);
  });
  it("gives each row its workspace's permissions from the `/` listing", () => {
    const workspaces = [
      item("/bob@bvbrc/shared-ws/", "folder", { user: "w", global: "n" }),
      item("/carol@bvbrc/public-ws", "folder", { user: "r", global: "r" }),
    ];

    expect(
      folderStubItems(
        [
          "/bob@bvbrc/shared-ws",
          "/bob@bvbrc/shared-ws/Runs/Run 1",
          "/carol@bvbrc/public-ws/data",
          "/dave@bvbrc/unlisted/data",
          "/bob@bvbrc",
        ],
        workspaces,
      ).map((row) => row.permissions),
    ).toEqual([
      { user: "w", global: "n" },
      { user: "w", global: "n" },
      { user: "r", global: "r" },
      undefined,
      undefined,
    ]);
  });
});

describe("stubsNeedWorkspaces", () => {
  it("is needed only for paths outside the user's own workspaces", () => {
    expect(stubsNeedWorkspaces([`${home}/a`, "/alice@bvbrc/p"], username)).toBe(
      false,
    );
    expect(stubsNeedWorkspaces([`${home}/a`, "/bob@bvbrc/ws"], username)).toBe(
      true,
    );
    expect(stubsNeedWorkspaces([], username)).toBe(false);
  });
});

describe("row rules", () => {
  it("navigates into folders only", () => {
    expect(isPickerItemNavigable(item(`${home}/a`, "folder"))).toBe(true);
    expect(isPickerItemNavigable(item(`${home}/j`, "job_result"))).toBe(false);
    expect(isPickerItemNavigable(item(`${home}/r.fq`, "reads"))).toBe(false);
  });
});

describe("canWriteTo", () => {
  it("allows the user's own paths", () => {
    expect(canWriteTo({ path: `${home}/a`, username, siblings: [] })).toBe(
      true,
    );
  });

  it("uses the item's permission for another user's path", () => {
    expect(
      canWriteTo({
        path: "/bob@bvbrc/ws",
        username,
        item: item("/bob@bvbrc/ws", "folder", { user: "r", global: "n" }),
        siblings: [],
      }),
    ).toBe(false);
    expect(
      canWriteTo({
        path: "/bob@bvbrc/ws",
        username,
        item: item("/bob@bvbrc/ws", "folder", { user: "w", global: "n" }),
        siblings: [],
      }),
    ).toBe(true);
  });

  it("falls back to a sibling's workspace permission", () => {
    expect(
      canWriteTo({
        path: "/bob@bvbrc/ws/a",
        username,
        siblings: [item("/bob@bvbrc/ws/b", "folder", { user: "r" })],
      }),
    ).toBe(false);
  });

  it("prefers the item's own permission over a sibling's", () => {
    expect(
      canWriteTo({
        path: "/bob@bvbrc/ws/a",
        username,
        item: item("/bob@bvbrc/ws/a", "folder", { user: "w", global: "n" }),
        siblings: [item("/bob@bvbrc/ws/b", "folder", { user: "r" })],
      }),
    ).toBe(true);
  });

  it("falls back to a sibling when the item carries no permission", () => {
    expect(
      canWriteTo({
        path: "/bob@bvbrc/ws/a",
        username,
        item: item("/bob@bvbrc/ws/a", "folder"),
        siblings: [
          item("/bob@bvbrc/ws/c", "folder"),
          item("/bob@bvbrc/ws/b", "folder", { user: "w" }),
        ],
      }),
    ).toBe(true);
  });

  it("refuses when nothing proves write access", () => {
    expect(
      canWriteTo({ path: "/bob@bvbrc/ws/a", username, siblings: [] }),
    ).toBe(false);
  });
});

describe("pickerCommitState", () => {
  it("needs a selection", () => {
    expect(
      pickerCommitState({
        target: { kind: "folder" },
        path: null,
        writable: true,
      }),
    ).toEqual({ canCommit: false, reason: null });
  });

  it("explains a folder the caller rejects", () => {
    expect(
      pickerCommitState({
        target: { kind: "folder" },
        path: `${home}/.hidden`,
        writable: true,
        isSelectable: (object) => !object.name.startsWith("."),
      }),
    ).toEqual({
      canCommit: false,
      reason: "This folder can't be used here.",
    });
  });

  it("asks the caller about the folder by name and path", () => {
    const isSelectable = vi.fn(() => true);
    pickerCommitState({
      target: { kind: "folder" },
      path: `${home}/Experiments/`,
      writable: true,
      isSelectable,
    });
    expect(isSelectable).toHaveBeenCalledWith({
      name: "Experiments",
      path: `${home}/Experiments/`,
    });
  });

  it("gives the caller's rule precedence over write access", () => {
    expect(
      pickerCommitState({
        target: { kind: "folder" },
        path: "/carol@bvbrc/public/.cache",
        writable: false,
        isSelectable: () => false,
      }).reason,
    ).toBe("This folder can't be used here.");
  });

  it("explains a read-only folder", () => {
    expect(
      pickerCommitState({
        target: { kind: "folder" },
        path: "/carol@bvbrc/public",
        writable: false,
      }),
    ).toEqual({
      canCommit: false,
      reason: "You don't have write access to this folder.",
    });
  });

  it("commits a writable folder or any selected file", () => {
    expect(
      pickerCommitState({
        target: { kind: "folder" },
        path: home,
        writable: true,
      }),
    ).toEqual({ canCommit: true, reason: null });
    expect(
      pickerCommitState({
        target: { kind: "object", types: ["reads"] },
        path: "/carol@bvbrc/public/r.fq",
        writable: false,
      }),
    ).toEqual({ canCommit: true, reason: null });
  });
});

describe("folderNameError", () => {
  const hidden = 'Folder name cannot start with ".": hidden folders are not shown here.';

  it("rejects empty and slash names", () => {
    expect(folderNameError("  ")).toBe("Enter a folder name.");
    expect(folderNameError("a/b")).toBe("Folder name cannot contain a slash.");
  });

  it("rejects hidden names, which the picker never lists, dots included", () => {
    expect(folderNameError(".config")).toBe(hidden);
    expect(folderNameError("  .config  ")).toBe(hidden);
    expect(folderNameError(".")).toBe(hidden);
    expect(folderNameError("..")).toBe(hidden);
  });

  it("accepts an ordinary name, with surrounding spaces trimmed", () => {
    expect(folderNameError("Results 2026")).toBeNull();
    expect(folderNameError("  Results  ")).toBeNull();
  });
});

describe("emptyListingMessage", () => {
  it("names what is missing", () => {
    expect(emptyListingMessage({ kind: "path", path: home })).toBe(
      "This folder is empty.",
    );
    expect(emptyListingMessage({ kind: "list", view: "favorites" })).toBe(
      "No favorite folders yet.",
    );
    expect(emptyListingMessage({ kind: "list", view: "recent" })).toBe(
      "No recently used folders.",
    );
    expect(emptyListingMessage({ kind: "list", view: "myWorkspaces" })).toBe(
      "No workspaces yet.",
    );
    expect(emptyListingMessage({ kind: "list", view: "shared" })).toBe(
      "No workspaces are shared with you.",
    );
    expect(emptyListingMessage({ kind: "list", view: "public" })).toBe(
      "No public workspaces.",
    );
  });
});
