import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { HttpWorkspaceRepository } from "@/lib/services/workspace/adapters/http-workspace-repository";
import { WorkspaceApiError } from "@/lib/services/workspace/domain";

function lsTuple(overrides: Partial<Record<number, unknown>> = {}) {
  const base: unknown[] = [
    "file.fa",
    "contigs",
    "/user@bvbrc/home/",
    "2026-04-01",
    "id-1",
    "user@bvbrc",
    123,
    {},
    {},
    "o",
    "n",
    "",
  ];
  for (const [idx, value] of Object.entries(overrides)) {
    base[Number(idx)] = value;
  }
  return base;
}

describe("HttpWorkspaceRepository", () => {
  let repository: HttpWorkspaceRepository;

  beforeEach(() => {
    repository = new HttpWorkspaceRepository();
  });

  it("sends a JSON-RPC envelope with credentials", async () => {
    let body: unknown;
    let capturedHeaders: Headers | undefined;
    server.use(
      http.post("/api/services/workspace", async ({ request }) => {
        body = await request.json();
        capturedHeaders = request.headers;
        return HttpResponse.json({ result: [{ "/p": [] }] });
      }),
    );

    await repository.listDirectory({ path: "/p" });

    expect(body).toEqual(
      expect.objectContaining({
        id: 1,
        jsonrpc: "2.0",
        method: "Workspace.ls",
        params: [expect.objectContaining({ paths: ["/p"] })],
      }),
    );
    expect(capturedHeaders?.get("content-type")).toBe("application/json");
  });

  it("lists canonical workspace items for a directory", async () => {
    server.use(
      http.post("/api/services/workspace", () =>
        HttpResponse.json({
          result: [
            { "/user@bvbrc/home": [lsTuple({ 0: "file.fa", 4: "id-1" })] },
          ],
        }),
      ),
    );

    const items = await repository.listDirectory({ path: "/user@bvbrc/home" });
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual(
      expect.objectContaining({
        id: "id-1",
        name: "file.fa",
        path: "/user@bvbrc/home/file.fa",
        type: "contigs",
        permissions: { user: "o", global: "n" },
      }),
    );
  });

  it("parses Workspace.get metadata into WorkspaceMetadata", async () => {
    server.use(
      http.post("/api/services/workspace", () =>
        HttpResponse.json({
          result: [
            [
              [
                [
                  "file.fa",
                  "contigs",
                  "/user@bvbrc/home/",
                  "2026-04-01",
                  "id-1",
                  "user@bvbrc",
                  123,
                  {},
                  {},
                ],
              ],
            ],
          ],
        }),
      ),
    );

    const [meta] = await repository.getMetadata(["/user@bvbrc/home/file.fa"]);
    expect(meta.path).toBe("/user@bvbrc/home/file.fa");
    expect(meta.object).toEqual(
      expect.objectContaining({ id: "id-1", type: "contigs", size: 123 }),
    );
  });

  it("stores only the requested path slice on Workspace.get metadata raw", async () => {
    const firstTuple = [
      "file-a.fa",
      "contigs",
      "/user@bvbrc/home/",
      "2026-04-01",
      "id-a",
      "user@bvbrc",
      123,
      {},
      {},
    ];
    const secondTuple = [
      "file-b.fa",
      "contigs",
      "/user@bvbrc/home/",
      "2026-04-02",
      "id-b",
      "user@bvbrc",
      456,
      {},
      {},
    ];
    server.use(
      http.post("/api/services/workspace", () =>
        HttpResponse.json({
          result: [[[firstTuple], [secondTuple]]],
        }),
      ),
    );

    const [first, second] = await repository.getMetadata([
      "/user@bvbrc/home/file-a.fa",
      "/user@bvbrc/home/file-b.fa",
    ]);

    expect(first.raw).toEqual([firstTuple]);
    expect(second.raw).toEqual([secondTuple]);
    expect(first.raw).not.toEqual(second.raw);
    expect(first.object?.raw).toEqual(expect.objectContaining({ id: "id-a" }));
    expect(second.object?.raw).toEqual(expect.objectContaining({ id: "id-b" }));
  });

  it("returns permissions map from list_permissions", async () => {
    server.use(
      http.post("/api/services/workspace", () =>
        HttpResponse.json({ result: [{ "/a": [["alice", "w"]] }] }),
      ),
    );
    const perms = await repository.listPermissions(["/a"]);
    expect(perms).toEqual({ "/a": [["alice", "w"]] });
  });

  it("throws WorkspaceApiError with code when API returns an error envelope", async () => {
    server.use(
      http.post("/api/services/workspace", () =>
        HttpResponse.json({ error: { code: -32603, message: "overwrite" } }),
      ),
    );

    await expect(
      repository.copy({ pairs: [["/a", "/b"]] }),
    ).rejects.toMatchObject({
      name: "WorkspaceApiError",
      method: "Workspace.copy",
      code: -32603,
    });
  });

  it("wraps HTTP errors with apiResponse", async () => {
    server.use(
      http.post("/api/services/workspace", () =>
        HttpResponse.json({ error: "Unauthorized" }, { status: 401 }),
      ),
    );

    const error = await repository
      .listDirectory({ path: "/p" })
      .catch((err: unknown) => err);
    expect(error).toBeInstanceOf(WorkspaceApiError);
    expect((error as WorkspaceApiError).method).toBe("Workspace.ls");
  });

  it("uses nested HTTP error messages when the proxy returns an error object", async () => {
    server.use(
      http.post("/api/services/workspace", () =>
        HttpResponse.json(
          { error: { code: -32603, message: "Workspace detail" } },
          { status: 500 },
        ),
      ),
    );

    await expect(
      repository.listDirectory({ path: "/p" }),
    ).rejects.toMatchObject({
      message: "Workspace detail",
      apiResponse: { code: -32603, message: "Workspace detail" },
    });
  });

  it("allows void write methods to omit result", async () => {
    server.use(
      http.post("/api/services/workspace", () =>
        HttpResponse.json({ id: 1, jsonrpc: "2.0" }),
      ),
    );

    await expect(repository.delete(["/a"])).resolves.toBeUndefined();
  });

  it("throws ProtectedFolderError before issuing RPC when path is the home folder", async () => {
    let rpcCalled = false;
    server.use(
      http.post("/api/services/workspace", () => {
        rpcCalled = true;
        return HttpResponse.json({ id: 1, jsonrpc: "2.0" });
      }),
    );

    await expect(
      repository.delete(["/alice@bvbrc/home"]),
    ).rejects.toMatchObject({
      name: "ProtectedFolderError",
      protectedPaths: ["/alice@bvbrc/home"],
    });
    expect(rpcCalled).toBe(false);
  });

  it("throws ProtectedFolderError when any path is a protected sub-folder", async () => {
    let rpcCalled = false;
    server.use(
      http.post("/api/services/workspace", () => {
        rpcCalled = true;
        return HttpResponse.json({ id: 1, jsonrpc: "2.0" });
      }),
    );

    await expect(
      repository.delete([
        "/alice@bvbrc/home/My Project",
        "/alice@bvbrc/home/Genome Groups",
      ]),
    ).rejects.toMatchObject({
      name: "ProtectedFolderError",
      protectedPaths: ["/alice@bvbrc/home/Genome Groups"],
    });
    expect(rpcCalled).toBe(false);
  });

  it("sends archive_url request with camelCase translated fields", async () => {
    let body: unknown;
    server.use(
      http.post("/api/services/workspace", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ result: ["https://s/1", 3, 4096] });
      }),
    );

    const result = await repository.getArchiveUrl({
      paths: ["/a"],
      recursive: true,
      archiveName: "out",
      archiveType: "zip",
    });
    expect(result).toEqual(["https://s/1", 3, 4096]);
    expect(body).toEqual(
      expect.objectContaining({
        method: "Workspace.get_archive_url",
        params: [
          expect.objectContaining({
            archive_name: "out",
            archive_type: "zip",
            recursive: true,
          }),
        ],
      }),
    );
  });

  it("filters searchObjects by requested types", async () => {
    server.use(
      http.post("/api/services/workspace", () =>
        HttpResponse.json({
          result: [
            {
              "/user@bvbrc/home/": [
                lsTuple({ 0: "reads.fq", 1: "reads", 4: "id-1" }),
                lsTuple({ 0: "other", 1: "contigs", 4: "id-2" }),
              ],
            },
          ],
        }),
      ),
    );

    const items = await repository.searchObjects({
      username: "user",
      types: ["reads"],
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.type).toBe("reads");
  });

  it("creates a legacy-compatible ID group without overwrite", async () => {
    let body: Record<string, unknown> = {};
    server.use(
      http.post("/api/services/workspace", async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: 1, jsonrpc: "2.0" });
      }),
    );

    await repository.createIdGroup({
      path: "/user@bvbrc/home/Genome Groups/",
      name: "selected",
      type: "genome_group",
      idField: "genome_id",
      ids: ["g1", "g2", "g1"],
    });

    expect(body).toEqual(
      expect.objectContaining({
        method: "Workspace.create",
        params: [
          {
            objects: [
              [
                "/user@bvbrc/home/Genome Groups/selected",
                "genome_group",
                {},
                JSON.stringify({
                  name: "selected",
                  id_list: { genome_id: ["g1", "g2"] },
                }),
              ],
            ],
            overwrite: 0,
          },
        ],
      }),
    );
  });

  it("appends unique IDs while preserving content, type, and user metadata", async () => {
    const bodies: Record<string, unknown>[] = [];
    const metadata = [
      "selected",
      "genome_group",
      "/user@bvbrc/home/Genome Groups/",
      "2026-04-01",
      "id-1",
      "user@bvbrc",
      123,
      { description: "keep me" },
      {},
    ];
    server.use(
      http.post("/api/services/workspace", async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        bodies.push(body);
        if (body.method === "Workspace.get") {
          return HttpResponse.json({
            result: [
              [
                [
                  metadata,
                  JSON.stringify({
                    name: "selected",
                    description: "content metadata",
                    id_list: {
                      genome_id: ["g1", "g2"],
                      feature_id: ["f1"],
                    },
                  }),
                ],
              ],
            ],
          });
        }
        return HttpResponse.json({ id: 1, jsonrpc: "2.0" });
      }),
    );

    await repository.appendToIdGroup({
      path: "/user@bvbrc/home/Genome Groups/selected",
      idField: "genome_id",
      ids: ["g2", "g3", "g3"],
    });

    expect(bodies[0]).toEqual(
      expect.objectContaining({
        method: "Workspace.get",
        params: [
          {
            objects: ["/user@bvbrc/home/Genome Groups/selected"],
            metadata_only: false,
          },
        ],
      }),
    );
    expect(bodies[1]).toEqual(
      expect.objectContaining({
        method: "Workspace.create",
        params: [
          {
            objects: [
              [
                "/user@bvbrc/home/Genome Groups/selected",
                "genome_group",
                { description: "keep me" },
                JSON.stringify({
                  name: "selected",
                  description: "content metadata",
                  id_list: {
                    genome_id: ["g1", "g2", "g3"],
                    feature_id: ["f1"],
                  },
                }),
              ],
            ],
            overwrite: 1,
          },
        ],
      }),
    );
  });

  it("refuses to overwrite an ID group with malformed content", async () => {
    const methods: unknown[] = [];
    server.use(
      http.post("/api/services/workspace", async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        methods.push(body.method);
        return HttpResponse.json({
          result: [
            [
              [
                [
                  "bad",
                  "genome_group",
                  "/groups/",
                  "",
                  "id",
                  "owner",
                  0,
                  {},
                  {},
                ],
                JSON.stringify({ id_list: { genome_id: ["g1", 2] } }),
              ],
            ],
          ],
        });
      }),
    );

    await expect(
      repository.appendToIdGroup({
        path: "/groups/bad",
        idField: "genome_id",
        ids: ["g2"],
      }),
    ).rejects.toThrow("id_list.genome_id must be a string array");
    expect(methods).toEqual(["Workspace.get"]);
  });

  it("preserves backend failures from ID group creation", async () => {
    server.use(
      http.post("/api/services/workspace", () =>
        HttpResponse.json({ error: { code: -32603, message: "Group exists" } }),
      ),
    );

    await expect(
      repository.createIdGroup({
        path: "/groups",
        name: "existing",
        type: "genome_group",
        idField: "genome_id",
        ids: ["g1"],
      }),
    ).rejects.toMatchObject({ message: "Group exists", code: -32603 });
  });
});
