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
          result: [{ "/user@bvbrc/home": [lsTuple({ 0: "file.fa", 4: "id-1" })] }],
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
    expect(meta?.path).toBe("/user@bvbrc/home/file.fa");
    expect(meta?.object).toEqual(
      expect.objectContaining({ id: "id-1", type: "contigs", size: 123 }),
    );
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
      .catch((err) => err);
    expect(error).toBeInstanceOf(WorkspaceApiError);
    expect((error as WorkspaceApiError).method).toBe("Workspace.ls");
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
});
