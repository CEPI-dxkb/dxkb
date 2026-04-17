import {
  lsToWorkspaceItems,
  parseDuResult,
  parseListPermissions,
  parseLsResult,
  parseLsResultLoose,
  parseUploadNode,
} from "@/lib/services/workspace/adapters/parsers";

describe("workspace adapters/parsers", () => {
  describe("parseLsResult", () => {
    const lsTuple = [
      "file.fa", // 0 name
      "contigs", // 1 type
      "/user@bvbrc/home/", // 2 parent path
      "2026-04-01", // 3 creation time
      "id-1", // 4 id
      "user@bvbrc", // 5 owner
      123, // 6 size
      {}, // 7 userMeta
      {}, // 8 autoMeta
      "o", // 9 user_permission
      "n", // 10 global_permission
      "", // 11 link_reference
    ];

    it("maps tuples to WorkspaceBrowserItem for the requested path", () => {
      const raw = [{ "/user@bvbrc/home": [lsTuple] }];
      const items = parseLsResult(raw, "/user@bvbrc/home");
      expect(items).toHaveLength(1);
      expect(items[0]).toEqual(
        expect.objectContaining({
          id: "id-1",
          name: "file.fa",
          type: "contigs",
          path: "/user@bvbrc/home/file.fa",
          size: 123,
        }),
      );
    });

    it("returns empty when path is missing", () => {
      expect(parseLsResult([{ "/other": [] }], "/user")).toEqual([]);
    });

    it("returns empty for malformed payloads", () => {
      expect(parseLsResult(null, "/user")).toEqual([]);
      expect(parseLsResult([], "/user")).toEqual([]);
      expect(parseLsResult([{}], "/user")).toEqual([]);
    });

    it("parseLsResultLoose falls back to first key", () => {
      const raw = [{ "/some/path": [lsTuple] }];
      expect(parseLsResultLoose(raw)).toHaveLength(1);
      expect(parseLsResultLoose([{}])).toEqual([]);
    });
  });

  describe("lsToWorkspaceItems", () => {
    it("converts to canonical items and keeps raw reference", () => {
      const browserItem = {
        id: "id-1",
        name: "file.fa",
        path: "/user@bvbrc/home/file.fa",
        type: "contigs",
        creation_time: "2026-04-01",
        link_reference: "",
        owner_id: "user@bvbrc",
        size: 123,
        userMeta: {},
        autoMeta: {},
        user_permission: "o",
        global_permission: "n",
        timestamp: 1712000000000,
      };
      const items = lsToWorkspaceItems([browserItem]);
      expect(items[0]).toEqual(
        expect.objectContaining({
          id: "id-1",
          path: "/user@bvbrc/home/file.fa",
          type: "contigs",
          ownerId: "user@bvbrc",
        }),
      );
      expect(items[0]?.raw).toBe(browserItem);
    });
  });

  describe("parseListPermissions", () => {
    it("unwraps the first element", () => {
      expect(
        parseListPermissions([{ "/a": [["bob", "r"]] }]),
      ).toEqual({ "/a": [["bob", "r"]] });
    });

    it("returns {} for missing payloads", () => {
      expect(parseListPermissions([])).toEqual({});
      expect(parseListPermissions(null)).toEqual({});
    });
  });

  describe("parseUploadNode", () => {
    it("extracts link_reference at tuple[11]", () => {
      const raw = [
        [
          [
            "name",
            "type",
            "/p/",
            "t",
            "id",
            "owner",
            0,
            {},
            {},
            "o",
            "n",
            "https://shock.example/node/xyz",
          ],
        ],
      ];
      expect(parseUploadNode(raw)).toBe("https://shock.example/node/xyz");
    });

    it("returns null when link_reference is absent", () => {
      expect(parseUploadNode([[[]]])).toBeNull();
      expect(parseUploadNode(null)).toBeNull();
    });
  });

  describe("parseDuResult", () => {
    it("unwraps [[path, size, fileCount, dirCount, error]]", () => {
      expect(
        parseDuResult([
          [
            ["/a", 100, 2, 0, ""],
            ["/b", 50, 1, 0, "denied"],
          ],
        ]),
      ).toEqual([
        ["/a", 100, 2, 0, ""],
        ["/b", 50, 1, 0, "denied"],
      ]);
    });

    it("returns [] for missing payloads", () => {
      expect(parseDuResult([])).toEqual([]);
      expect(parseDuResult(null)).toEqual([]);
    });
  });
});
