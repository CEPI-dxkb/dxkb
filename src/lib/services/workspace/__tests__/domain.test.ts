import {
  WorkspaceApiError,
  isWorkspaceFolder,
  isWorkspaceFolderLike,
  normalizeWorkspaceType,
  toWorkspaceBrowserItem,
  toWorkspaceItem,
  toWorkspaceObject,
} from "@/lib/services/workspace/domain";
import type { WorkspaceBrowserItem } from "@/types/workspace-browser";

function makeBrowserItem(
  overrides: Partial<WorkspaceBrowserItem> = {},
): WorkspaceBrowserItem {
  return {
    id: "abc",
    path: "/user@bvbrc/home/file.fa",
    name: "file.fa",
    type: "contigs",
    creation_time: "2026-04-01T12:00:00Z",
    link_reference: "",
    owner_id: "user@bvbrc",
    size: 123,
    userMeta: {},
    autoMeta: {},
    user_permission: "o",
    global_permission: "n",
    timestamp: 1712000000000,
    ...overrides,
  };
}

describe("workspace domain", () => {
  describe("toWorkspaceItem", () => {
    it("maps WorkspaceBrowserItem fields into canonical item", () => {
      const input = makeBrowserItem();
      const item = toWorkspaceItem(input);
      expect(item).toEqual(
        expect.objectContaining({
          id: "abc",
          name: "file.fa",
          path: "/user@bvbrc/home/file.fa",
          type: "contigs",
          size: 123,
          ownerId: "user@bvbrc",
          createdAt: "2026-04-01T12:00:00Z",
          timestamp: 1712000000000,
          permissions: { user: "o", global: "n" },
        }),
      );
      expect(item.raw).toBe(input);
    });

    it("coerces null/undefined fields into safe defaults", () => {
      const input = makeBrowserItem({ owner_id: "", link_reference: "", user_permission: "", global_permission: "" });
      const item = toWorkspaceItem(input);
      expect(item.ownerId).toBeUndefined();
      expect(item.linkReference).toBeUndefined();
      expect(item.permissions).toEqual({ user: undefined, global: undefined });
    });
  });

  describe("toWorkspaceBrowserItem", () => {
    it("round-trips with toWorkspaceItem via raw", () => {
      const original = makeBrowserItem();
      const roundTripped = toWorkspaceBrowserItem(toWorkspaceItem(original));
      expect(roundTripped).toBe(original);
    });

    it("produces a transport shape when raw is missing", () => {
      const item = toWorkspaceItem(makeBrowserItem());
      item.raw = undefined;
      const out = toWorkspaceBrowserItem(item);
      expect(out).toEqual(
        expect.objectContaining({
          id: "abc",
          name: "file.fa",
          path: "/user@bvbrc/home/file.fa",
          type: "contigs",
          size: 123,
          owner_id: "user@bvbrc",
          creation_time: "2026-04-01T12:00:00Z",
          user_permission: "o",
          global_permission: "n",
        }),
      );
    });
  });

  describe("toWorkspaceObject", () => {
    it("preserves raw type string (not narrowed)", () => {
      const item = toWorkspaceItem(makeBrowserItem({ type: "genome_group" }));
      const obj = toWorkspaceObject(item);
      expect(obj.type).toBe("genome_group");
      expect(obj.isDirectory).toBe(true);
    });

    it("marks plain files as non-directory", () => {
      const item = toWorkspaceItem(makeBrowserItem({ type: "contigs" }));
      const obj = toWorkspaceObject(item);
      expect(obj.isDirectory).toBe(false);
    });
  });

  describe("folder-type helpers", () => {
    it("isWorkspaceFolder is true only for folder/directory/modelfolder", () => {
      expect(isWorkspaceFolder({ type: "folder" })).toBe(true);
      expect(isWorkspaceFolder({ type: "directory" })).toBe(true);
      expect(isWorkspaceFolder({ type: "modelfolder" })).toBe(true);
      expect(isWorkspaceFolder({ type: "job_result" })).toBe(false);
      expect(isWorkspaceFolder({ type: "genome_group" })).toBe(false);
      expect(isWorkspaceFolder({ type: "contigs" })).toBe(false);
    });

    it("isWorkspaceFolderLike includes job_result and groups", () => {
      expect(isWorkspaceFolderLike({ type: "folder" })).toBe(true);
      expect(isWorkspaceFolderLike({ type: "job_result" })).toBe(true);
      expect(isWorkspaceFolderLike({ type: "genome_group" })).toBe(true);
      expect(isWorkspaceFolderLike({ type: "feature_group" })).toBe(true);
      expect(isWorkspaceFolderLike({ type: "experiment_group" })).toBe(true);
      expect(isWorkspaceFolderLike({ type: "contigs" })).toBe(false);
    });

    it("normalizeWorkspaceType lowercases the input", () => {
      expect(normalizeWorkspaceType("Folder")).toBe("folder");
      expect(normalizeWorkspaceType("")).toBe("");
    });
  });

  describe("WorkspaceApiError", () => {
    it("extracts JSON-RPC error code from apiResponse.error.code", () => {
      const err = new WorkspaceApiError("oops", "Workspace.copy", { error: { code: -32603 } });
      expect(err.code).toBe(-32603);
      expect(err.method).toBe("Workspace.copy");
    });

    it("extracts a top-level code when error wrapper is absent", () => {
      const err = new WorkspaceApiError("oops", "Workspace.delete", { code: 42 });
      expect(err.code).toBe(42);
    });

    it("returns undefined when apiResponse has no code", () => {
      const err = new WorkspaceApiError("oops", "Workspace.ls", { message: "nope" });
      expect(err.code).toBeUndefined();
    });
  });
});
