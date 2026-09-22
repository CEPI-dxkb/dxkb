import { http, HttpResponse } from "msw";

import { server } from "@/test-helpers/msw-server";
import { validateGenomeGroup } from "../validate-genome-group";

const options = { maxGenomes: 2, maxGenomeLength: 250000 };

function makeGenomeIds(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `${String(index + 1)}.1`);
}

/** Respond to Workspace.get with a genome group holding exactly these ids. */
function groupWithIds(genomeIds: string[]) {
  return http.post("/api/services/workspace", () =>
    HttpResponse.json({
      result: [
        [["metadata", JSON.stringify({ id_list: { genome_id: genomeIds } })]],
      ],
    }),
  );
}

describe("validateGenomeGroup", () => {
  it("rejects empty and oversized groups before viral validation", async () => {
    let viralHandlerCalled = false;
    server.use(
      groupWithIds([]),
      http.post("/api/services/genome/validate-viral", () => {
        viralHandlerCalled = true;
        return HttpResponse.json({ results: [] });
      }),
    );

    await expect(validateGenomeGroup("/empty", options)).resolves.toEqual({
      status: "empty",
    });

    server.use(groupWithIds(["1.1", "2.1", "3.1"]));
    await expect(validateGenomeGroup("/large", options)).resolves.toEqual({
      status: "too-large",
      genomeCount: 3,
    });
    expect(viralHandlerCalled).toBe(false);
  });

  it("preserves viral validation errors", async () => {
    server.use(
      groupWithIds(["1.1"]),
      http.post("/api/services/genome/validate-viral", () =>
        HttpResponse.json({
          results: [
            {
              genome_id: "1.1",
              superkingdom: "Bacteria",
              contigs: 1,
              genome_length: 1000,
            },
          ],
        }),
      ),
    );

    const result = await validateGenomeGroup("/invalid", options);

    expect(result.status).toBe("invalid");
    expect(result.status === "invalid" && result.message).toContain(
      "Invalid Superkingdom",
    );
  });

  it("returns the validated genome count", async () => {
    let capturedBody: { genome_ids?: string[] } = {};
    server.use(
      groupWithIds(["1.1", "2.1"]),
      http.post("/api/services/genome/validate-viral", async ({ request }) => {
        capturedBody = (await request.json()) as typeof capturedBody;
        return HttpResponse.json({
          results: [
            {
              genome_id: "1.1",
              superkingdom: "Viruses",
              contigs: 1,
              genome_length: 1000,
            },
            {
              genome_id: "2.1",
              superkingdom: "Viruses",
              contigs: 1,
              genome_length: 1000,
            },
          ],
        });
      }),
    );

    await expect(validateGenomeGroup("/valid", options)).resolves.toEqual({
      status: "valid",
      genomeCount: 2,
    });
    expect(capturedBody.genome_ids).toEqual(["1.1", "2.1"]);
  });

  // Regression: the group id list used to be resolved through
  // /api/services/genome/by-ids, whose route caps its query at limit(100). Any
  // group of 101+ genomes therefore reported a count of 100, could never reach
  // the too-large branch, and left genomes 101+ unvalidated.
  it("counts every member of a group larger than the by-ids row cap", async () => {
    let byIdsHandlerCalled = false;
    let viralHandlerCalled = false;
    server.use(
      groupWithIds(makeGenomeIds(150)),
      http.post("/api/services/genome/by-ids", () => {
        byIdsHandlerCalled = true;
        return HttpResponse.json({ results: [] });
      }),
      http.post("/api/services/genome/validate-viral", () => {
        viralHandlerCalled = true;
        return HttpResponse.json({ results: [] });
      }),
    );

    await expect(
      validateGenomeGroup("/big", { maxGenomes: 100, maxGenomeLength: 250000 }),
    ).resolves.toEqual({ status: "too-large", genomeCount: 150 });
    expect(byIdsHandlerCalled).toBe(false);
    expect(viralHandlerCalled).toBe(false);
  });

  it("validates every genome past the first 100 in an allowed group", async () => {
    const genomeIds = makeGenomeIds(150);
    const receivedIds: string[] = [];
    server.use(
      groupWithIds(genomeIds),
      http.post("/api/services/genome/validate-viral", async ({ request }) => {
        const body = (await request.json()) as { genome_ids?: string[] };
        receivedIds.push(...(body.genome_ids ?? []));
        return HttpResponse.json({
          results: (body.genome_ids ?? []).map((genomeId) => ({
            genome_id: genomeId,
            // Genome 150 is the one the old 100-row cap never saw.
            superkingdom: genomeId === "150.1" ? "Bacteria" : "Viruses",
            contigs: 1,
            genome_length: 1000,
          })),
        });
      }),
    );

    const result = await validateGenomeGroup("/big-but-allowed", {
      maxGenomes: 5000,
      maxGenomeLength: 250000,
    });

    expect(receivedIds).toEqual(genomeIds);
    expect(result.status).toBe("invalid");
    expect(result.status === "invalid" && result.message).toContain("150.1");
  });

  it("surfaces the real workspace error message", async () => {
    server.use(
      http.post("/api/services/workspace", () =>
        HttpResponse.json({ error: "Workspace unavailable" }, { status: 503 }),
      ),
    );

    await expect(validateGenomeGroup("/broken", options)).rejects.toThrow(
      "Workspace unavailable",
    );
  });
});
