import { WorkspaceApiClient } from "@/lib/services/workspace/client";

describe("WorkspaceApiClient", () => {
  let client: WorkspaceApiClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
    client = new WorkspaceApiClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("makeRequest", () => {
    it("sends POST to /api/services/workspace with method and params", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ result: [["item1"], ["item2"]] }),
      });

      await client.makeRequest("Workspace.get", [{ objects: ["/path"] }]);

      expect(mockFetch).toHaveBeenCalledWith("/api/services/workspace", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "Workspace.get",
          params: [{ objects: ["/path"] }],
        }),
      });
    });

    it("includes credentials: 'include'", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ result: [] }),
      });

      await client.makeRequest("Workspace.get", []);

      expect(mockFetch.mock.calls[0][1].credentials).toBe("include");
    });

    it("returns raw result for rawResultMethods (Workspace.get)", async () => {
      const rawResult = [
        [["file.txt", "txt", "/user/home/", "2026-01-01", "id1"]],
      ];
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ result: rawResult }),
      });

      const result = await client.makeRequest("Workspace.get", [
        { objects: ["/user/home/file.txt"] },
      ]);

      expect(result).toEqual(rawResult);
    });

    it("returns raw result for Workspace.create", async () => {
      const rawResult = [
        [["newFolder", "folder", "/user/home/", "2026-01-01", "id2"]],
      ];
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ result: rawResult }),
      });

      const result = await client.makeRequest("Workspace.create", [
        { objects: [["/user/home/newFolder", "folder", {}]] },
      ]);

      expect(result).toEqual(rawResult);
    });

    it("returns raw result for Workspace.delete", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ result: [["deleted"]] }),
      });

      const result = await client.makeRequest("Workspace.delete", [
        { objects: ["/path"] },
      ]);

      expect(result).toEqual([["deleted"]]);
    });

    it("returns raw result for Workspace.get_download_url", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ result: ["https://download.url"] }),
      });

      const result = await client.makeRequest("Workspace.get_download_url", [
        { objects: ["/path"] },
      ]);

      expect(result).toEqual(["https://download.url"]);
    });

    it("returns empty array when result is null for rawResultMethods", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ result: null }),
      });

      const result = await client.makeRequest("Workspace.get", []);

      expect(result).toEqual([]);
    });

    it("processes Workspace.ls results through metaListToObj", async () => {
      const lsResult = [
        {
          "/user/home/": [
            [
              "file.txt",
              "txt",
              "/user/home/",
              "2026-01-01T00:00:00Z",
              "id1",
              "user@bvbrc",
              1024,
              {},
              {},
              "r",
              "n",
              null,
            ],
          ],
        },
      ];
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ result: lsResult }),
      });

      const result = await client.makeRequest("Workspace.ls", [
        { paths: ["/user/home/"] },
      ]);

      expect(result).toEqual([
        {
          id: "id1",
          path: "/user/home/file.txt",
          name: "file.txt",
          type: "txt",
          creation_time: "2026-01-01T00:00:00Z",
          link_reference: null,
          owner_id: "user@bvbrc",
          size: 1024,
          userMeta: {},
          autoMeta: {},
          user_permission: "r",
          global_permission: "n",
          timestamp: Date.parse("2026-01-01T00:00:00Z"),
        },
      ]);
    });

    it("returns empty array when Workspace.ls result is empty", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ result: [null] }),
      });

      const result = await client.makeRequest("Workspace.ls", [
        { paths: ["/user/home/"] },
      ]);

      expect(result).toEqual([]);
    });

    it("handles Workspace.list_permissions specially", async () => {
      const permissionsMap = {
        "/user/home/": [
          ["user@bvbrc", "o"],
          ["other@bvbrc", "r"],
        ],
      };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ result: [permissionsMap] }),
      });

      const result = await client.makeRequest("Workspace.list_permissions", [
        { objects: ["/user/home/"] },
      ]);

      expect(result).toEqual(permissionsMap);
    });

    it("returns empty object when list_permissions result is missing", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ result: [null] }),
      });

      const result = await client.makeRequest("Workspace.list_permissions", []);

      expect(result).toEqual({});
    });

    it("throws on HTTP error", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: vi
          .fn()
          .mockResolvedValue({ error: "Internal server error" }),
      });

      await expect(
        client.makeRequest("Workspace.get", []),
      ).rejects.toThrow("Internal server error");
    });

    it("throws on HTTP error with fallback message when json parse fails", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 502,
        json: vi.fn().mockRejectedValue(new Error("parse fail")),
      });

      await expect(
        client.makeRequest("Workspace.get", []),
      ).rejects.toThrow("HTTP error! status: 502");
    });

    it("throws on JSON-RPC error response", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          error: { message: "Method not found" },
        }),
      });

      await expect(
        client.makeRequest("Workspace.get", []),
      ).rejects.toThrow("Method not found");
    });
  });
});
