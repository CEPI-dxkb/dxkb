import {
  buildEncodedSegmentPath,
  buildHomePath,
  buildWorkspaceBreadcrumbs,
  canWriteToCurrentDir,
  computeWorkspacePaths,
  encodeWorkspaceSegment,
  hasWorkspaceWritePermission,
  itemHasWriteAccess,
  parsePathSegments,
  sanitizePathSegment,
  workspaceItemDestination,
  workspaceParentDestination,
  workspaceRootDestination,
  workspaceUsername,
} from "@/lib/services/workspace/path-utils";
import type { WorkspaceItem } from "@/lib/services/workspace/domain";

describe("computeWorkspacePaths", () => {
  it("home mode prepends /{root}/home to the relative path", () => {
    const paths = computeWorkspacePaths({
      mode: "home",
      username: "alice@bvbrc",
      path: "sub/folder",
      myWorkspaceRoot: "alice@bvbrc",
    });
    expect(paths.currentDirectoryPath).toBe("/alice@bvbrc/home/sub/folder");
    expect(paths.currentUserWorkspaceRoot).toBe("/alice@bvbrc");
  });

  it("shared mode uses the raw full path", () => {
    const paths = computeWorkspacePaths({
      mode: "shared",
      username: "alice@bvbrc",
      path: "bob@bvbrc/shared",
      myWorkspaceRoot: "alice@bvbrc",
    });
    expect(paths.currentDirectoryPath).toBe("/bob@bvbrc/shared");
  });

  it("falls back to username when myWorkspaceRoot is empty", () => {
    const paths = computeWorkspacePaths({
      mode: "home",
      username: "alice",
      path: "",
      myWorkspaceRoot: "",
    });
    expect(paths.currentUserWorkspaceRoot).toBe("/alice");
    expect(paths.currentDirectoryPath).toBe("/alice/home");
  });
});

describe("buildHomePath", () => {
  it("normalizes usernames and trims relative paths", () => {
    expect(buildHomePath("alice", "/folder/item/")).toBe(
      "/alice@bvbrc/home/folder/item",
    );
    expect(buildHomePath("alice@bvbrc", "")).toBe("/alice@bvbrc/home");
  });
});

describe("canWriteToCurrentDir", () => {
  const base = {
    fullPath: "/bob@bvbrc/project",
    currentUser: "alice",
    fullWorkspaceUsername: "alice@bvbrc",
    myWorkspaceRoot: "alice@bvbrc",
  };

  it("returns false for public mode", () => {
    expect(
      canWriteToCurrentDir({
        ...base,
        mode: "public",
        currentDirPermissions: undefined,
      }),
    ).toBe(false);
  });

  it("returns true when the path is inside the user's workspace", () => {
    expect(
      canWriteToCurrentDir({
        ...base,
        mode: "shared",
        fullPath: "/alice@bvbrc/project",
        currentDirPermissions: undefined,
      }),
    ).toBe(true);
  });

  it("returns true when permissions grant write to the current user", () => {
    expect(
      canWriteToCurrentDir({
        ...base,
        mode: "shared",
        currentDirPermissions: {
          "/bob@bvbrc/project": [
            ["alice", "w"],
            ["carol", "r"],
          ],
        },
      }),
    ).toBe(true);
  });

  it("returns false when permissions only grant read", () => {
    expect(
      canWriteToCurrentDir({
        ...base,
        mode: "shared",
        currentDirPermissions: {
          "/bob@bvbrc/project": [["alice", "r"]],
        },
      }),
    ).toBe(false);
  });
});

describe("itemHasWriteAccess", () => {
  function withPerms(user: string, global: string): WorkspaceItem {
    return {
      id: "id",
      name: "name",
      path: "/p",
      type: "folder",
      size: 0,
      permissions: { user, global },
    };
  }
  it("treats owner/admin/writer as writeable", () => {
    expect(itemHasWriteAccess(withPerms("o", "n"))).toBe(true);
    expect(itemHasWriteAccess(withPerms("a", "n"))).toBe(true);
    expect(itemHasWriteAccess(withPerms("w", "n"))).toBe(true);
  });
  it("treats global write as writeable", () => {
    expect(itemHasWriteAccess(withPerms("r", "w"))).toBe(true);
  });
  it("treats read-only as non-writeable", () => {
    expect(itemHasWriteAccess(withPerms("r", "n"))).toBe(false);
    expect(itemHasWriteAccess(withPerms("n", "n"))).toBe(false);
  });
});

describe("hasWorkspaceWritePermission", () => {
  it("owns the shared o/a/w predicate", () => {
    expect(hasWorkspaceWritePermission("o", "n")).toBe(true);
    expect(hasWorkspaceWritePermission("r", "a")).toBe(true);
    expect(hasWorkspaceWritePermission("rw", "n")).toBe(true);
    expect(hasWorkspaceWritePermission("r", "n")).toBe(false);
  });
});

describe("sanitizePathSegment", () => {
  it("trims whitespace", () => {
    expect(sanitizePathSegment("  hello  ")).toBe("hello");
  });

  it("removes null bytes", () => {
    expect(sanitizePathSegment("foo\0bar")).toBe("foobar");
  });

  it("removes control characters", () => {
    expect(sanitizePathSegment("foo\x01\x1Fbar")).toBe("foobar");
  });

  it("removes DEL character (\\u007F)", () => {
    expect(sanitizePathSegment("foo\x7Fbar")).toBe("foobar");
  });

  it("returns empty string for non-string input", () => {
    expect(sanitizePathSegment(123 as unknown as string)).toBe("");
    expect(sanitizePathSegment(null as unknown as string)).toBe("");
  });

  it("passes through normal strings unchanged", () => {
    expect(sanitizePathSegment("my-file.txt")).toBe("my-file.txt");
  });
});

describe("encodeWorkspaceSegment", () => {
  it("encodes special characters", () => {
    expect(encodeWorkspaceSegment("hello world")).toBe("hello%20world");
  });

  it("preserves @ symbol", () => {
    expect(encodeWorkspaceSegment("user@host")).toBe("user@host");
  });

  it("sanitizes input before encoding", () => {
    expect(encodeWorkspaceSegment("  foo\0bar  ")).toBe("foobar");
  });

  it("encodes slashes", () => {
    expect(encodeWorkspaceSegment("a/b")).toBe("a%2Fb");
  });
});

describe("parsePathSegments", () => {
  it("splits a path into segments", () => {
    expect(parsePathSegments("/user@bvbrc/home/folder")).toEqual([
      "user@bvbrc",
      "home",
      "folder",
    ]);
  });

  it("strips leading slash", () => {
    expect(parsePathSegments("/a/b")).toEqual(["a", "b"]);
  });

  it("filters out empty segments from double slashes", () => {
    expect(parsePathSegments("/a//b")).toEqual(["a", "b"]);
  });

  it("sanitizes each segment", () => {
    expect(parsePathSegments("/ok/ba\0d")).toEqual(["ok", "bad"]);
  });

  it("handles path without leading slash", () => {
    expect(parsePathSegments("a/b/c")).toEqual(["a", "b", "c"]);
  });
});

describe("buildEncodedSegmentPath", () => {
  it("encodes and joins segments", () => {
    expect(buildEncodedSegmentPath(["user@bvbrc", "home", "my folder"])).toBe(
      "user@bvbrc/home/my%20folder",
    );
  });

  it("returns empty string for empty array", () => {
    expect(buildEncodedSegmentPath([])).toBe("");
  });

  it("handles single segment", () => {
    expect(buildEncodedSegmentPath(["user@bvbrc"])).toBe("user@bvbrc");
  });
});

describe("workspace table destinations", () => {
  it("builds folder destinations for each view mode", () => {
    const item = {
      name: "my folder",
      path: "/bob@bvbrc/shared/my folder",
    };

    expect(
      workspaceItemDestination(
        { mode: "home", path: "parent", username: "alice@bvbrc" },
        item,
      ),
    ).toBe("/workspace/alice@bvbrc/home/parent/my%20folder");
    expect(
      workspaceItemDestination(
        { mode: "shared", path: "", username: "alice@bvbrc" },
        item,
      ),
    ).toBe("/workspace/bob@bvbrc/shared/my%20folder");
    expect(
      workspaceItemDestination(
        { mode: "public", path: "", username: "" },
        item,
      ),
    ).toBe("/workspace/public/bob@bvbrc/shared/my%20folder");
  });

  it("builds parent destinations at mode boundaries", () => {
    expect(
      workspaceParentDestination({
        mode: "home",
        path: "parent/child",
        username: "alice@bvbrc",
      }),
    ).toBe("/workspace/alice@bvbrc/home/parent");
    expect(
      workspaceParentDestination({
        mode: "shared",
        path: "bob@bvbrc",
        username: "bob@bvbrc",
        sharedRootUsername: "alice@bvbrc",
      }),
    ).toBe("/workspace/alice@bvbrc");
    expect(
      workspaceParentDestination({
        mode: "public",
        path: "bob@bvbrc",
        username: "bob@bvbrc",
      }),
    ).toBe("/workspace/public");
  });

  it("builds the leading-row workspace destination", () => {
    expect(workspaceRootDestination("alice@bvbrc")).toBe(
      "/workspace/alice@bvbrc",
    );
    expect(workspaceRootDestination("")).toBe("/workspace/shared");
  });
});

describe("buildWorkspaceBreadcrumbs", () => {
  it("describes home breadcrumbs and shortens the current username", () => {
    expect(
      buildWorkspaceBreadcrumbs({
        mode: "home",
        path: "my folder/child",
        username: "alice@bvbrc",
        currentUsername: "alice",
      }),
    ).toEqual([
      {
        label: "alice",
        href: "/workspace/alice@bvbrc",
        icon: "home",
        muted: true,
      },
      {
        label: "home",
        href: "/workspace/alice@bvbrc/home",
        muted: true,
      },
      {
        label: "my folder",
        href: "/workspace/alice@bvbrc/home/my%20folder",
        muted: true,
      },
      { label: "child", href: undefined, muted: false },
    ]);
  });

  it("describes public and shared roots with their navigation policy", () => {
    expect(
      buildWorkspaceBreadcrumbs({
        mode: "public",
        path: "",
        username: "",
      }),
    ).toEqual([
      {
        label: "Public Workspaces",
        href: undefined,
        icon: "public",
        muted: false,
      },
    ]);
    expect(
      buildWorkspaceBreadcrumbs({
        mode: "shared",
        path: "bob@bvbrc/folder",
        username: "bob@bvbrc",
        currentUsername: "alice",
        workspaceRootUsername: "alice@bvbrc",
      }),
    ).toEqual([
      {
        label: "bob@bvbrc",
        href: "/workspace/alice@bvbrc",
        muted: true,
      },
      { label: "folder", href: undefined, muted: false },
    ]);
  });
});

describe("workspaceUsername", () => {
  it("returns empty string for null user", () => {
    expect(workspaceUsername(null)).toBe("");
  });

  it("returns empty string when username is missing", () => {
    expect(workspaceUsername({ username: undefined })).toBe("");
  });

  it("returns username when no realm", () => {
    expect(workspaceUsername({ username: "testuser" })).toBe("testuser");
  });

  it("appends realm with @", () => {
    expect(workspaceUsername({ username: "testuser", realm: "bvbrc" })).toBe(
      "testuser@bvbrc",
    );
  });
});
