import type { WorkspaceItem } from "../domain";
import {
  buildPickerItems,
  canWriteTo,
  emptyListingMessage,
  filterListing,
  folderNameError,
  folderStubItems,
  initialPickerState,
  isPickerItemNavigable,
  isPickerItemSelectable,
  listingSourceFor,
  locationForView,
  parentLocation,
  parentRowLabel,
  pickerCommitState,
  viewForLocation,
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

describe("initialPickerState", () => {
  it("opens at Home with nothing selected when there is no value", () => {
    expect(initialPickerState("", username)).toEqual({
      location: { kind: "path", path: home },
      selectedPath: null,
    });
  });

  it("opens at the parent of the current value with the value selected", () => {
    expect(initialPickerState(`${home}/Experiments/`, username)).toEqual({
      location: { kind: "path", path: home },
      selectedPath: `${home}/Experiments`,
    });
  });

  it("opens My Workspaces when the value is a top-level workspace", () => {
    expect(initialPickerState(home, username)).toEqual({
      location: { kind: "list", view: "myWorkspaces" },
      selectedPath: home,
    });
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

describe("parentLocation", () => {
  it("goes up one folder inside a workspace", () => {
    expect(parentLocation(`${home}/a/b`, username, "shared")).toEqual({
      kind: "path",
      path: `${home}/a`,
    });
  });

  it("returns to My Workspaces from the user's workspace root", () => {
    expect(parentLocation(home, username, "shared")).toEqual({
      kind: "list",
      view: "myWorkspaces",
    });
  });

  it("returns to the origin listing from another user's workspace root", () => {
    expect(parentLocation("/bob@bvbrc/ws", username, "public")).toEqual({
      kind: "list",
      view: "public",
    });
  });
});

describe("parentRowLabel", () => {
  it("labels folder parents and listing parents", () => {
    expect(parentRowLabel({ kind: "path", path: home })).toBe("Parent folder");
    expect(parentRowLabel({ kind: "list", view: "myWorkspaces" })).toBe(
      "Back to My Workspaces",
    );
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
});

describe("row rules", () => {
  it("navigates into folders only", () => {
    expect(isPickerItemNavigable(item(`${home}/a`, "folder"))).toBe(true);
    expect(isPickerItemNavigable(item(`${home}/j`, "job_result"))).toBe(false);
    expect(isPickerItemNavigable(item(`${home}/r.fq`, "reads"))).toBe(false);
  });

  it("selects folders when picking a folder", () => {
    expect(
      isPickerItemSelectable(item(`${home}/a`, "folder"), { kind: "folder" }),
    ).toBe(true);
    expect(
      isPickerItemSelectable(item(`${home}/r.fq`, "reads"), {
        kind: "folder",
      }),
    ).toBe(false);
  });

  it("selects only the requested types when picking a file", () => {
    const target = { kind: "object", types: ["reads"] } as const;
    expect(isPickerItemSelectable(item(`${home}/r.fq`, "reads"), target)).toBe(
      true,
    );
    expect(isPickerItemSelectable(item(`${home}/a`, "folder"), target)).toBe(
      false,
    );
  });

  it("applies the caller's predicate", () => {
    expect(
      isPickerItemSelectable(
        item(`${home}/.hidden`, "folder"),
        { kind: "folder" },
        (object) => !object.name.startsWith("."),
      ),
    ).toBe(false);
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
  it("rejects empty, dot, and slash names", () => {
    expect(folderNameError("  ")).toBe("Enter a folder name.");
    expect(folderNameError("..")).toBe('Folder name cannot be "." or "..".');
    expect(folderNameError("a/b")).toBe("Folder name cannot contain a slash.");
  });

  it("accepts an ordinary name", () => {
    expect(folderNameError("Results 2026")).toBeNull();
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
  });
});
