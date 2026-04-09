import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import {
  listPublicWorkspaces,
  listUserPublicWorkspaces,
  listPublicWorkspacePath,
} from "../public-client";

/**
 * Build a raw Workspace.ls item array matching metaListToObj index positions:
 * [name, type, path, create_time, id, owner_id, size, userMeta, autoMeta, user_perm, global_perm, link_ref]
 */
function rawItem(
  name: string,
  parentPath: string,
  globalPermission: string,
): unknown[] {
  return [name, "folder", parentPath, "2026-01-01", `id-${name}`, "owner", 0, {}, {}, "o", globalPermission, null];
}

/** Helper to create a Workspace.ls JSON-RPC response keyed by path */
function lsResponse(path: string, items: unknown[][]) {
  return { result: [{ [path]: items }] };
}

/** Default MSW handler returning an empty result */
function emptyHandler() {
  return http.post("/api/workspace/public", () =>
    HttpResponse.json({ result: [{}] }),
  );
}

describe("listPublicWorkspaces", () => {
  it("returns only workspaces with global_permission != 'n'", async () => {
    const items = [
      rawItem("public-ws", "/", "r"),
      rawItem("private-ws", "/", "n"),
    ];

    server.use(
      http.post("/api/workspace/public", async ({ request }) => {
        const body = await request.json() as { params: unknown[] };
        const params = body.params[0] as { paths: string[] };
        return HttpResponse.json(lsResponse(params.paths[0], items));
      }),
    );

    const result = await listPublicWorkspaces();

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(expect.objectContaining({ global_permission: "r" }));
  });

  it("returns empty array when no public workspaces exist", async () => {
    server.use(emptyHandler());

    const result = await listPublicWorkspaces();

    expect(result).toEqual([]);
  });
});

describe("listUserPublicWorkspaces", () => {
  it("returns empty array for empty username", async () => {
    const result = await listUserPublicWorkspaces("");

    expect(result).toEqual([]);
  });

  it("appends @bvbrc when username lacks a domain", async () => {
    let capturedBody: { params: unknown[] } | null = null;

    server.use(
      http.post("/api/workspace/public", async ({ request }) => {
        capturedBody = await request.json() as { params: unknown[] };
        return HttpResponse.json({ result: [{}] });
      }),
    );

    await listUserPublicWorkspaces("testuser");

    const params = (capturedBody?.params[0] as { paths: string[] });
    expect(params.paths[0]).toBe("/testuser@bvbrc");
  });

  it("uses full username when it already contains @", async () => {
    let capturedBody: { params: unknown[] } | null = null;

    server.use(
      http.post("/api/workspace/public", async ({ request }) => {
        capturedBody = await request.json() as { params: unknown[] };
        return HttpResponse.json({ result: [{}] });
      }),
    );

    await listUserPublicWorkspaces("user@patricbrc.org");

    const params = (capturedBody?.params[0] as { paths: string[] });
    expect(params.paths[0]).toBe("/user@patricbrc.org");
  });

  it("decodes URI-encoded username", async () => {
    let capturedBody: { params: unknown[] } | null = null;

    server.use(
      http.post("/api/workspace/public", async ({ request }) => {
        capturedBody = await request.json() as { params: unknown[] };
        return HttpResponse.json({ result: [{}] });
      }),
    );

    await listUserPublicWorkspaces("user%40bvbrc");

    const params = (capturedBody?.params[0] as { paths: string[] });
    expect(params.paths[0]).toBe("/user@bvbrc");
  });

  it("filters out private workspaces", async () => {
    const items = [
      rawItem("public", "/user@bvbrc", "w"),
      rawItem("private", "/user@bvbrc", "n"),
    ];

    server.use(
      http.post("/api/workspace/public", async ({ request }) => {
        const body = await request.json() as { params: unknown[] };
        const params = body.params[0] as { paths: string[] };
        return HttpResponse.json(lsResponse(params.paths[0], items));
      }),
    );

    const result = await listUserPublicWorkspaces("user@bvbrc");

    expect(result).toHaveLength(1);
  });
});

describe("listPublicWorkspacePath", () => {
  it("normalizes path with leading slash", async () => {
    let capturedBody: { params: unknown[] } | null = null;

    server.use(
      http.post("/api/workspace/public", async ({ request }) => {
        capturedBody = await request.json() as { params: unknown[] };
        return HttpResponse.json({ result: [{}] });
      }),
    );

    await listPublicWorkspacePath("user@bvbrc/home");

    const params = (capturedBody?.params[0] as { paths: string[] });
    expect(params.paths[0]).toBe("/user@bvbrc/home");
  });

  it("does not double-prepend leading slash", async () => {
    let capturedBody: { params: unknown[] } | null = null;

    server.use(
      http.post("/api/workspace/public", async ({ request }) => {
        capturedBody = await request.json() as { params: unknown[] };
        return HttpResponse.json({ result: [{}] });
      }),
    );

    await listPublicWorkspacePath("/user@bvbrc/home");

    const params = (capturedBody?.params[0] as { paths: string[] });
    expect(params.paths[0]).toBe("/user@bvbrc/home");
  });

  it("decodes URI-encoded path", async () => {
    let capturedBody: { params: unknown[] } | null = null;

    server.use(
      http.post("/api/workspace/public", async ({ request }) => {
        capturedBody = await request.json() as { params: unknown[] };
        return HttpResponse.json({ result: [{}] });
      }),
    );

    await listPublicWorkspacePath("/user%40bvbrc/home");

    const params = (capturedBody?.params[0] as { paths: string[] });
    expect(params.paths[0]).toBe("/user@bvbrc/home");
  });
});
