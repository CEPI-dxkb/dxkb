import {
  canWriteToCurrentDir,
  computeWorkspacePaths,
  itemHasWriteAccess,
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
