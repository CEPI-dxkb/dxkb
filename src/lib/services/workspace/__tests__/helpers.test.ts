import {
  metaListToObj,
  parseWorkspaceGetSingle,
  normalizeWsPath,
  formatDate,
  formatFileSize,
  formatOwner,
  getDotPathRelative,
  hasWriteAccess,
  sortItems,
  dedupeKeepOrder,
  getJobResultDotPath,
  getSiblingJobResultPathForDotFolder,
  expandDownloadPaths,
  isValidWorkspaceObjectType,
  getValidWorkspaceObjectTypes,
  validateWorkspaceObjectTypes,
  getFolderPathsFromItems,
  getNonEmptyFolderPaths,
  ensureDestinationWriteAccess,
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

  it("coerces null size to 0", () => {
    const list = [
      "file.txt", "txt", "/user/home/", "", "", "", null, {}, {}, "", "", null,
    ];
    const obj = metaListToObj(list);
    expect(obj.size).toBe(0);
  });

  it("coerces undefined size to 0", () => {
    const list = [
      "file.txt", "txt", "/user/home/", "", "", "", undefined, {}, {}, "", "", null,
    ];
    const obj = metaListToObj(list);
    expect(obj.size).toBe(0);
  });

  it("coerces string size to number", () => {
    const list = [
      "file.txt", "txt", "/user/home/", "", "", "", "339000000", {}, {}, "", "", null,
    ];
    const obj = metaListToObj(list);
    expect(obj.size).toBe(339000000);
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

  it("formats terabytes", () => {
    expect(formatFileSize(2 * 1024 * 1024 * 1024 * 1024)).toBe("2.00 TB");
  });

  it("returns empty string for 0", () => {
    expect(formatFileSize(0)).toBe("");
  });

  it("returns '0 B' for 0 when showZero is true", () => {
    expect(formatFileSize(0, { showZero: true })).toBe("0 B");
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

describe("parseWorkspaceGetSingle", () => {
  it("parses a valid raw result into a ResolvedPathObject", () => {
    const raw = [
      [
        [
          [
            "myfile.fasta",       // 0: name
            "contigs",            // 1: type
            "/user/home/",        // 2: parent path
            "2024-01-15T00:00:00Z", // 3: creation_time
            "abc123",             // 4: id
            "owner@test.com",     // 5: owner_id
            1024,                 // 6: size
            {},                   // 7: userMeta
            {},                   // 8: sysMeta
          ],
        ],
      ],
    ];
    const result = parseWorkspaceGetSingle(raw);
    expect(result).toEqual(
      expect.objectContaining({
        name: "myfile.fasta",
        type: "contigs",
        path: "/user/home/myfile.fasta",
        id: "abc123",
        owner_id: "owner@test.com",
        size: 1024,
      }),
    );
  });

  it("returns null when pathResults is not an array", () => {
    expect(parseWorkspaceGetSingle([null])).toBeNull();
    expect(parseWorkspaceGetSingle([undefined])).toBeNull();
  });

  it("returns null when objectsAtPath is empty", () => {
    const raw = [[
      [],
    ]];
    expect(parseWorkspaceGetSingle(raw)).toBeNull();
  });

  it("returns null when list item is not an array", () => {
    const raw = [[
      ["not-an-array"],
    ]];
    expect(parseWorkspaceGetSingle(raw)).toBeNull();
  });

  it("populates taskData and jobSysMeta for job_result type", () => {
    const taskData = { success: 1, app_id: "GenomeAssembly2" };
    const sysMeta = { elapsed_time: 120, hostname: "node1" };
    const raw = [
      [
        [
          [
            "myjob",
            "job_result",
            "/user/home/",
            "2024-01-15T00:00:00Z",
            "job-id-1",
            "owner@test.com",
            0,
            { task_data: taskData },
            sysMeta,
          ],
        ],
      ],
    ];
    const result = parseWorkspaceGetSingle(raw);
    expect(result).toEqual(
      expect.objectContaining({
        type: "job_result",
        taskData: taskData,
        jobSysMeta: sysMeta,
      }),
    );
  });

  it("collapses double slashes in path", () => {
    const raw = [
      [
        [
          [
            "file.txt",
            "txt",
            "/user//home//",
            "",
            "id1",
            "owner",
            0,
            {},
            {},
          ],
        ],
      ],
    ];
    const result = parseWorkspaceGetSingle(raw);
    expect(result).toEqual(expect.objectContaining({ path: "/user/home/file.txt" }));
  });

  it("uses pathIndex parameter to select different path results", () => {
    const raw = [
      [
        [
          [
            "file1.txt",
            "txt",
            "/user/home/",
            "",
            "id1",
            "owner",
            100,
            {},
            {},
          ],
        ],
        [
          [
            "file2.txt",
            "reads",
            "/user/data/",
            "",
            "id2",
            "owner",
            200,
            {},
            {},
          ],
        ],
      ],
    ];
    const result = parseWorkspaceGetSingle(raw, 1);
    expect(result).toEqual(expect.objectContaining({ name: "file2.txt", type: "reads" }));
  });
});

describe("isValidWorkspaceObjectType", () => {
  it("returns true for known upload types", () => {
    expect(isValidWorkspaceObjectType("contigs")).toBe(true);
    expect(isValidWorkspaceObjectType("reads")).toBe(true);
    expect(isValidWorkspaceObjectType("csv")).toBe(true);
  });

  it("returns true for other workspace object types", () => {
    expect(isValidWorkspaceObjectType("folder")).toBe(true);
    expect(isValidWorkspaceObjectType("job_result")).toBe(true);
    expect(isValidWorkspaceObjectType("genome_group")).toBe(true);
  });

  it("returns true for viewable types", () => {
    expect(isValidWorkspaceObjectType("txt")).toBe(true);
    expect(isValidWorkspaceObjectType("html")).toBe(true);
    expect(isValidWorkspaceObjectType("pdb")).toBe(true);
  });

  it("returns false for unknown types", () => {
    expect(isValidWorkspaceObjectType("nonexistent_type")).toBe(false);
    expect(isValidWorkspaceObjectType("")).toBe(false);
  });
});

describe("getValidWorkspaceObjectTypes", () => {
  it("returns an array of valid types", () => {
    const types = getValidWorkspaceObjectTypes();
    expect(Array.isArray(types)).toBe(true);
    expect(types.length).toBeGreaterThan(0);
  });

  it("includes known upload types, other types, and viewable types", () => {
    const types = getValidWorkspaceObjectTypes();
    expect(types).toContain("contigs");
    expect(types).toContain("folder");
    expect(types).toContain("txt");
  });
});

describe("validateWorkspaceObjectTypes", () => {
  it("separates valid and invalid types", () => {
    const result = validateWorkspaceObjectTypes(["contigs", "fake_type", "reads"]);
    expect(result.valid).toContain("contigs");
    expect(result.valid).toContain("reads");
    expect(result.invalid).toEqual(["fake_type"]);
  });

  it("returns all valid when all types are valid", () => {
    const result = validateWorkspaceObjectTypes(["contigs", "folder"]);
    expect(result.valid).toHaveLength(2);
    expect(result.invalid).toHaveLength(0);
  });

  it("returns all invalid when no types are valid", () => {
    const result = validateWorkspaceObjectTypes(["bogus", "nope"]);
    expect(result.valid).toHaveLength(0);
    expect(result.invalid).toHaveLength(2);
  });

  it("handles empty input", () => {
    const result = validateWorkspaceObjectTypes([]);
    expect(result.valid).toHaveLength(0);
    expect(result.invalid).toHaveLength(0);
  });
});

describe("sortItems - additional fields", () => {
  const fileA = makeItem({ name: "alpha.txt", type: "contigs", owner_id: "zack@test.com" });
  const fileB = makeItem({ name: "beta.txt", type: "reads", owner_id: "alice@test.com" });

  it("sorts by owner_id ascending", () => {
    const sorted = sortItems([fileA, fileB], { field: "owner_id", direction: "asc" });
    expect(sorted[0].owner_id).toBe("alice@test.com");
    expect(sorted[1].owner_id).toBe("zack@test.com");
  });

  it("sorts by type ascending", () => {
    const sorted = sortItems([fileA, fileB], { field: "type", direction: "asc" });
    expect(sorted[0].type).toBe("contigs");
    expect(sorted[1].type).toBe("reads");
  });

  it("sorts by type descending", () => {
    const sorted = sortItems([fileA, fileB], { field: "type", direction: "desc" });
    expect(sorted[0].type).toBe("reads");
    expect(sorted[1].type).toBe("contigs");
  });
});

describe("getFolderPathsFromItems", () => {
  it("returns paths for folder-type items", () => {
    const items = [
      makeItem({ path: "/user/home/myfolder", type: "folder" }),
      makeItem({ path: "/user/home/file.txt", type: "contigs" }),
      makeItem({ path: "/user/home/subdir", type: "directory" }),
    ];
    const result = getFolderPathsFromItems(items);
    expect(result).toEqual(["/user/home/myfolder", "/user/home/subdir"]);
  });

  it("excludes job_result and group types", () => {
    const items = [
      makeItem({ path: "/user/home/myjob", type: "job_result" }),
      makeItem({ path: "/user/home/mygroup", type: "genome_group" }),
    ];
    const result = getFolderPathsFromItems(items);
    expect(result).toHaveLength(0);
  });

  it("skips items without a path", () => {
    const items = [
      makeItem({ path: "", type: "folder" }),
    ];
    const result = getFolderPathsFromItems(items);
    expect(result).toHaveLength(0);
  });

  it("returns empty array for empty input", () => {
    expect(getFolderPathsFromItems([])).toEqual([]);
  });
});

describe("getNonEmptyFolderPaths", () => {
  it("returns paths of folders that have children", async () => {
    const listFolder = vi.fn()
      .mockResolvedValueOnce([makeItem({ name: "child.txt" })]) // non-empty
      .mockResolvedValueOnce([]); // empty

    const result = await getNonEmptyFolderPaths(
      ["/user/home/full", "/user/home/empty"],
      listFolder,
    );
    expect(result).toEqual(["/user/home/full"]);
  });

  it("returns empty array when all folders are empty", async () => {
    const listFolder = vi.fn().mockResolvedValue([]);

    const result = await getNonEmptyFolderPaths(
      ["/user/home/a", "/user/home/b"],
      listFolder,
    );
    expect(result).toEqual([]);
  });

  it("throws on abort signal", async () => {
    const controller = new AbortController();
    controller.abort();

    const listFolder = vi.fn().mockResolvedValue([]);

    await expect(
      getNonEmptyFolderPaths(["/user/home/folder"], listFolder, {
        signal: controller.signal,
      }),
    ).rejects.toThrow("Aborted");
  });

  it("treats fetch errors as empty (does not block)", async () => {
    const listFolder = vi.fn().mockRejectedValue(new Error("Network error"));

    const result = await getNonEmptyFolderPaths(["/user/home/folder"], listFolder);
    expect(result).toEqual([]);
  });

  it("handles empty folder paths array", async () => {
    const listFolder = vi.fn();
    const result = await getNonEmptyFolderPaths([], listFolder);
    expect(result).toEqual([]);
    expect(listFolder).not.toHaveBeenCalled();
  });
});

describe("formatOwner", () => {
  it("strips @bvbrc suffix", () => {
    expect(formatOwner("alice@bvbrc")).toBe("alice");
  });

  it("returns owner unchanged when no @bvbrc suffix", () => {
    expect(formatOwner("bob@other.com")).toBe("bob@other.com");
  });

  it("returns em-dash for empty string", () => {
    expect(formatOwner("")).toBe("—");
  });

  it("handles owner with no domain", () => {
    expect(formatOwner("charlie")).toBe("charlie");
  });
});

describe("getDotPathRelative", () => {
  it("builds dot path from path and job name", () => {
    expect(
      getDotPathRelative("/user@bvbrc/home/folder/myjob", "myjob"),
    ).toBe("user@bvbrc/home/folder/.myjob");
  });

  it("handles root-level job (no parent segments)", () => {
    expect(getDotPathRelative("/myjob", "myjob")).toBe(".myjob");
  });

  it("handles path with multiple segments", () => {
    expect(
      getDotPathRelative("/user@bvbrc/home/sub/deep/job", "job"),
    ).toBe("user@bvbrc/home/sub/deep/.job");
  });

  it("strips leading slash from segments", () => {
    const result = getDotPathRelative("/a/b/c", "c");
    expect(result.startsWith("/")).toBe(false);
  });
});

describe("ensureDestinationWriteAccess", () => {
  it("returns ok when target exists and has write access", async () => {
    const listFolder = vi.fn().mockResolvedValue([
      makeItem({ path: "/user/home/target", user_permission: "o" }),
    ]);

    const result = await ensureDestinationWriteAccess("/user/home/target", listFolder);
    expect(result).toEqual({ ok: true });
  });

  it("returns error when target exists but lacks write access", async () => {
    const listFolder = vi.fn().mockResolvedValue([
      makeItem({ path: "/user/home/target", user_permission: "r", global_permission: "r" }),
    ]);

    const result = await ensureDestinationWriteAccess("/user/home/target", listFolder);
    expect(result.ok).toBe(false);
    expect(result.errorMessage).toContain("Access denied");
  });

  it("checks parent write access for new destinations", async () => {
    const listFolder = vi.fn()
      .mockResolvedValueOnce([]) // target not in listing
      .mockResolvedValueOnce([ // grandparent listing has parent with write
        makeItem({ path: "/user/home", user_permission: "o" }),
      ]);

    const result = await ensureDestinationWriteAccess("/user/home/newfile", listFolder);
    expect(result).toEqual({ ok: true });
  });

  it("returns error when parent lacks write access for new destination", async () => {
    const listFolder = vi.fn()
      .mockResolvedValueOnce([]) // target not in listing
      .mockResolvedValueOnce([ // parent has no write
        makeItem({ path: "/user/home", user_permission: "r", global_permission: "r" }),
      ]);

    const result = await ensureDestinationWriteAccess("/user/home/newfile", listFolder);
    expect(result.ok).toBe(false);
    expect(result.errorMessage).toContain("Access denied");
  });

  it("returns error on fetch failure", async () => {
    const listFolder = vi.fn().mockRejectedValue(new Error("Network error"));

    const result = await ensureDestinationWriteAccess("/user/home/target", listFolder);
    expect(result.ok).toBe(false);
    expect(result.errorMessage).toContain("Access denied");
  });
});
