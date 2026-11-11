import {
  parseDuResult,
  parseListPermissions,
  parseLsResult,
  parseLsResultLoose,
  parseTupleToRawObject,
  parseUploadNode,
} from "@/lib/services/workspace/adapters/parsers";

describe("workspace adapters/parsers", () => {
  describe("parseTupleToRawObject", () => {
    it("maps array indices to untyped record correctly", () => {
      const list = [
        "myfile.fasta",
        "contigs",
        "/user/home/",
        "2024-01-15",
        "abc123",
        "owner@test.com",
        1024,
        { key: "val" },
        {},
        "o",
        "r",
        null,
      ];
      const obj = parseTupleToRawObject(list);
      expect(obj.id).toBe("abc123");
      expect(obj.name).toBe("myfile.fasta");
      expect(obj.type).toBe("contigs");
      expect(obj.creation_time).toBe("2024-01-15");
      expect(obj.owner_id).toBe("owner@test.com");
      expect(obj.size).toBe(1024);
      expect(obj.user_permission).toBe("o");
      expect(obj.global_permission).toBe("r");
      expect(obj.link_reference).toBeNull();
    });

    it("builds path from parent + name", () => {
      const list = ["file.txt", "txt", "/user/home/", "", "", "", 0, {}, {}, "", "", null];
      const obj = parseTupleToRawObject(list);
      expect(obj.path).toBe("/user/home/file.txt");
    });

    it("coerces null size to 0", () => {
      const list = ["file.txt", "txt", "/user/home/", "", "", "", null, {}, {}, "", "", null];
      const obj = parseTupleToRawObject(list);
      expect(obj.size).toBe(0);
    });
  });

  describe("parseLsResult", () => {
    const lsTuple = [
      "file.fa",
      "contigs",
      "/user@bvbrc/home/",
      "2026-04-01",
      "id-1",
      "user@bvbrc",
      123,
      {},
      {},
      "o",
      "n",
      "",
    ];

    it("maps tuples to WorkspaceItem for the requested path", () => {
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
          ownerId: "user@bvbrc",
          permissions: { user: "o", global: "n" },
        }),
      );
    });

    it("populates the raw field with the legacy transport object", () => {
      const raw = [{ "/user@bvbrc/home": [lsTuple] }];
      const items = parseLsResult(raw, "/user@bvbrc/home");
      expect(items[0]?.raw).toEqual(
        expect.objectContaining({ id: "id-1", name: "file.fa" }),
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
