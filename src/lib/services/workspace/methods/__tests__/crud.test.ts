import { WorkspaceCrudMethods } from "@/lib/services/workspace/methods/crud";

const mockClient = { makeRequest: vi.fn() };
const crud = new WorkspaceCrudMethods(mockClient as never);

describe("WorkspaceCrudMethods", () => {
  describe("create", () => {
    it("delegates to Workspace.create with given params", async () => {
      const params = { objects: [{ workspace: "ws1", id: "file.txt", type: "file" }] };
      mockClient.makeRequest.mockResolvedValue([["created"]]);

      const result = await crud.create(params);

      expect(mockClient.makeRequest).toHaveBeenCalledWith("Workspace.create", [params]);
      expect(result).toEqual([["created"]]);
    });
  });

  describe("createFolderByPath", () => {
    it("sends path-based Workspace.create with Directory type", async () => {
      mockClient.makeRequest.mockResolvedValue([["folder-created"]]);

      const result = await crud.createFolderByPath("/user@bvbrc/home/Testing/newfolder");

      expect(mockClient.makeRequest).toHaveBeenCalledWith("Workspace.create", [
        { objects: [["/user@bvbrc/home/Testing/newfolder", "Directory"]] },
      ]);
      expect(result).toEqual([["folder-created"]]);
    });
  });

  describe("createUploadNode", () => {
    it("returns link_reference on success", async () => {
      const shockUrl = "https://shock.example.com/node/abc123";
      // result[0][0] is the tuple, index 11 is link_reference
      const tuple = [
        "file.txt", "file", "/user@bvbrc/home/", "2024-01-01",
        "id1", "owner", 0, {}, {}, "r", "n", shockUrl,
      ];
      mockClient.makeRequest.mockResolvedValue([[tuple]]);

      const result = await crud.createUploadNode("/user@bvbrc/home/", "file.txt", "contigs");

      expect(mockClient.makeRequest).toHaveBeenCalledWith("Workspace.create", [
        {
          objects: [["/user@bvbrc/home/file.txt", "contigs", {}, ""]],
          createUploadNodes: true,
        },
      ]);
      expect(result).toEqual({ link_reference: shockUrl });
    });

    it("appends trailing slash to directoryPath when missing", async () => {
      const tuple = [
        "file.txt", "file", "/user@bvbrc/home/", "2024-01-01",
        "id1", "owner", 0, {}, {}, "r", "n", "https://shock.example.com/node/xyz",
      ];
      mockClient.makeRequest.mockResolvedValue([[tuple]]);

      await crud.createUploadNode("/user@bvbrc/home", "file.txt", "contigs");

      expect(mockClient.makeRequest).toHaveBeenCalledWith("Workspace.create", [
        {
          objects: [["/user@bvbrc/home/file.txt", "contigs", {}, ""]],
          createUploadNodes: true,
        },
      ]);
    });

    it("throws when no link_reference in result", async () => {
      // tuple[11] is undefined (no link_reference)
      const tuple = [
        "file.txt", "file", "/user@bvbrc/home/", "2024-01-01",
        "id1", "owner", 0, {}, {}, "r", "n",
      ];
      mockClient.makeRequest.mockResolvedValue([[tuple]]);

      await expect(
        crud.createUploadNode("/user@bvbrc/home/", "file.txt", "contigs"),
      ).rejects.toThrow("Workspace.create did not return a Shock URL (link_reference)");
    });
  });

  describe("delete", () => {
    it("delegates to Workspace.delete with given params", async () => {
      const params = { objects: ["/user@bvbrc/home/file.txt"] };
      mockClient.makeRequest.mockResolvedValue([["deleted"]]);

      const result = await crud.delete(params);

      expect(mockClient.makeRequest).toHaveBeenCalledWith("Workspace.delete", [params]);
      expect(result).toEqual([["deleted"]]);
    });
  });

  describe("deleteObject", () => {
    it("wraps single path in objects array", async () => {
      mockClient.makeRequest.mockResolvedValue([["deleted"]]);

      await crud.deleteObject("/user@bvbrc/home/file.txt");

      expect(mockClient.makeRequest).toHaveBeenCalledWith("Workspace.delete", [
        { objects: ["/user@bvbrc/home/file.txt"] },
      ]);
    });
  });

  describe("copyByPaths", () => {
    it("delegates to Workspace.copy with silent option", async () => {
      const params = { objects: [["/src/path", "/dest/path"]] };
      mockClient.makeRequest.mockResolvedValue([["copied"]]);

      const result = await crud.copyByPaths(params as never);

      expect(mockClient.makeRequest).toHaveBeenCalledWith(
        "Workspace.copy",
        [params],
        { silent: true },
      );
      expect(result).toEqual([["copied"]]);
    });
  });

  describe("move", () => {
    it("delegates to Workspace.move with given params", async () => {
      const params = {
        objects: [{ workspace: "ws1", id: "old.txt" }],
        new_workspace: "ws2",
        new_id: "new.txt",
      };
      mockClient.makeRequest.mockResolvedValue([["moved"]]);

      const result = await crud.move(params);

      expect(mockClient.makeRequest).toHaveBeenCalledWith("Workspace.move", [params]);
      expect(result).toEqual([["moved"]]);
    });
  });

  describe("rename", () => {
    it("delegates to Workspace.rename with given params", async () => {
      const params = {
        objects: [{ workspace: "ws1", id: "old.txt" }],
        new_name: "new.txt",
      };
      mockClient.makeRequest.mockResolvedValue([["renamed"]]);

      const result = await crud.rename(params);

      expect(mockClient.makeRequest).toHaveBeenCalledWith("Workspace.rename", [params]);
      expect(result).toEqual([["renamed"]]);
    });
  });

  describe("get", () => {
    it("delegates to Workspace.get with given params", async () => {
      const params = {
        objects: [{ workspace: "ws1", id: "file.txt" }],
        infos: [{ workspace: "ws1", id: "file.txt", metadata_only: true }],
      };
      mockClient.makeRequest.mockResolvedValue([["got"]]);

      const result = await crud.get(params);

      expect(mockClient.makeRequest).toHaveBeenCalledWith("Workspace.get", [params]);
      expect(result).toEqual([["got"]]);
    });
  });

  describe("updateObjectType", () => {
    it("delegates to Workspace.update_metadata with objects tuple", async () => {
      mockClient.makeRequest.mockResolvedValue([["updated"]]);

      const result = await crud.updateObjectType("/user@bvbrc/home/file.txt", "contigs");

      expect(mockClient.makeRequest).toHaveBeenCalledWith("Workspace.update_metadata", [
        { objects: [["/user@bvbrc/home/file.txt", {}, "contigs"]] },
      ]);
      expect(result).toEqual([["updated"]]);
    });
  });

  describe("updateAutoMetadata", () => {
    it("delegates to Workspace.update_auto_meta with paths", async () => {
      mockClient.makeRequest.mockResolvedValue([["auto-meta"]]);

      const result = await crud.updateAutoMetadata(["/user@bvbrc/home/file.txt"]);

      expect(mockClient.makeRequest).toHaveBeenCalledWith("Workspace.update_auto_meta", [
        { objects: ["/user@bvbrc/home/file.txt"] },
      ]);
      expect(result).toEqual([["auto-meta"]]);
    });
  });

  describe("save", () => {
    it("delegates to Workspace.save with given params", async () => {
      const params = {
        objects: [{ workspace: "ws1", id: "file.txt", type: "file", meta: {} }],
      };
      mockClient.makeRequest.mockResolvedValue([["saved"]]);

      const result = await crud.save(params);

      expect(mockClient.makeRequest).toHaveBeenCalledWith("Workspace.save", [params]);
      expect(result).toEqual([["saved"]]);
    });
  });

  describe("deleteMultipleObjects", () => {
    it("delegates to Workspace.delete with array of paths", async () => {
      const paths = ["/user@bvbrc/home/a.txt", "/user@bvbrc/home/b.txt"];
      mockClient.makeRequest.mockResolvedValue([["deleted"]]);

      const result = await crud.deleteMultipleObjects(paths);

      expect(mockClient.makeRequest).toHaveBeenCalledWith("Workspace.delete", [
        { objects: paths },
      ]);
      expect(result).toEqual([["deleted"]]);
    });
  });

  describe("copy", () => {
    it("delegates to Workspace.copy with given params", async () => {
      const params = {
        objects: [{ workspace: "ws1", id: "file.txt" }],
        new_workspace: "ws2",
        new_id: "copy.txt",
      };
      mockClient.makeRequest.mockResolvedValue([["copied"]]);

      const result = await crud.copy(params);

      expect(mockClient.makeRequest).toHaveBeenCalledWith("Workspace.copy", [params]);
      expect(result).toEqual([["copied"]]);
    });
  });

  describe("copyObject", () => {
    it("builds copy params from individual arguments", async () => {
      mockClient.makeRequest.mockResolvedValue([["copied"]]);

      await crud.copyObject("ws1", "file.txt", "ws2", "copy.txt");

      expect(mockClient.makeRequest).toHaveBeenCalledWith("Workspace.copy", [
        {
          objects: [{ workspace: "ws1", id: "file.txt" }],
          new_workspace: "ws2",
          new_id: "copy.txt",
        },
      ]);
    });
  });

  describe("moveObject", () => {
    it("builds move params from individual arguments", async () => {
      mockClient.makeRequest.mockResolvedValue([["moved"]]);

      await crud.moveObject("ws1", "old.txt", "ws2", "new.txt");

      expect(mockClient.makeRequest).toHaveBeenCalledWith("Workspace.move", [
        {
          objects: [{ workspace: "ws1", id: "old.txt" }],
          new_workspace: "ws2",
          new_id: "new.txt",
        },
      ]);
    });
  });

  describe("renameObject", () => {
    it("builds rename params from individual arguments", async () => {
      mockClient.makeRequest.mockResolvedValue([["renamed"]]);

      await crud.renameObject("ws1", "old.txt", "new.txt");

      expect(mockClient.makeRequest).toHaveBeenCalledWith("Workspace.rename", [
        {
          objects: [{ workspace: "ws1", id: "old.txt" }],
          new_name: "new.txt",
        },
      ]);
    });
  });

  describe("getObjectMetadata", () => {
    it("builds get params with metadata_only: true", async () => {
      mockClient.makeRequest.mockResolvedValue([["metadata"]]);

      await crud.getObjectMetadata("ws1", "file.txt");

      expect(mockClient.makeRequest).toHaveBeenCalledWith("Workspace.get", [
        {
          objects: [{ workspace: "ws1", id: "file.txt" }],
          infos: [{ workspace: "ws1", id: "file.txt", metadata_only: true }],
        },
      ]);
    });
  });

  describe("getObjectWithData", () => {
    it("builds get params with metadata_only: false", async () => {
      mockClient.makeRequest.mockResolvedValue([["data"]]);

      await crud.getObjectWithData("ws1", "file.txt");

      expect(mockClient.makeRequest).toHaveBeenCalledWith("Workspace.get", [
        {
          objects: [{ workspace: "ws1", id: "file.txt" }],
          infos: [{ workspace: "ws1", id: "file.txt", metadata_only: false }],
        },
      ]);
    });
  });

  describe("saveObject", () => {
    it("builds save params with data", async () => {
      mockClient.makeRequest.mockResolvedValue([["saved"]]);

      await crud.saveObject("ws1", "file.txt", "nk_file", { desc: "test" }, "content");

      expect(mockClient.makeRequest).toHaveBeenCalledWith("Workspace.save", [
        {
          objects: [
            { workspace: "ws1", id: "file.txt", type: "nk_file", meta: { desc: "test" }, data: "content" },
          ],
        },
      ]);
    });

    it("builds save params without data", async () => {
      mockClient.makeRequest.mockResolvedValue([["saved"]]);

      await crud.saveObject("ws1", "file.txt", "nk_file", { desc: "test" });

      expect(mockClient.makeRequest).toHaveBeenCalledWith("Workspace.save", [
        {
          objects: [
            { workspace: "ws1", id: "file.txt", type: "nk_file", meta: { desc: "test" }, data: undefined },
          ],
        },
      ]);
    });
  });

  describe("createFolder", () => {
    it("delegates to create with type folder", async () => {
      mockClient.makeRequest.mockResolvedValue([["created"]]);

      await crud.createFolder("ws1", "myFolder", { key: "val" });

      expect(mockClient.makeRequest).toHaveBeenCalledWith("Workspace.create", [
        { objects: [{ workspace: "ws1", id: "myFolder", type: "folder", meta: { key: "val" } }] },
      ]);
    });

    it("works without meta argument", async () => {
      mockClient.makeRequest.mockResolvedValue([["created"]]);

      await crud.createFolder("ws1", "myFolder");

      expect(mockClient.makeRequest).toHaveBeenCalledWith("Workspace.create", [
        { objects: [{ workspace: "ws1", id: "myFolder", type: "folder", meta: undefined }] },
      ]);
    });
  });

  describe("createFile", () => {
    it("delegates to create with type file", async () => {
      mockClient.makeRequest.mockResolvedValue([["created"]]);

      await crud.createFile("ws1", "data.csv", { format: "csv" });

      expect(mockClient.makeRequest).toHaveBeenCalledWith("Workspace.create", [
        { objects: [{ workspace: "ws1", id: "data.csv", type: "file", meta: { format: "csv" } }] },
      ]);
    });
  });
});
