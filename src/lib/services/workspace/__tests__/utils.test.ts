import {
  normalizeWorkspaceObjectType,
  isFolderType,
  isFolder,
} from "@/lib/services/workspace/utils";

describe("normalizeWorkspaceObjectType", () => {
  it("lowercases the type string", () => {
    expect(normalizeWorkspaceObjectType("Folder")).toBe("folder");
    expect(normalizeWorkspaceObjectType("JOB_RESULT")).toBe("job_result");
  });

  it("handles null/undefined gracefully", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(normalizeWorkspaceObjectType(null as any)).toBe("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(normalizeWorkspaceObjectType(undefined as any)).toBe("");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeWorkspaceObjectType("")).toBe("");
  });
});

describe("isFolderType", () => {
  it.each([
    "folder",
    "directory",
    "job_result",
    "modelfolder",
    "genome_group",
    "feature_group",
    "experiment_group",
  ])("returns true for %s", (type) => {
    expect(isFolderType(type)).toBe(true);
  });

  it("returns false for non-folder types", () => {
    expect(isFolderType("contigs")).toBe(false);
    expect(isFolderType("reads")).toBe(false);
    expect(isFolderType("txt")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isFolderType("Folder")).toBe(true);
    expect(isFolderType("JOB_RESULT")).toBe(true);
    expect(isFolderType("Genome_Group")).toBe(true);
  });
});

describe("isFolder", () => {
  it.each(["folder", "directory", "modelfolder"])(
    "returns true for %s",
    (type) => {
      expect(isFolder(type)).toBe(true);
    },
  );

  it("returns false for job_result", () => {
    expect(isFolder("job_result")).toBe(false);
  });

  it("returns false for genome_group", () => {
    expect(isFolder("genome_group")).toBe(false);
  });

  it("returns false for feature_group", () => {
    expect(isFolder("feature_group")).toBe(false);
  });

  it("returns false for experiment_group", () => {
    expect(isFolder("experiment_group")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isFolder("Folder")).toBe(true);
    expect(isFolder("DIRECTORY")).toBe(true);
  });
});
