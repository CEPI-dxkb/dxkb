import {
  getWorkspaceFolderDisplayName,
  getRecentFolders,
  addRecentFolder,
  clearRecentFolders,
} from "@/lib/recent-workspace-folders";

const storageKey = "dxkb-recent-workspace-folders";

describe("getWorkspaceFolderDisplayName", () => {
  it("extracts the last segment of a path", () => {
    expect(getWorkspaceFolderDisplayName("/user@bvbrc/home/Experiments")).toBe(
      "Experiments",
    );
  });

  it("handles paths with trailing slash", () => {
    expect(getWorkspaceFolderDisplayName("/user@bvbrc/home/Experiments/")).toBe(
      "Experiments",
    );
  });

  it("handles root-level segment", () => {
    expect(getWorkspaceFolderDisplayName("home")).toBe("home");
  });

  it("handles single-segment path with leading slash", () => {
    expect(getWorkspaceFolderDisplayName("/home")).toBe("home");
  });

  it("handles deeply nested paths", () => {
    expect(
      getWorkspaceFolderDisplayName("/user@bvbrc/home/a/b/c/deep-folder"),
    ).toBe("deep-folder");
  });
});

describe("getRecentFolders", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns empty array when localStorage is empty", () => {
    expect(getRecentFolders()).toEqual([]);
  });

  it("returns parsed entries from localStorage", () => {
    const entries = [
      { path: "/user@bvbrc/home/folder1", visitedAt: 1000 },
      { path: "/user@bvbrc/home/folder2", visitedAt: 2000 },
    ];
    localStorage.setItem(storageKey, JSON.stringify(entries));
    expect(getRecentFolders()).toEqual(entries);
  });

  it("filters by user prefix when provided", () => {
    const entries = [
      { path: "/alice@bvbrc/home/folder1", visitedAt: 1000 },
      { path: "/bob@bvbrc/home/folder2", visitedAt: 2000 },
    ];
    localStorage.setItem(storageKey, JSON.stringify(entries));
    expect(getRecentFolders("alice@bvbrc")).toEqual([entries[0]]);
  });

  it("handles prefix with leading slash", () => {
    const entries = [
      { path: "/alice@bvbrc/home/folder1", visitedAt: 1000 },
    ];
    localStorage.setItem(storageKey, JSON.stringify(entries));
    expect(getRecentFolders("/alice@bvbrc")).toEqual([entries[0]]);
  });

  it("returns empty array for invalid JSON", () => {
    localStorage.setItem(storageKey, "not-json");
    expect(getRecentFolders()).toEqual([]);
  });

  it("filters out malformed entries", () => {
    const raw = [
      { path: "/user@bvbrc/home/good", visitedAt: 1000 },
      { path: 123, visitedAt: 2000 },
      null,
      { path: "/user@bvbrc/home/also-good", visitedAt: 3000 },
    ];
    localStorage.setItem(storageKey, JSON.stringify(raw));
    const result = getRecentFolders();
    expect(result).toHaveLength(2);
    expect(result[0].path).toBe("/user@bvbrc/home/good");
    expect(result[1].path).toBe("/user@bvbrc/home/also-good");
  });
});

describe("addRecentFolder", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("adds a new entry to empty storage", () => {
    addRecentFolder("/user@bvbrc/home/folder1", "/user@bvbrc");
    const result = getRecentFolders();
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe("/user@bvbrc/home/folder1");
  });

  it("deduplicates by moving existing entry to front", () => {
    addRecentFolder("/user@bvbrc/home/folder1", "/user@bvbrc");
    addRecentFolder("/user@bvbrc/home/folder2", "/user@bvbrc");
    addRecentFolder("/user@bvbrc/home/folder1", "/user@bvbrc");
    const result = getRecentFolders();
    expect(result).toHaveLength(2);
    expect(result[0].path).toBe("/user@bvbrc/home/folder1");
    expect(result[1].path).toBe("/user@bvbrc/home/folder2");
  });

  it("trims to maxItems per user", () => {
    for (let i = 0; i < 10; i++) {
      addRecentFolder(`/user@bvbrc/home/folder${i}`, "/user@bvbrc");
    }
    const result = getRecentFolders();
    expect(result).toHaveLength(5);
    expect(result[0].path).toBe("/user@bvbrc/home/folder9");
  });

  it("respects custom maxItems", () => {
    for (let i = 0; i < 5; i++) {
      addRecentFolder(`/user@bvbrc/home/folder${i}`, "/user@bvbrc", 3);
    }
    expect(getRecentFolders()).toHaveLength(3);
  });

  it("preserves other users' entries when trimming", () => {
    addRecentFolder("/other@bvbrc/home/their-folder", "/other@bvbrc");
    for (let i = 0; i < 6; i++) {
      addRecentFolder(`/user@bvbrc/home/folder${i}`, "/user@bvbrc");
    }
    const all = getRecentFolders();
    expect(all.some((f) => f.path === "/other@bvbrc/home/their-folder")).toBe(
      true,
    );
    expect(getRecentFolders("/user@bvbrc")).toHaveLength(5);
  });
});

describe("clearRecentFolders", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("removes all entries from localStorage", () => {
    addRecentFolder("/user@bvbrc/home/folder1", "/user@bvbrc");
    addRecentFolder("/user@bvbrc/home/folder2", "/user@bvbrc");
    expect(getRecentFolders()).toHaveLength(2);
    clearRecentFolders();
    expect(getRecentFolders()).toEqual([]);
  });
});
