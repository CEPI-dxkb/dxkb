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

  it("returns WorkspaceItem with camelCase fields from fixture", async () => {
    const repo = new InMemoryWorkspaceRepository({
      directories: {
        "/user@bvbrc/home": [
          {
            name: "data.fa",
            type: "contigs",
            ownerId: "owner@bvbrc",
            createdAt: "2026-01-01T00:00:00Z",
            userPermission: "w",
            globalPermission: "n",
            size: 512,
          },
        ],
      },
    });
    const [item] = await repo.listDirectory({ path: "/user@bvbrc/home" });
    expect(item).toEqual(
      expect.objectContaining({
        name: "data.fa",
        type: "contigs",
        ownerId: "owner@bvbrc",
        createdAt: "2026-01-01T00:00:00Z",
        size: 512,
        permissions: { user: "w", global: "n" },
      }),
    );
    // Verify no snake_case fields bleed through
    expect(item).not.toHaveProperty("owner_id");
    expect(item).not.toHaveProperty("creation_time");
    expect(item).not.toHaveProperty("user_permission");
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

  it("raw tuple id matches object.id for non-first siblings", async () => {
    const repo = new InMemoryWorkspaceRepository({
      directories: {
        "/u/home": [
          { name: "first.fa", type: "contigs" },
          { name: "second.fa", type: "contigs" },
        ],
      },
    });
    const [meta] = await repo.getMetadata(["/u/home/second.fa"]);
    const rawTuple = (meta.raw as unknown[][])[0];
    expect(meta.object?.id).toBe("/u/home/second.fa#1");
    expect(rawTuple[4]).toBe("/u/home/second.fa#1");
  });

  it("creates, reads, and appends legacy-compatible ID group content", async () => {
    const repo = new InMemoryWorkspaceRepository({
      directories: { "/u/home/Genome Groups": [] },
    });

    await repo.createIdGroup({
      path: "/u/home/Genome Groups",
      name: "selected",
      type: "genome_group",
      idField: "genome_id",
      ids: ["g1", "g2", "g1"],
    });
    await repo.appendToIdGroup({
      path: "/u/home/Genome Groups/selected",
      idField: "genome_id",
      ids: ["g2", "g3", "g3"],
    });

    const raw = (await repo.getRaw(["/u/home/Genome Groups/selected"], {
      metadataOnly: false,
    })) as unknown[][][];
    const entry = raw[0][0];
    expect((entry[0] as unknown[])[1]).toBe("genome_group");
    expect(JSON.parse(entry[1] as string)).toEqual({
      name: "selected",
      id_list: { genome_id: ["g1", "g2", "g3"] },
    });
    expect(repo.calls.map((call) => call.method)).toEqual([
      "createIdGroup",
      "appendToIdGroup",
      "getRaw",
    ]);
  });

  it("preserves unrelated ID lists, content fields, and metadata on append", async () => {
    const repo = new InMemoryWorkspaceRepository({
      directories: {
        "/u/home/Genome Groups": [
          {
            name: "selected",
            type: "genome_group",
            userMeta: { description: "keep me" },
            content: JSON.stringify({
              name: "selected",
              color: "blue",
              id_list: { genome_id: ["g1"], feature_id: ["f1"] },
            }),
          },
        ],
      },
    });

    await repo.appendToIdGroup({
      path: "/u/home/Genome Groups/selected",
      idField: "genome_id",
      ids: ["g2"],
    });

    const raw = (await repo.getRaw(["/u/home/Genome Groups/selected"], {
      metadataOnly: false,
    })) as unknown[][][];
    const entry = raw[0][0];
    expect((entry[0] as unknown[])[7]).toEqual({ description: "keep me" });
    expect(JSON.parse(entry[1] as string)).toEqual({
      name: "selected",
      color: "blue",
      id_list: { genome_id: ["g1", "g2"], feature_id: ["f1"] },
    });
  });

  it("rejects create overwrite and malformed append without mutating content", async () => {
    const malformed = JSON.stringify({ id_list: { genome_id: "g1" } });
    const repo = new InMemoryWorkspaceRepository({
      directories: {
        "/groups": [
          { name: "existing", type: "genome_group", content: malformed },
        ],
      },
    });

    await expect(
      repo.createIdGroup({
        path: "/groups",
        name: "existing",
        type: "genome_group",
        idField: "genome_id",
        ids: ["g2"],
      }),
    ).rejects.toBeInstanceOf(WorkspaceApiError);
    await expect(
      repo.appendToIdGroup({
        path: "/groups/existing",
        idField: "genome_id",
        ids: ["g2"],
      }),
    ).rejects.toThrow("id_list.genome_id must be a string array");

    const raw = (await repo.getRaw(["/groups/existing"], {
      metadataOnly: false,
    })) as unknown[][][];
    expect(raw[0][0][1]).toBe(malformed);
  });

  it("allows ID group operation error injection", async () => {
    const repo = new InMemoryWorkspaceRepository({
      errors: { appendToIdGroup: new Error("append failed") },
    });
    await expect(
      repo.appendToIdGroup({
        path: "/groups/missing",
        idField: "genome_id",
        ids: ["g1"],
      }),
    ).rejects.toThrow("append failed");
  });

  it("rejects delete of protected folders without recording the call or mutating fixtures", async () => {
    const repo = new InMemoryWorkspaceRepository({
      directories: {
        "/alice@bvbrc/home": [
          { name: "Genome Groups", type: "folder" },
          { name: "My Project", type: "folder" },
        ],
      },
    });

    await expect(
      repo.delete(["/alice@bvbrc/home/Genome Groups"]),
    ).rejects.toMatchObject({
      name: "ProtectedFolderError",
      protectedPaths: ["/alice@bvbrc/home/Genome Groups"],
    });

    expect(repo.calls.some((c) => c.method === "delete")).toBe(false);
    const remaining = await repo.listDirectory({ path: "/alice@bvbrc/home" });
    expect(remaining.map((i) => i.name)).toEqual([
      "Genome Groups",
      "My Project",
    ]);
  });
});
