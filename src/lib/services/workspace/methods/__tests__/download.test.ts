import { WorkspaceDownloadMethods } from "@/lib/services/workspace/methods/download";

const mockClient = { makeRequest: vi.fn() };
const download = new WorkspaceDownloadMethods(mockClient as never);

describe("WorkspaceDownloadMethods", () => {
  describe("getDownloadUrls", () => {
    it("returns empty array for empty paths", async () => {
      const result = await download.getDownloadUrls([]);

      expect(result).toEqual([]);
      expect(mockClient.makeRequest).not.toHaveBeenCalled();
    });

    it("calls Workspace.get_download_url with correct params", async () => {
      const urls = [["https://download.example.com/file1"]];
      mockClient.makeRequest.mockResolvedValue(urls);

      const result = await download.getDownloadUrls(["/user@bvbrc/home/file.txt"]);

      expect(mockClient.makeRequest).toHaveBeenCalledWith(
        "Workspace.get_download_url",
        [{ objects: ["/user@bvbrc/home/file.txt"] }],
      );
      expect(result).toEqual(urls);
    });

    it("handles multiple paths", async () => {
      const urls = [
        ["https://download.example.com/file1"],
        ["https://download.example.com/file2"],
      ];
      mockClient.makeRequest.mockResolvedValue(urls);

      const paths = ["/user@bvbrc/home/file1.txt", "/user@bvbrc/home/file2.txt"];
      const result = await download.getDownloadUrls(paths);

      expect(mockClient.makeRequest).toHaveBeenCalledWith(
        "Workspace.get_download_url",
        [{ objects: paths }],
      );
      expect(result).toEqual(urls);
    });
  });

  describe("getArchiveUrl", () => {
    it("calls Workspace.get_archive_url with correct params", async () => {
      const archiveResult: [string, number, number] = [
        "https://archive.example.com/download",
        5,
        1024000,
      ];
      mockClient.makeRequest.mockResolvedValue(archiveResult);

      const params = {
        objects: ["/user@bvbrc/home/folder"],
        recursive: true,
        archive_name: "my-archive",
        archive_type: "zip",
      };
      const result = await download.getArchiveUrl(params);

      expect(mockClient.makeRequest).toHaveBeenCalledWith(
        "Workspace.get_archive_url",
        [params],
      );
      expect(result).toEqual(archiveResult);
    });
  });
});
