import {
  metaListToObj,
  normalizeWsPath,
  formatDate,
  formatFileSize,
  hasWriteAccess,
  sortItems,
  dedupeKeepOrder,
  getJobResultDotPath,
  getSiblingJobResultPathForDotFolder,
  expandDownloadPaths,
} from "@/lib/services/workspace/helpers";
import type { WorkspaceBrowserItem } from "@/types/workspace-browser";

function makeItem(
  overrides: Partial<WorkspaceBrowserItem>,
): WorkspaceBrowserItem {
  return {
    id: "id-1",
    path: "/user/home/test",
    name: "test",
    type: "contigs",
    creation_time: "2024-01-01T00:00:00Z",
    link_reference: "",
    owner_id: "user@test.com",
    size: 100,
    userMeta: {},
    autoMeta: {},
    user_permission: "o",
    global_permission: "r",
    timestamp: Date.parse("2024-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("metaListToObj", () => {
  it("maps array indices correctly", () => {
    const list = [
      "myfile.fasta",    // 0: name
      "contigs",         // 1: type
      "/user/home/",     // 2: parent path
      "2024-01-15",      // 3: creation_time
      "abc123",          // 4: id
      "owner@test.com",  // 5: owner_id
      1024,              // 6: size
      { key: "val" },    // 7: userMeta
      {},                // 8: autoMeta
      "o",               // 9: user_permission
      "r",               // 10: global_permission
      null,              // 11: link_reference
    ];
    const obj = metaListToObj(list);
    expect(obj.id).toBe("abc123");
    expect(obj.name).toBe("myfile.fasta");
    expect(obj.type).toBe("contigs");
    expect(obj.creation_time).toBe("2024-01-15");
    expect(obj.owner_id).toBe("owner@test.com");
    expect(obj.size).toBe(1024);
    expect(obj.user_permission).toBe("o");
    expect(obj.global_permission).toBe("r");
    expect(obj.link_reference).toBeNull();
  });

  it("builds path from parent + name", () => {
    const list = [
      "file.txt",        // 0: name
      "txt",             // 1: type
      "/user/home/",     // 2: parent path
      "", "", "", 0, {}, {}, "", "", null,
    ];
    const obj = metaListToObj(list);
    expect(obj.path).toBe("/user/home/file.txt");
  });
});

describe("normalizeWsPath", () => {
  it("adds leading slash", () => {
    expect(normalizeWsPath("user/home")).toBe("/user/home");
  });

  it("removes trailing slash", () => {
    expect(normalizeWsPath("/user/home/")).toBe("/user/home");
  });

  it("collapses double slashes", () => {
    expect(normalizeWsPath("/user//home///file")).toBe("/user/home/file");
  });

  it("handles empty string", () => {
    expect(normalizeWsPath("")).toBe("");
  });

  it("handles null-ish values", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(normalizeWsPath(null as any)).toBe("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(normalizeWsPath(undefined as any)).toBe("");
  });

  it("handles whitespace-only input", () => {
    expect(normalizeWsPath("   ")).toBe("");
  });
});

describe("formatDate", () => {
  it("formats a valid date string", () => {
    const result = formatDate("2024-06-15T14:30:00Z");
    // Should contain date parts
    expect(result).toContain("6");
    expect(result).toContain("15");
    expect(result).toContain("24");
  });

  it("returns empty string for empty input", () => {
    expect(formatDate("")).toBe("");
  });
});

describe("formatFileSize", () => {
  it("formats bytes", () => {
    expect(formatFileSize(512)).toBe("512 B");
  });

  it("formats kilobytes", () => {
    expect(formatFileSize(2048)).toBe("2.0 KB");
  });

  it("formats megabytes", () => {
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("formats gigabytes", () => {
    expect(formatFileSize(2 * 1024 * 1024 * 1024)).toBe("2.0 GB");
  });

  it("returns empty string for 0", () => {
    expect(formatFileSize(0)).toBe("");
  });
});

describe("hasWriteAccess", () => {
  it("returns true for owner permission (o)", () => {
    const item = makeItem({ user_permission: "o", global_permission: "r" });
    expect(hasWriteAccess(item)).toBe(true);
  });

  it("returns true for admin permission (a)", () => {
    const item = makeItem({ user_permission: "a", global_permission: "r" });
    expect(hasWriteAccess(item)).toBe(true);
  });

  it("returns true for write permission (w)", () => {
    const item = makeItem({ user_permission: "w", global_permission: "r" });
    expect(hasWriteAccess(item)).toBe(true);
  });

  it("returns false for read-only permission", () => {
    const item = makeItem({ user_permission: "r", global_permission: "r" });
    expect(hasWriteAccess(item)).toBe(false);
  });

  it("returns true when global permission grants write", () => {
    const item = makeItem({ user_permission: "r", global_permission: "w" });
    expect(hasWriteAccess(item)).toBe(true);
  });

  it("checks both user and global permissions", () => {
    const item = makeItem({ user_permission: "r", global_permission: "o" });
    expect(hasWriteAccess(item)).toBe(true);
  });
});

describe("sortItems", () => {
  const folder = makeItem({ name: "zFolder", type: "folder", size: 0, timestamp: 100 });
  const jobResult = makeItem({ name: "aJob", type: "job_result", size: 0, timestamp: 200 });
  const fileA = makeItem({ name: "alpha.txt", type: "contigs", size: 500, timestamp: 300 });
  const fileB = makeItem({ name: "beta.txt", type: "reads", size: 100, timestamp: 150 });

  it("places folders before non-folders", () => {
    const sorted = sortItems([fileA, folder, fileB], { field: "name", direction: "asc" });
    expect(sorted[0].name).toBe("zFolder");
  });

  it("treats job_result as folder-like (sorted before files)", () => {
    const sorted = sortItems([fileA, jobResult, folder], { field: "name", direction: "asc" });
    // Both folder-like items should come before fileA
    expect(sorted[0].type).toMatch(/folder|job_result/);
    expect(sorted[1].type).toMatch(/folder|job_result/);
    expect(sorted[2].name).toBe("alpha.txt");
  });

  it("sorts by name ascending", () => {
    const sorted = sortItems([fileB, fileA], { field: "name", direction: "asc" });
    expect(sorted[0].name).toBe("alpha.txt");
    expect(sorted[1].name).toBe("beta.txt");
  });

  it("sorts by name descending", () => {
    const sorted = sortItems([fileA, fileB], { field: "name", direction: "desc" });
    expect(sorted[0].name).toBe("beta.txt");
    expect(sorted[1].name).toBe("alpha.txt");
  });

  it("sorts by size", () => {
    const sorted = sortItems([fileA, fileB], { field: "size", direction: "asc" });
    expect(sorted[0].name).toBe("beta.txt");  // 100
    expect(sorted[1].name).toBe("alpha.txt");  // 500
  });

  it("sorts by creation_time", () => {
    const sorted = sortItems([fileA, fileB], { field: "creation_time", direction: "asc" });
    expect(sorted[0].name).toBe("beta.txt");  // timestamp 150
    expect(sorted[1].name).toBe("alpha.txt");  // timestamp 300
  });

  it("respects desc direction", () => {
    const sorted = sortItems([fileA, fileB], { field: "size", direction: "desc" });
    expect(sorted[0].name).toBe("alpha.txt");  // 500
    expect(sorted[1].name).toBe("beta.txt");  // 100
  });
});

describe("dedupeKeepOrder", () => {
  it("removes duplicate paths after normalization", () => {
    const result = dedupeKeepOrder(["/user/home", "/user/home/", "/user/home"]);
    expect(result).toEqual(["/user/home"]);
  });

  it("preserves order of first occurrence", () => {
    const result = dedupeKeepOrder(["/b/path", "/a/path", "/b/path"]);
    expect(result).toEqual(["/b/path", "/a/path"]);
  });

  it("skips empty values", () => {
    const result = dedupeKeepOrder(["", "/valid", "  "]);
    expect(result).toEqual(["/valid"]);
  });
});

describe("getJobResultDotPath", () => {
  it("converts path to dot-prefixed name", () => {
    const result = getJobResultDotPath({
      path: "/user/home/folder/jobname",
      name: "jobname",
    });
    expect(result).toBe("/user/home/folder/.jobname");
  });

  it("handles trailing slashes in path", () => {
    const result = getJobResultDotPath({
      path: "/user/home/folder/jobname/",
      name: "jobname",
    });
    expect(result).toBe("/user/home/folder/.jobname");
  });

  it("uses last segment of path as fallback when name is empty", () => {
    const result = getJobResultDotPath({
      path: "/user/home/folder/myjob",
      name: "",
    });
    expect(result).toBe("/user/home/folder/.myjob");
  });
});

describe("getSiblingJobResultPathForDotFolder", () => {
  it("finds sibling job_result item", () => {
    const items = [
      makeItem({ path: "/user/home/myjob", name: "myjob", type: "job_result" }),
      makeItem({ path: "/user/home/.myjob", name: ".myjob", type: "folder" }),
    ];
    const result = getSiblingJobResultPathForDotFolder("/user/home/.myjob", items);
    expect(result).toBe("/user/home/myjob");
  });

  it("returns null if no sibling job_result found", () => {
    const items = [
      makeItem({ path: "/user/home/other", name: "other", type: "contigs" }),
    ];
    const result = getSiblingJobResultPathForDotFolder("/user/home/.myjob", items);
    expect(result).toBeNull();
  });

  it("returns null for non-dot-prefixed paths", () => {
    const items = [
      makeItem({ path: "/user/home/myjob", name: "myjob", type: "job_result" }),
    ];
    const result = getSiblingJobResultPathForDotFolder("/user/home/myjob", items);
    expect(result).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(getSiblingJobResultPathForDotFolder("", [])).toBeNull();
  });
});

describe("expandDownloadPaths", () => {
  it("adds dot paths for job_result items", () => {
    const jobItem = makeItem({
      path: "/user/home/myjob",
      name: "myjob",
      type: "job_result",
    });
    const result = expandDownloadPaths([jobItem], []);
    expect(result).toContain("/user/home/.myjob");
    expect(result).toContain("/user/home/myjob");
  });

  it("includes sibling job_result path for dot-folders", () => {
    const dotFolder = makeItem({
      path: "/user/home/.myjob",
      name: ".myjob",
      type: "folder",
    });
    const siblingJobResult = makeItem({
      path: "/user/home/myjob",
      name: "myjob",
      type: "job_result",
    });
    const allItems = [dotFolder, siblingJobResult];
    const result = expandDownloadPaths([dotFolder], allItems);
    expect(result).toContain("/user/home/.myjob");
    expect(result).toContain("/user/home/myjob");
  });

  it("deduplicates paths", () => {
    const jobItem = makeItem({
      path: "/user/home/myjob",
      name: "myjob",
      type: "job_result",
    });
    const result = expandDownloadPaths([jobItem, jobItem], []);
    const uniquePaths = new Set(result);
    expect(result.length).toBe(uniquePaths.size);
  });

  it("passes through regular files as-is", () => {
    const file = makeItem({
      path: "/user/home/data.fasta",
      name: "data.fasta",
      type: "contigs",
    });
    const result = expandDownloadPaths([file], []);
    expect(result).toEqual(["/user/home/data.fasta"]);
  });
});
