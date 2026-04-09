import {
  listSharedWithUser,
  listUserWorkspaces,
  listByFullPath,
  listPermissions,
  getWorkspaceMetadata,
} from "@/lib/services/workspace/shared";
import { workspaceApi } from "@/lib/services/workspace/client";

vi.mock("@/lib/services/workspace/client", () => ({
  workspaceApi: { makeRequest: vi.fn() },
}));

vi.mock("@/types/workspace-browser", () => ({}));

const mockMakeRequest = workspaceApi.makeRequest as ReturnType<typeof vi.fn>;

describe("shared workspace functions", () => {
  describe("listSharedWithUser", () => {
    it("filters to items where global_permission is 'n' and user_permission is not 'o'", async () => {
      const items = [
        { name: "shared-rw", global_permission: "n", user_permission: "w" },
        { name: "shared-read", global_permission: "n", user_permission: "r" },
        { name: "owned", global_permission: "n", user_permission: "o" },
        { name: "public", global_permission: "r", user_permission: "r" },
      ];
      mockMakeRequest.mockResolvedValue(items);

      const result = await listSharedWithUser();

      expect(mockMakeRequest).toHaveBeenCalledWith("Workspace.ls", [
        { paths: ["/"], includeSubDirs: false, recursive: false },
      ]);
      expect(result).toEqual([
        { name: "shared-rw", global_permission: "n", user_permission: "w" },
        { name: "shared-read", global_permission: "n", user_permission: "r" },
      ]);
    });

    it("excludes items where global_permission is not 'n'", async () => {
      const items = [
        { name: "public-item", global_permission: "r", user_permission: "r" },
        { name: "another-public", global_permission: "w", user_permission: "w" },
      ];
      mockMakeRequest.mockResolvedValue(items);

      const result = await listSharedWithUser();

      expect(result).toEqual([]);
    });

    it("returns empty array when no items match", async () => {
      mockMakeRequest.mockResolvedValue([]);

      const result = await listSharedWithUser();

      expect(result).toEqual([]);
    });

    it("handles items with missing permission fields", async () => {
      const items = [
        { name: "no-perms" },
        { name: "only-global", global_permission: "n" },
      ];
      mockMakeRequest.mockResolvedValue(items);

      const result = await listSharedWithUser();

      // global_permission missing => String(undefined) !== "n" => filtered out
      // user_permission missing => String(undefined) !== "o" => passes if global is "n"
      expect(result).toEqual([
        { name: "only-global", global_permission: "n" },
      ]);
    });
  });

  describe("listUserWorkspaces", () => {
    it("returns empty array for empty username", async () => {
      const result = await listUserWorkspaces("");

      expect(result).toEqual([]);
      expect(mockMakeRequest).not.toHaveBeenCalled();
    });

    it("constructs correct path with @bvbrc suffix", async () => {
      const items = [{ name: "home" }];
      mockMakeRequest.mockResolvedValue(items);

      const result = await listUserWorkspaces("alice");

      expect(mockMakeRequest).toHaveBeenCalledWith("Workspace.ls", [
        { paths: ["/alice@bvbrc"], includeSubDirs: false, recursive: false },
      ]);
      expect(result).toEqual(items);
    });

    it("decodes URI-encoded username", async () => {
      mockMakeRequest.mockResolvedValue([]);

      await listUserWorkspaces("user%40domain");

      expect(mockMakeRequest).toHaveBeenCalledWith("Workspace.ls", [
        {
          paths: ["/user@domain@bvbrc"],
          includeSubDirs: false,
          recursive: false,
        },
      ]);
    });
  });

  describe("listByFullPath", () => {
    it("decodes URI components in path", async () => {
      mockMakeRequest.mockResolvedValue([]);

      await listByFullPath("/owner%40bvbrc/folder");

      expect(mockMakeRequest).toHaveBeenCalledWith("Workspace.ls", [
        {
          paths: ["/owner@bvbrc/folder"],
          includeSubDirs: false,
          recursive: false,
        },
      ]);
    });

    it("adds leading slash when missing", async () => {
      mockMakeRequest.mockResolvedValue([]);

      await listByFullPath("owner@bvbrc/folder");

      expect(mockMakeRequest).toHaveBeenCalledWith("Workspace.ls", [
        {
          paths: ["/owner@bvbrc/folder"],
          includeSubDirs: false,
          recursive: false,
        },
      ]);
    });

    it("does not double leading slash when already present", async () => {
      mockMakeRequest.mockResolvedValue([]);

      await listByFullPath("/owner@bvbrc/folder");

      expect(mockMakeRequest).toHaveBeenCalledWith("Workspace.ls", [
        {
          paths: ["/owner@bvbrc/folder"],
          includeSubDirs: false,
          recursive: false,
        },
      ]);
    });

    it("returns result from makeRequest", async () => {
      const items = [{ name: "file.txt" }];
      mockMakeRequest.mockResolvedValue(items);

      const result = await listByFullPath("/owner@bvbrc/folder");

      expect(result).toEqual(items);
    });
  });

  describe("listPermissions", () => {
    it("returns empty object for empty array of paths", async () => {
      const result = await listPermissions([]);

      expect(result).toEqual({});
      expect(mockMakeRequest).not.toHaveBeenCalled();
    });

    it("sends decoded paths as objects param", async () => {
      const permissionsResult = {
        "/owner@bvbrc/folder": [["user1", "r"]],
      };
      mockMakeRequest.mockResolvedValue(permissionsResult);

      const result = await listPermissions(["/owner%40bvbrc/folder"]);

      expect(mockMakeRequest).toHaveBeenCalledWith(
        "Workspace.list_permissions",
        [{ objects: ["/owner@bvbrc/folder"] }],
      );
      expect(result).toEqual(permissionsResult);
    });

    it("decodes multiple paths", async () => {
      mockMakeRequest.mockResolvedValue({});

      await listPermissions([
        "/user%40bvbrc/folder1",
        "/user%40bvbrc/folder2",
      ]);

      expect(mockMakeRequest).toHaveBeenCalledWith(
        "Workspace.list_permissions",
        [{ objects: ["/user@bvbrc/folder1", "/user@bvbrc/folder2"] }],
      );
    });
  });

  describe("getWorkspaceMetadata", () => {
    it("returns empty array for empty array of paths", async () => {
      const result = await getWorkspaceMetadata([]);

      expect(result).toEqual([]);
      expect(mockMakeRequest).not.toHaveBeenCalled();
    });

    it("sends metadata_only: true with decoded paths", async () => {
      const metadata = [["some-metadata"]];
      mockMakeRequest.mockResolvedValue(metadata);

      const result = await getWorkspaceMetadata(["/owner%40bvbrc/file.txt"]);

      expect(mockMakeRequest).toHaveBeenCalledWith("Workspace.get", [
        { objects: ["/owner@bvbrc/file.txt"], metadata_only: true },
      ], undefined);
      expect(result).toEqual(metadata);
    });

    it("decodes multiple paths and includes metadata_only", async () => {
      mockMakeRequest.mockResolvedValue([]);

      await getWorkspaceMetadata([
        "/user%40bvbrc/file1",
        "/user%40bvbrc/file2",
      ]);

      expect(mockMakeRequest).toHaveBeenCalledWith("Workspace.get", [
        {
          objects: ["/user@bvbrc/file1", "/user@bvbrc/file2"],
          metadata_only: true,
        },
      ], undefined);
    });
  });
});
