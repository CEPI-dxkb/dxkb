import {
  getFavoritesFilePath,
  getPreferencesDirPath,
  loadFavorites,
  toggleFavorite,
} from "@/lib/services/workspace/favorites";
import { workspaceApi } from "@/lib/services/workspace/client";

vi.mock("@/lib/services/workspace/client", () => ({
  workspaceApi: { makeRequest: vi.fn() },
}));

const mockMakeRequest = workspaceApi.makeRequest as ReturnType<typeof vi.fn>;

describe("favorites", () => {
  describe("getFavoritesFilePath", () => {
    it("returns correct path for userId without leading slash", () => {
      expect(getFavoritesFilePath("user@bvbrc")).toBe(
        "/user@bvbrc/home/.preferences/favorites.json",
      );
    });

    it("returns correct path for userId with leading slash", () => {
      expect(getFavoritesFilePath("/user@bvbrc")).toBe(
        "/user@bvbrc/home/.preferences/favorites.json",
      );
    });
  });

  describe("getPreferencesDirPath", () => {
    it("returns correct path for userId without leading slash", () => {
      expect(getPreferencesDirPath("user@bvbrc")).toBe(
        "/user@bvbrc/home/.preferences",
      );
    });

    it("returns correct path for userId with leading slash", () => {
      expect(getPreferencesDirPath("/user@bvbrc")).toBe(
        "/user@bvbrc/home/.preferences",
      );
    });
  });

  describe("loadFavorites", () => {
    it("returns folders array from parsed JSON content", async () => {
      // Workspace.get result format: result[0][0] = [metadata, content]
      const content = JSON.stringify({
        folders: ["/user@bvbrc/home/folder1", "/user@bvbrc/home/folder2"],
      });
      mockMakeRequest.mockResolvedValue([
        [[["meta-data"], content]],
      ]);

      const result = await loadFavorites("user@bvbrc");

      expect(mockMakeRequest).toHaveBeenCalledWith(
        "Workspace.get",
        [{ objects: ["/user@bvbrc/home/.preferences/favorites.json"] }],
        { silent: true },
      );
      expect(result).toEqual([
        "/user@bvbrc/home/folder1",
        "/user@bvbrc/home/folder2",
      ]);
    });

    it("returns empty array for missing file (makeRequest throws)", async () => {
      mockMakeRequest.mockRejectedValue(new Error("Not found"));

      const result = await loadFavorites("user@bvbrc");

      expect(result).toEqual([]);
    });

    it("returns empty array when result has no content", async () => {
      mockMakeRequest.mockResolvedValue([]);

      const result = await loadFavorites("user@bvbrc");

      expect(result).toEqual([]);
    });

    it("returns empty array for empty userId", async () => {
      const result = await loadFavorites("");

      expect(result).toEqual([]);
      expect(mockMakeRequest).not.toHaveBeenCalled();
    });

    it("returns empty array when JSON has no folders key", async () => {
      const content = JSON.stringify({ other: "data" });
      mockMakeRequest.mockResolvedValue([
        [[["meta-data"], content]],
      ]);

      const result = await loadFavorites("user@bvbrc");

      expect(result).toEqual([]);
    });
  });

  describe("toggleFavorite", () => {
    it("adds folder when not present and returns true", async () => {
      // First call: loadFavorites -> Workspace.get (returns existing favorites)
      const existingContent = JSON.stringify({
        folders: ["/user@bvbrc/home/existing"],
      });
      mockMakeRequest
        // loadFavorites call
        .mockResolvedValueOnce([[[[null], existingContent]]])
        // ensurePreferencesDir -> Workspace.get (check dir exists)
        .mockResolvedValueOnce([[["dir-entry"]]])
        // Workspace.create (save new favorites)
        .mockResolvedValueOnce([]);

      const result = await toggleFavorite(
        "user@bvbrc",
        "/user@bvbrc/home/new-folder",
      );

      expect(result).toBe(true);

      // Verify the save call includes the new folder
      const saveCall = mockMakeRequest.mock.calls[2];
      expect(saveCall[0]).toBe("Workspace.create");
      const savedContent = JSON.parse(saveCall[1][0].objects[0][3]);
      expect(savedContent.folders).toContain("/user@bvbrc/home/existing");
      expect(savedContent.folders).toContain("/user@bvbrc/home/new-folder");
    });

    it("removes folder when present and returns false", async () => {
      const existingContent = JSON.stringify({
        folders: [
          "/user@bvbrc/home/folder1",
          "/user@bvbrc/home/folder2",
        ],
      });
      mockMakeRequest
        // loadFavorites
        .mockResolvedValueOnce([[[[null], existingContent]]])
        // ensurePreferencesDir
        .mockResolvedValueOnce([[["dir-entry"]]])
        // Workspace.create (save)
        .mockResolvedValueOnce([]);

      const result = await toggleFavorite(
        "user@bvbrc",
        "/user@bvbrc/home/folder1",
      );

      expect(result).toBe(false);

      // Verify the save call excludes the removed folder
      const saveCall = mockMakeRequest.mock.calls[2];
      const savedContent = JSON.parse(saveCall[1][0].objects[0][3]);
      expect(savedContent.folders).not.toContain("/user@bvbrc/home/folder1");
      expect(savedContent.folders).toContain("/user@bvbrc/home/folder2");
    });

    it("throws when userId is empty", async () => {
      await expect(
        toggleFavorite("", "/user@bvbrc/home/folder"),
      ).rejects.toThrow("User and folder path are required.");
    });

    it("throws when folderPath is empty", async () => {
      await expect(toggleFavorite("user@bvbrc", "")).rejects.toThrow(
        "User and folder path are required.",
      );
    });
  });
});
