import {
  isProtectedHomeFolder,
  findProtectedFolders,
  assertNoProtectedFolders,
  ProtectedFolderError,
  protectedFolderToastTitle,
  formatProtectedFolderToastDescription,
} from "../protected-folders";
import { expectedHomeSubfolders } from "../setup";

describe("isProtectedHomeFolder", () => {
  it("returns true for the home folder itself with realm", () => {
    expect(isProtectedHomeFolder("/alice@bvbrc/home")).toBe(true);
  });

  it("returns true for the home folder without realm", () => {
    expect(isProtectedHomeFolder("/alice/home")).toBe(true);
  });

  it("returns true for each of the four expected sub-folders", () => {
    for (const name of expectedHomeSubfolders) {
      expect(isProtectedHomeFolder(`/alice@bvbrc/home/${name}`)).toBe(true);
    }
  });

  it("normalizes trailing slashes and duplicate separators", () => {
    expect(isProtectedHomeFolder("/alice@bvbrc/home/")).toBe(true);
    expect(isProtectedHomeFolder("/alice@bvbrc//home//Genome Groups/")).toBe(true);
  });

  it("returns false for non-protected folders inside home", () => {
    expect(isProtectedHomeFolder("/alice@bvbrc/home/My Project")).toBe(false);
    expect(isProtectedHomeFolder("/alice@bvbrc/home/Genome Groups/inside")).toBe(false);
  });

  it("returns false for paths that are not under home", () => {
    expect(isProtectedHomeFolder("/alice@bvbrc")).toBe(false);
    expect(isProtectedHomeFolder("/alice@bvbrc/shared")).toBe(false);
    expect(isProtectedHomeFolder("/")).toBe(false);
    expect(isProtectedHomeFolder("")).toBe(false);
  });

  it("is case-sensitive on the sub-folder name (matches BV-BRC's literal names)", () => {
    expect(isProtectedHomeFolder("/alice@bvbrc/home/genome groups")).toBe(false);
    expect(isProtectedHomeFolder("/alice@bvbrc/home/GENOME GROUPS")).toBe(false);
  });
});

describe("findProtectedFolders", () => {
  it("returns the subset of paths that are protected, preserving input order", () => {
    const result = findProtectedFolders([
      "/alice@bvbrc/home/My Project",
      "/alice@bvbrc/home/Genome Groups",
      "/alice@bvbrc/home",
      "/alice@bvbrc/home/Feature Groups",
    ]);
    expect(result).toEqual([
      "/alice@bvbrc/home/Genome Groups",
      "/alice@bvbrc/home",
      "/alice@bvbrc/home/Feature Groups",
    ]);
  });

  it("returns an empty array when nothing is protected", () => {
    expect(findProtectedFolders(["/alice@bvbrc/home/My Project"])).toEqual([]);
  });

  it("dedupes after normalization", () => {
    const result = findProtectedFolders([
      "/alice@bvbrc/home/Genome Groups",
      "/alice@bvbrc/home/Genome Groups/",
      "/alice@bvbrc//home/Genome Groups",
    ]);
    expect(result).toHaveLength(1);
  });
});

describe("assertNoProtectedFolders", () => {
  it("does nothing when no paths are protected", () => {
    expect(() =>
      assertNoProtectedFolders(["/alice@bvbrc/home/My Project"]),
    ).not.toThrow();
  });

  it("throws ProtectedFolderError listing the matched paths", () => {
    let caught: unknown;
    try {
      assertNoProtectedFolders([
        "/alice@bvbrc/home/My Project",
        "/alice@bvbrc/home/Genome Groups",
        "/alice@bvbrc/home",
      ]);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ProtectedFolderError);
    expect((caught as ProtectedFolderError).protectedPaths).toEqual([
      "/alice@bvbrc/home/Genome Groups",
      "/alice@bvbrc/home",
    ]);
    expect((caught as Error).message).toContain("essential");
  });
});

describe("toast strings", () => {
  it("exposes a stable title", () => {
    expect(protectedFolderToastTitle).toBe("Sorry, you can't delete that…");
  });

  it("formats the description with names (not full paths) on separate lines", () => {
    const description = formatProtectedFolderToastDescription([
      "/alice@bvbrc/home",
      "/alice@bvbrc/home/Genome Groups",
      "/alice@bvbrc/home/Experiments",
    ]);
    expect(description).toBe(
      "You cannot delete any of the following essential folders:\n\nhome\nGenome Groups\nExperiments",
    );
  });
});
