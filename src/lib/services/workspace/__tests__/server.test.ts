import { http, HttpResponse } from "msw";

import { server } from "@/test-helpers/msw-server";
import {
  listSharedWithUserServer,
  listByFullPathServer,
  listPermissionsServer,
} from "@/lib/services/workspace/server";

vi.mock("@/lib/auth/session", () => ({
  getAuthToken: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  getRequiredEnv: vi.fn(() => "https://workspace-api.example.com"),
}));

vi.mock("@/lib/services/workspace/helpers", () => ({
  metaListToObj: vi.fn((list: unknown[]) => ({
    id: list[4],
    path: String(list[2] ?? "") + String(list[0] ?? ""),
    name: list[0],
    type: list[1],
    creation_time: list[3],
    link_reference: list[11],
    owner_id: list[5],
    size: list[6],
    userMeta: list[7],
    autoMeta: list[8],
    user_permission: list[9],
    global_permission: list[10],
    timestamp: Date.parse(String(list[3])),
  })),
}));

import { getAuthToken } from "@/lib/auth/session";
const mockGetToken = vi.mocked(getAuthToken);

describe("server workspace functions", () => {
  describe("workspaceRequest (tested via exported functions)", () => {
    it("throws when unauthenticated", async () => {
      mockGetToken.mockResolvedValue(null);

      let handlerCalled = false;
      server.use(
        http.post("https://workspace-api.example.com", () => {
          handlerCalled = true;
          return HttpResponse.json({});
        }),
      );

      await expect(listSharedWithUserServer()).rejects.toThrow(
        "Authentication required",
      );

      expect(handlerCalled).toBe(false);
    });

    it("sends correct JSON-RPC envelope", async () => {
      mockGetToken.mockResolvedValue("auth-token-123");

      let capturedBody: unknown;
      let capturedHeaders: Headers | undefined;

      server.use(
        http.post(
          "https://workspace-api.example.com",
          async ({ request }) => {
            capturedBody = await request.json();
            capturedHeaders = request.headers;
            return HttpResponse.json({
              result: [{ "/": [] }],
            });
          },
        ),
      );

      await listSharedWithUserServer();

      expect(capturedHeaders?.get("Content-Type")).toBe(
        "application/jsonrpc+json",
      );
      expect(capturedHeaders?.get("Authorization")).toBe("auth-token-123");

      expect(capturedBody).toEqual(
        expect.objectContaining({
          id: 1,
          method: "Workspace.ls",
          jsonrpc: "2.0",
        }),
      );
    });

    it("throws on non-ok response", async () => {
      mockGetToken.mockResolvedValue("auth-token-123");

      server.use(
        http.post("https://workspace-api.example.com", () => {
          return HttpResponse.json(
            {},
            { status: 500, statusText: "Internal Server Error" },
          );
        }),
      );

      await expect(listSharedWithUserServer()).rejects.toThrow(
        "Workspace API error: 500 Internal Server Error",
      );
    });

    it("throws on API error response", async () => {
      mockGetToken.mockResolvedValue("auth-token-123");

      server.use(
        http.post("https://workspace-api.example.com", () => {
          return HttpResponse.json({
            error: { message: "Object not found" },
          });
        }),
      );

      await expect(listByFullPathServer("/some/path")).rejects.toThrow(
        "Object not found",
      );
    });

    it("uses default error message when API error has no message", async () => {
      mockGetToken.mockResolvedValue("auth-token-123");

      server.use(
        http.post("https://workspace-api.example.com", () => {
          return HttpResponse.json({
            error: {},
          });
        }),
      );

      await expect(listByFullPathServer("/some/path")).rejects.toThrow(
        "Workspace API error",
      );
    });
  });

  describe("listSharedWithUserServer", () => {
    it("returns filtered shared items", async () => {
      mockGetToken.mockResolvedValue("auth-token-123");

      // Build raw tuples that metaListToObj will transform
      // [name, type, parentPath, creation_time, id, owner_id, size, userMeta, autoMeta, user_perm, global_perm, link_ref]
      const sharedTuple = [
        "shared-folder", "folder", "/other@bvbrc/", "2024-01-01",
        "id1", "other", 0, {}, {}, "r", "n", null,
      ];
      const ownedTuple = [
        "my-folder", "folder", "/me@bvbrc/", "2024-01-01",
        "id2", "me", 0, {}, {}, "o", "n", null,
      ];
      const publicTuple = [
        "public-folder", "folder", "/pub@bvbrc/", "2024-01-01",
        "id3", "pub", 0, {}, {}, "r", "r", null,
      ];

      server.use(
        http.post("https://workspace-api.example.com", () => {
          return HttpResponse.json({
            result: [
              { "/": [sharedTuple, ownedTuple, publicTuple] },
            ],
          });
        }),
      );

      const result = await listSharedWithUserServer();

      // "shared-folder" has global_permission "n" and user_permission "r" (not "o") => included
      // "my-folder" has global_permission "n" and user_permission "o" => excluded (owned)
      // "public-folder" has global_permission "r" (not "n") => excluded (public)
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          name: "shared-folder",
          global_permission: "n",
          user_permission: "r",
        }),
      );
    });

    it("returns empty when no result data", async () => {
      mockGetToken.mockResolvedValue("auth-token-123");

      server.use(
        http.post("https://workspace-api.example.com", () => {
          return HttpResponse.json({ result: [] });
        }),
      );

      const result = await listSharedWithUserServer();

      expect(result).toEqual([]);
    });
  });

  describe("listByFullPathServer", () => {
    it("normalizes path by adding leading slash", async () => {
      mockGetToken.mockResolvedValue("auth-token-123");

      let capturedBody: unknown;

      server.use(
        http.post(
          "https://workspace-api.example.com",
          async ({ request }) => {
            capturedBody = await request.json();
            return HttpResponse.json({
              result: [
                { "/owner@bvbrc/folder": [] },
              ],
            });
          },
        ),
      );

      await listByFullPathServer("owner@bvbrc/folder");

      expect(
        (capturedBody as Record<string, unknown>).params,
      ).toEqual([
        expect.objectContaining({
          paths: ["/owner@bvbrc/folder"],
        }),
      ]);
    });

    it("returns empty array when no data in result", async () => {
      mockGetToken.mockResolvedValue("auth-token-123");

      server.use(
        http.post("https://workspace-api.example.com", () => {
          return HttpResponse.json({ result: [] });
        }),
      );

      const result = await listByFullPathServer("/owner@bvbrc/folder");

      expect(result).toEqual([]);
    });

    it("returns items from the response", async () => {
      mockGetToken.mockResolvedValue("auth-token-123");

      const fileTuple = [
        "file.txt", "file", "/owner@bvbrc/folder/", "2024-01-01",
        "id1", "owner", 1024, {}, {}, "o", "n", null,
      ];

      server.use(
        http.post("https://workspace-api.example.com", () => {
          return HttpResponse.json({
            result: [
              { "/owner@bvbrc/folder": [fileTuple] },
            ],
          });
        }),
      );

      const result = await listByFullPathServer("/owner@bvbrc/folder");

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          name: "file.txt",
          type: "file",
        }),
      );
    });
  });

  describe("listPermissionsServer", () => {
    it("returns empty object for empty paths array", async () => {
      mockGetToken.mockResolvedValue("auth-token-123");

      let handlerCalled = false;
      server.use(
        http.post("https://workspace-api.example.com", () => {
          handlerCalled = true;
          return HttpResponse.json({});
        }),
      );

      const result = await listPermissionsServer([]);

      expect(result).toEqual({});
      expect(handlerCalled).toBe(false);
    });

    it("returns permissions from the response", async () => {
      mockGetToken.mockResolvedValue("auth-token-123");

      const permissionsData = {
        "/owner@bvbrc/folder": [
          ["user1", "r"],
          ["user2", "w"],
        ],
      };

      server.use(
        http.post("https://workspace-api.example.com", () => {
          return HttpResponse.json({
            result: [permissionsData],
          });
        }),
      );

      const result = await listPermissionsServer(["/owner@bvbrc/folder"]);

      expect(result).toEqual(permissionsData);
    });

    it("returns empty object when result has no data", async () => {
      mockGetToken.mockResolvedValue("auth-token-123");

      server.use(
        http.post("https://workspace-api.example.com", () => {
          return HttpResponse.json({ result: [] });
        }),
      );

      const result = await listPermissionsServer(["/some/path"]);

      expect(result).toEqual({});
    });
  });
});
