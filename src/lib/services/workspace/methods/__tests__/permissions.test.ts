import { WorkspacePermissionsMethods } from "@/lib/services/workspace/methods/permissions";

const mockClient = { makeRequest: vi.fn() };
const permissions = new WorkspacePermissionsMethods(mockClient as never);

describe("WorkspacePermissionsMethods", () => {
  describe("getPermissions", () => {
    it("delegates to Workspace.get_permissions with given params", async () => {
      const params = { objects: [{ workspace: "ws1", id: "folder" }] };
      const response = [[["user1", "r"], ["user2", "w"]]];
      mockClient.makeRequest.mockResolvedValue(response);

      const result = await permissions.getPermissions(params);

      expect(mockClient.makeRequest).toHaveBeenCalledWith(
        "Workspace.get_permissions",
        [params],
      );
      expect(result).toEqual(response);
    });
  });

  describe("getObjectPermissions", () => {
    it("wraps single workspace/id into objects array", async () => {
      const response = [[["user1", "o"]]];
      mockClient.makeRequest.mockResolvedValue(response);

      const result = await permissions.getObjectPermissions("ws1", "file.txt");

      expect(mockClient.makeRequest).toHaveBeenCalledWith(
        "Workspace.get_permissions",
        [{ objects: [{ workspace: "ws1", id: "file.txt" }] }],
      );
      expect(result).toEqual(response);
    });
  });

  describe("getMultipleObjectPermissions", () => {
    it("passes multiple objects directly", async () => {
      const objects = [
        { workspace: "ws1", id: "file1.txt" },
        { workspace: "ws1", id: "file2.txt" },
      ];
      const response = [
        [["user1", "r"]],
        [["user1", "w"]],
      ];
      mockClient.makeRequest.mockResolvedValue(response);

      const result = await permissions.getMultipleObjectPermissions(objects);

      expect(mockClient.makeRequest).toHaveBeenCalledWith(
        "Workspace.get_permissions",
        [{ objects }],
      );
      expect(result).toEqual(response);
    });
  });
});
