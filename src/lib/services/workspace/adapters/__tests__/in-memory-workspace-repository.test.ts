import { InMemoryWorkspaceRepository } from "@/lib/services/workspace/adapters/in-memory-workspace-repository";
import { WorkspaceApiError } from "@/lib/services/workspace/domain";

describe("InMemoryWorkspaceRepository", () => {
  it("lists fixture items for a directory", async () => {
    const repo = new InMemoryWorkspaceRepository({
      directories: {
        "/user@bvbrc/home": [
          { name: "a.fa", type: "contigs" },
          { name: "b", type: "folder" },
        ],
      },
    });
    const items = await repo.listDirectory({ path: "/user@bvbrc/home" });
    expect(items.map((i) => i.name)).toEqual(["a.fa", "b"]);
    expect(items[0]?.path).toBe("/user@bvbrc/home/a.fa");
  });

  it("filters listDirectory by query.type and query.name", async () => {
    const repo = new InMemoryWorkspaceRepository({
      directories: {
        "/u/home": [
          { name: "x", type: "reads" },
          { name: "y", type: "contigs" },
          { name: "yoyo", type: "reads" },
        ],
      },
    });
    const reads = await repo.listDirectory({
      path: "/u/home",
      query: { type: ["reads"] },
    });
    expect(reads.map((i) => i.name)).toEqual(["x", "yoyo"]);
    const byName = await repo.listDirectory({
      path: "/u/home",
      query: { name: "yo" },
    });
    expect(byName.map((i) => i.name)).toEqual(["yoyo"]);
  });

  it("records call history for mutations", async () => {
    const repo = new InMemoryWorkspaceRepository({
      directories: { "/u/home": [{ name: "file.fa", type: "contigs" }] },
    });
    await repo.createFolder("/u/home/new");
    await repo.delete(["/u/home/file.fa"]);
    await repo.updateObjectType("/u/home/other", "reads");
    expect(repo.calls.map((c) => c.method)).toEqual([
      "createFolder",
      "delete",
      "updateObjectType",
    ]);
  });

  it("returns permissions fixtures", async () => {
    const repo = new InMemoryWorkspaceRepository({
      permissions: { "/a": [["alice", "w"]] },
    });
    const perms = await repo.listPermissions(["/a", "/missing"]);
    expect(perms).toEqual({ "/a": [["alice", "w"]], "/missing": [] });
  });

  it("throws overwrite error when copying onto an existing destination", async () => {
    const repo = new InMemoryWorkspaceRepository({
      directories: {
        "/u/home": [
          { name: "src", type: "contigs" },
          { name: "dest", type: "contigs" },
        ],
      },
    });
    await expect(
      repo.copy({ pairs: [["/u/home/src", "/u/home/dest"]] }),
    ).rejects.toBeInstanceOf(WorkspaceApiError);
  });

  it("allows error injection", async () => {
    const repo = new InMemoryWorkspaceRepository({
      errors: { delete: new Error("boom") },
    });
    await expect(repo.delete(["/any"])).rejects.toThrow("boom");
  });

  it("searchObjects filters by type and name recursively", async () => {
    const repo = new InMemoryWorkspaceRepository({
      directories: {
        "/u@bvbrc/home": [
          { name: "sub", type: "folder" },
          { name: "top.reads", type: "reads" },
        ],
        "/u@bvbrc/home/sub": [{ name: "nested.reads", type: "reads" }],
      },
    });
    const results = await repo.searchObjects({
      username: "u",
      types: ["reads"],
    });
    expect(results.map((i) => i.name).sort()).toEqual([
      "nested.reads",
      "top.reads",
    ]);
  });

  it("getDownloadUrls falls back to fixture URL generator", async () => {
    const repo = new InMemoryWorkspaceRepository();
    const urls = await repo.getDownloadUrls(["/x/y/z"]);
    expect(urls[0]?.[0]).toContain("/x/y/z");
  });
});
