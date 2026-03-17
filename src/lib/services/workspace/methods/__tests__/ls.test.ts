import { WorkspaceLsMethods } from "@/lib/services/workspace/methods/ls";

const mockClient = { makeRequest: vi.fn() };
const ls = new WorkspaceLsMethods(mockClient as never);

describe("WorkspaceLsMethods", () => {
  describe("listObjects", () => {
    it("delegates to Workspace.ls with given params", async () => {
      const params = {
        paths: ["/user@bvbrc/home/"],
        excludeDirectories: false,
        excludeObjects: false,
        recursive: true,
      };
      const objects = [{ name: "file.txt", type: "file" }];
      mockClient.makeRequest.mockResolvedValue(objects);

      const result = await ls.listObjects(params);

      expect(mockClient.makeRequest).toHaveBeenCalledWith("Workspace.ls", [params]);
      expect(result).toEqual(objects);
    });
  });

  describe("getObjectsByType", () => {
    it("builds path with @bvbrc format", async () => {
      mockClient.makeRequest.mockResolvedValue([
        { name: "file.txt", type: "file" },
      ]);

      await ls.getObjectsByType("alice", "file");

      expect(mockClient.makeRequest).toHaveBeenCalledWith(
        "Workspace.ls",
        [
          expect.objectContaining({
            paths: ["/alice@bvbrc/home/"],
          }),
        ],
      );
    });

    it("filters results by the requested type", async () => {
      mockClient.makeRequest.mockResolvedValue([
        { name: "file.txt", type: "file" },
        { name: "folder1", type: "folder" },
        { name: "other.txt", type: "file" },
      ]);

      const result = await ls.getObjectsByType("alice", "file");

      expect(result).toEqual([
        { name: "file.txt", type: "file" },
        { name: "other.txt", type: "file" },
      ]);
    });

    it("uses custom path when provided", async () => {
      mockClient.makeRequest.mockResolvedValue([]);

      await ls.getObjectsByType("alice", "file", "/projects/");

      expect(mockClient.makeRequest).toHaveBeenCalledWith(
        "Workspace.ls",
        [
          expect.objectContaining({
            paths: ["/alice@bvbrc/projects/"],
          }),
        ],
      );
    });

    it("sends query with type array", async () => {
      mockClient.makeRequest.mockResolvedValue([]);

      await ls.getObjectsByType("alice", "folder");

      expect(mockClient.makeRequest).toHaveBeenCalledWith(
        "Workspace.ls",
        [
          expect.objectContaining({
            query: { type: ["folder"] },
          }),
        ],
      );
    });
  });

  describe("searchObjects", () => {
    it("includes name in query and filters by types when provided", async () => {
      mockClient.makeRequest.mockResolvedValue([
        { name: "match.fasta", type: "contigs" },
        { name: "nomatch.txt", type: "file" },
      ]);

      const result = await ls.searchObjects("alice", "match", "/home/", ["contigs"]);

      expect(mockClient.makeRequest).toHaveBeenCalledWith(
        "Workspace.ls",
        [
          expect.objectContaining({
            paths: ["/alice@bvbrc/home/"],
            query: { name: "match", type: ["contigs"] },
            recursive: true,
          }),
        ],
      );
      expect(result).toEqual([{ name: "match.fasta", type: "contigs" }]);
    });

    it("returns all results when no types specified", async () => {
      const objects = [
        { name: "file1.txt", type: "file" },
        { name: "folder1", type: "folder" },
      ];
      mockClient.makeRequest.mockResolvedValue(objects);

      const result = await ls.searchObjects("alice", "file");

      expect(result).toEqual(objects);
    });
  });

  describe("getFiles", () => {
    it("delegates to getObjectsByType with type file", async () => {
      const files = [{ name: "doc.txt", type: "file" }];
      mockClient.makeRequest.mockResolvedValue(files);

      const result = await ls.getFiles("alice");

      expect(mockClient.makeRequest).toHaveBeenCalledWith(
        "Workspace.ls",
        [
          expect.objectContaining({
            query: { type: ["file"] },
          }),
        ],
      );
      expect(result).toEqual(files);
    });
  });

  describe("getFolders", () => {
    it("delegates to getObjectsByType with type folder", async () => {
      const folders = [{ name: "projects", type: "folder" }];
      mockClient.makeRequest.mockResolvedValue(folders);

      const result = await ls.getFolders("alice");

      expect(mockClient.makeRequest).toHaveBeenCalledWith(
        "Workspace.ls",
        [
          expect.objectContaining({
            query: { type: ["folder"] },
          }),
        ],
      );
      expect(result).toEqual(folders);
    });
  });

  describe("getJobs", () => {
    it("delegates to getObjectsByType with type job", async () => {
      const jobs = [{ name: "analysis-1", type: "job" }];
      mockClient.makeRequest.mockResolvedValue(jobs);

      const result = await ls.getJobs("alice");

      expect(mockClient.makeRequest).toHaveBeenCalledWith(
        "Workspace.ls",
        [
          expect.objectContaining({
            query: { type: ["job"] },
          }),
        ],
      );
      expect(result).toEqual(jobs);
    });
  });
});
