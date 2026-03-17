import { http, HttpResponse } from "msw";

import {
  fetchGenomeSuggestions,
  fetchGenomesByIds,
  fetchAllGenomeIds,
  getGenomeIdsFromGroup,
  validateViralGenomes,
  fetchGenomeGroupMembers,
} from "@/lib/services/genome";
import { server } from "@/test-helpers/msw-server";

describe("genome service", () => {
  describe("fetchGenomeSuggestions", () => {
    it("returns results on successful fetch", async () => {
      const mockResults = [
        { genome_id: "g1", genome_name: "Genome 1" },
        { genome_id: "g2", genome_name: "Genome 2" },
      ];
      let capturedUrl = "";
      server.use(
        http.get("/api/services/genome/search", ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json({ results: mockResults });
        }),
      );

      const result = await fetchGenomeSuggestions("test query");

      expect(result).toEqual(mockResults);
      const params = new URL(capturedUrl).searchParams;
      expect(params.get("q")).toBe("test query");
      expect(params.get("limit")).toBe("25");
    });

    it("throws on HTTP error", async () => {
      server.use(
        http.get("/api/services/genome/search", () =>
          HttpResponse.json({ error: "Server error" }, { status: 500 }),
        ),
      );

      await expect(fetchGenomeSuggestions("fail")).rejects.toThrow("Server error");
    });

    it("returns empty array on AbortError", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
        new DOMException("The operation was aborted.", "AbortError"),
      );

      const result = await fetchGenomeSuggestions("aborted");

      expect(result).toEqual([]);

    });
  });

  describe("fetchGenomesByIds", () => {
    it("returns empty array when given empty ids", async () => {
      let handlerCalled = false;
      server.use(
        http.post("/api/services/genome/by-ids", () => {
          handlerCalled = true;
          return HttpResponse.json({ results: [] });
        }),
      );

      const result = await fetchGenomesByIds([]);

      expect(result).toEqual([]);
      expect(handlerCalled).toBe(false);
    });

    it("deduplicates ids before sending", async () => {
      let capturedBody: { genome_ids?: string[] } = {};
      const mockResults = [{ genome_id: "g1", genome_name: "Genome 1" }];
      server.use(
        http.post("/api/services/genome/by-ids", async ({ request }) => {
          capturedBody = (await request.json()) as typeof capturedBody;
          return HttpResponse.json({ results: mockResults });
        }),
      );

      await fetchGenomesByIds(["g1", "g1", "g2", "g2"]);

      expect(capturedBody.genome_ids).toEqual(["g1", "g2"]);
    });

    it("returns results on success", async () => {
      const mockResults = [
        { genome_id: "g1", genome_name: "Genome 1" },
        { genome_id: "g2", genome_name: "Genome 2" },
      ];
      server.use(
        http.post("/api/services/genome/by-ids", () => {
          return HttpResponse.json({ results: mockResults });
        }),
      );

      const result = await fetchGenomesByIds(["g1", "g2"]);

      expect(result).toEqual(mockResults);
    });

    it("throws on HTTP error", async () => {
      server.use(
        http.post("/api/services/genome/by-ids", () =>
          HttpResponse.json({ error: "Not found" }, { status: 404 }),
        ),
      );

      await expect(fetchGenomesByIds(["g1"])).rejects.toThrow("Not found");
    });
  });

  describe("fetchAllGenomeIds", () => {
    it("returns results on success", async () => {
      const mockResults = [
        { genome_id: "g1", genome_name: "Genome 1" },
        { genome_id: "g2", genome_name: "Genome 2" },
      ];
      server.use(
        http.post("/api/services/genome/get-all-ids", () => {
          return HttpResponse.json({ results: mockResults });
        }),
      );

      const result = await fetchAllGenomeIds();

      expect(result).toEqual(mockResults);
    });

    it("throws on HTTP error", async () => {
      server.use(
        http.post("/api/services/genome/get-all-ids", () =>
          HttpResponse.json({ error: "Service unavailable" }, { status: 503 }),
        ),
      );

      await expect(fetchAllGenomeIds()).rejects.toThrow("Service unavailable");
    });
  });

  describe("getGenomeIdsFromGroup", () => {
    it("returns empty array for empty path", async () => {
      let handlerCalled = false;
      server.use(
        http.post("/api/services/workspace", () => {
          handlerCalled = true;
          return HttpResponse.json({});
        }),
      );

      const result = await getGenomeIdsFromGroup("");

      expect(result).toEqual([]);
      expect(handlerCalled).toBe(false);
    });

    it("decodes JSON string data and returns genome ids", async () => {
      const groupData = JSON.stringify({
        id_list: { genome_id: ["g1", "g2", "g3"] },
      });
      let capturedBody: { method?: string; params?: [{ objects?: string[] }] } = {};
      server.use(
        http.post("/api/services/workspace", async ({ request }) => {
          capturedBody = (await request.json()) as typeof capturedBody;
          return HttpResponse.json({
            result: [
              [
                ["metadata-placeholder", groupData],
              ],
            ],
          });
        }),
      );

      const result = await getGenomeIdsFromGroup("/user/mygroup");

      expect(result).toEqual(["g1", "g2", "g3"]);
      expect(capturedBody.method).toBe("Workspace.get");
      expect(capturedBody.params?.[0].objects).toEqual(["/user/mygroup"]);
    });

    it("returns genome ids from base64 encoded data", async () => {
      const groupJson = JSON.stringify({
        id_list: { genome_id: ["b64-g1", "b64-g2"] },
      });
      const base64Data = Buffer.from(groupJson).toString("base64");
      server.use(
        http.post("/api/services/workspace", () =>
          HttpResponse.json({
            result: [
              [
                ["metadata-placeholder", base64Data],
              ],
            ],
          }),
        ),
      );

      const result = await getGenomeIdsFromGroup("/user/encoded-group");

      expect(result).toEqual(["b64-g1", "b64-g2"]);
    });

    it("passes object data through as-is", async () => {
      server.use(
        http.post("/api/services/workspace", () =>
          HttpResponse.json({
            result: [
              [
                ["metadata", { id_list: { genome_id: ["obj-g1"] } }],
              ],
            ],
          }),
        ),
      );

      const result = await getGenomeIdsFromGroup("/user/obj-group");

      expect(result).toEqual(["obj-g1"]);
    });

    it("returns empty array when decoded data has no id_list", async () => {
      const groupData = JSON.stringify({ some_other_field: "value" });
      server.use(
        http.post("/api/services/workspace", () =>
          HttpResponse.json({
            result: [
              [
                ["metadata", groupData],
              ],
            ],
          }),
        ),
      );

      const result = await getGenomeIdsFromGroup("/user/empty-group");

      expect(result).toEqual([]);
    });

    it("returns empty array when id_list has no genome_id", async () => {
      const groupData = JSON.stringify({ id_list: { feature_id: ["f1"] } });
      server.use(
        http.post("/api/services/workspace", () =>
          HttpResponse.json({
            result: [
              [
                ["metadata", groupData],
              ],
            ],
          }),
        ),
      );

      const result = await getGenomeIdsFromGroup("/user/no-genomes");

      expect(result).toEqual([]);
    });

    it("filters non-string entries from genome_id array", async () => {
      const groupData = JSON.stringify({
        id_list: { genome_id: ["g1", 123, null, "g2", undefined] },
      });
      server.use(
        http.post("/api/services/workspace", () =>
          HttpResponse.json({
            result: [
              [
                ["metadata", groupData],
              ],
            ],
          }),
        ),
      );

      const result = await getGenomeIdsFromGroup("/user/mixed-group");

      expect(result).toEqual(["g1", "g2"]);
    });

    it("throws on HTTP error", async () => {
      server.use(
        http.post("/api/services/workspace", () =>
          HttpResponse.json({ error: "Server error" }, { status: 500 }),
        ),
      );

      await expect(getGenomeIdsFromGroup("/user/fail")).rejects.toThrow("Server error");
    });

    it("throws when workspace response entry is null", async () => {
      server.use(
        http.post("/api/services/workspace", () =>
          HttpResponse.json({ result: [null] }),
        ),
      );

      await expect(getGenomeIdsFromGroup("/user/bad-response")).rejects.toThrow(
        "Invalid workspace response for genome group",
      );
    });

    it("returns empty array on AbortError", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
        new DOMException("The operation was aborted.", "AbortError"),
      );

      const result = await getGenomeIdsFromGroup("/user/aborted");

      expect(result).toEqual([]);

    });

    it("handles container-as-object with metadata/data format", async () => {
      server.use(
        http.post("/api/services/workspace", () =>
          HttpResponse.json({
            result: [
              [
                { metadata: "meta-info", data: JSON.stringify({ id_list: { genome_id: ["md-g1"] } }) },
              ],
            ],
          }),
        ),
      );

      const result = await getGenomeIdsFromGroup("/user/md-format");

      expect(result).toEqual(["md-g1"]);
    });

    it("handles first-value-in-object format", async () => {
      server.use(
        http.post("/api/services/workspace", () =>
          HttpResponse.json({
            result: [
              {
                "/user/group": [
                  ["metadata", JSON.stringify({ id_list: { genome_id: ["fv-g1"] } })],
                ],
              },
            ],
          }),
        ),
      );

      const result = await getGenomeIdsFromGroup("/user/fv-format");

      expect(result).toEqual(["fv-g1"]);
    });
  });

  describe("fetchGenomeGroupMembers", () => {
    it("returns empty array for empty path", async () => {
      let handlerCalled = false;
      server.use(
        http.post("/api/services/workspace", () => {
          handlerCalled = true;
          return HttpResponse.json({});
        }),
      );

      const result = await fetchGenomeGroupMembers("");

      expect(result).toEqual([]);
      expect(handlerCalled).toBe(false);
    });

    it("fetches workspace data then genome metadata", async () => {
      const groupData = JSON.stringify({
        id_list: { genome_id: ["g1", "g2"] },
      });
      let fetchCount = 0;
      server.use(
        http.post("/api/services/workspace", () => {
          fetchCount++;
          return HttpResponse.json({
            result: [[["metadata", groupData]]],
          });
        }),
        http.post("/api/services/genome/by-ids", () => {
          fetchCount++;
          return HttpResponse.json({
            results: [
              { genome_id: "g1", genome_name: "Genome 1" },
              { genome_id: "g2", genome_name: "Genome 2" },
            ],
          });
        }),
      );

      const result = await fetchGenomeGroupMembers("/user/group");

      expect(result).toEqual([
        { genome_id: "g1", genome_name: "Genome 1" },
        { genome_id: "g2", genome_name: "Genome 2" },
      ]);
      expect(fetchCount).toBe(2);
    });

    it("decodes base64 encoded workspace data", async () => {
      const groupJson = JSON.stringify({
        id_list: { genome_id: ["b64-g1"] },
      });
      const base64Data = Buffer.from(groupJson).toString("base64");
      server.use(
        http.post("/api/services/workspace", () =>
          HttpResponse.json({
            result: [[["metadata", base64Data]]],
          }),
        ),
        http.post("/api/services/genome/by-ids", () =>
          HttpResponse.json({
            results: [{ genome_id: "b64-g1", genome_name: "B64 Genome" }],
          }),
        ),
      );

      const result = await fetchGenomeGroupMembers("/user/b64-group");

      expect(result).toEqual([{ genome_id: "b64-g1", genome_name: "B64 Genome" }]);
    });

    it("throws when workspace response entry is null", async () => {
      server.use(
        http.post("/api/services/workspace", () =>
          HttpResponse.json({ result: [null] }),
        ),
      );

      await expect(fetchGenomeGroupMembers("/user/bad")).rejects.toThrow(
        "Invalid workspace response for genome group",
      );
    });

    it("returns empty array on AbortError", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
        new DOMException("The operation was aborted.", "AbortError"),
      );

      const result = await fetchGenomeGroupMembers("/user/aborted");

      expect(result).toEqual([]);

    });
  });

  describe("validateViralGenomes", () => {
    it("returns allValid true for empty ids", async () => {
      let handlerCalled = false;
      server.use(
        http.post("/api/services/genome/validate-viral", () => {
          handlerCalled = true;
          return HttpResponse.json({});
        }),
      );

      const result = await validateViralGenomes([]);

      expect(result).toEqual({ allValid: true, errors: {}, results: [] });
      expect(handlerCalled).toBe(false);
    });

    it("detects kingdom_error for non-Viruses superkingdom", async () => {
      const mockResults = [
        { genome_id: "g1", superkingdom: "Bacteria", contigs: 1, genome_length: 1000 },
      ];
      server.use(
        http.post("/api/services/genome/validate-viral", () =>
          HttpResponse.json({ results: mockResults }),
        ),
      );

      const result = await validateViralGenomes(["g1"]);

      expect(result.allValid).toBe(false);
      expect(result.errors.kingdom_error).toContain("Invalid Superkingdom");
      expect(result.errors.kingdom_error).toContain("g1");
    });

    it("detects contigs_error for multi-contig genomes", async () => {
      const mockResults = [
        { genome_id: "g1", superkingdom: "Viruses", contigs: 5, genome_length: 1000 },
      ];
      server.use(
        http.post("/api/services/genome/validate-viral", () =>
          HttpResponse.json({ results: mockResults }),
        ),
      );

      const result = await validateViralGenomes(["g1"]);

      expect(result.allValid).toBe(false);
      expect(result.errors.contigs_error).toContain("only 1 contig is permitted");
      expect(result.errors.contigs_error).toContain("g1");
    });

    it("detects genomelength_error for genomes exceeding max length", async () => {
      const mockResults = [
        { genome_id: "g1", superkingdom: "Viruses", contigs: 1, genome_length: 500000 },
      ];
      server.use(
        http.post("/api/services/genome/validate-viral", () =>
          HttpResponse.json({ results: mockResults }),
        ),
      );

      const result = await validateViralGenomes(["g1"]);

      expect(result.allValid).toBe(false);
      expect(result.errors.genomelength_error).toContain("exceeds maximum length");
      expect(result.errors.genomelength_error).toContain("g1");
    });

    it("detects missing_superkingdom when superkingdom is absent", async () => {
      const mockResults = [
        { genome_id: "g1", contigs: 1, genome_length: 1000 },
      ];
      server.use(
        http.post("/api/services/genome/validate-viral", () =>
          HttpResponse.json({ results: mockResults }),
        ),
      );

      const result = await validateViralGenomes(["g1"]);

      expect(result.allValid).toBe(false);
      expect(result.errors.missing_superkingdom).toContain("Missing superkingdom");
      expect(result.errors.missing_superkingdom).toContain("g1");
    });
  });
});
