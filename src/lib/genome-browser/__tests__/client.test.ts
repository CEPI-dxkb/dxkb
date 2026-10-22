import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { clearAccountCaches } from "@/lib/account-caches";
import {
  clearGenomeBrowserCaches,
  loadGenomeBrowserFeatures,
  loadGenomeBrowserRegions,
  loadGenomeBrowserSequence,
} from "../client";

beforeEach(() => {
  clearGenomeBrowserCaches();
});

const feature = (id: string, start: number, end: number) => ({
  uniqueId: id,
  refName: "A",
  start,
  end,
  strand: 1,
  type: "CDS",
  name: id,
  feature_id: id,
});

describe("genome browser client", () => {
  it("reads a genome's regions once", async () => {
    let reads = 0;
    server.use(
      http.get("/api/genome-browser/regions", ({ request }) => {
        reads += 1;
        expect(new URL(request.url).searchParams.get("genomeId")).toBe("1.1");
        return HttpResponse.json({ regions: [{ refName: "A", start: 0, end: 10 }] });
      }),
    );
    await loadGenomeBrowserRegions("1.1");
    await expect(loadGenomeBrowserRegions("1.1")).resolves.toEqual([
      { refName: "A", start: 0, end: 10 },
    ]);
    expect(reads).toBe(1);
  });

  it("is emptied by an account change, which registers it on load", async () => {
    let reads = 0;
    server.use(
      http.get("/api/genome-browser/regions", () => {
        reads += 1;
        return HttpResponse.json({ regions: [{ refName: "A", start: 0, end: 10 }] });
      }),
    );
    await loadGenomeBrowserRegions("1.1");
    clearAccountCaches();
    await loadGenomeBrowserRegions("1.1");
    expect(reads).toBe(2);
  });

  it("keeps the route's error message and retries after a failure", async () => {
    server.use(
      http.get(
        "/api/genome-browser/regions",
        () =>
          HttpResponse.json(
            { error: "The BV-BRC data service is unavailable (HTTP 503 Service Unavailable: Site Maintenance).", code: "upstream_error" },
            { status: 503 },
          ),
        { once: true },
      ),
      http.get("/api/genome-browser/regions", () =>
        HttpResponse.json({ regions: [] }),
      ),
    );
    await expect(loadGenomeBrowserRegions("1.1")).rejects.toThrow(
      "Genome Browser sequences of 1.1: The BV-BRC data service is unavailable (HTTP 503 Service Unavailable: Site Maintenance).",
    );
    await expect(loadGenomeBrowserRegions("1.1")).resolves.toEqual([]);
  });

  it("keeps the regions read after an account change when an earlier read fails", async () => {
    let reads = 0;
    const staleAnswer = Promise.withResolvers<undefined>();
    server.use(
      http.get("/api/genome-browser/regions", async () => {
        reads += 1;
        if (reads === 1) {
          await staleAnswer.promise;
          return HttpResponse.json(
            { error: "The BV-BRC data service did not respond.", code: "upstream_timeout" },
            { status: 504 },
          );
        }
        return HttpResponse.json({ regions: [{ refName: "A", start: 0, end: 10 }] });
      }),
    );
    const staleRead = loadGenomeBrowserRegions("1.1");
    await vi.waitFor(() => {
      expect(reads).toBe(1);
    });
    clearAccountCaches();
    await loadGenomeBrowserRegions("1.1");
    staleAnswer.resolve(undefined);
    await expect(staleRead).rejects.toThrow(
      "Genome Browser sequences of 1.1: The BV-BRC data service did not respond.",
    );
    await expect(loadGenomeBrowserRegions("1.1")).resolves.toEqual([
      { refName: "A", start: 0, end: 10 },
    ]);
    expect(reads).toBe(2);
  });

  it("reads aligned feature chunks and returns each overlapping feature once", async () => {
    const requested: string[] = [];
    server.use(
      http.get("/api/genome-browser/features", ({ request }) => {
        const params = new URL(request.url).searchParams;
        requested.push(`${String(params.get("start"))}-${String(params.get("end"))}`);
        return HttpResponse.json({
          features: [feature("spans-chunks", 99_000, 101_000), feature("far", 150_000, 151_000)],
          truncated: false,
        });
      }),
    );
    const track = { genomeId: "1.1", annotation: "PATRIC" as const, refName: "A" };
    await expect(loadGenomeBrowserFeatures(track, 98_000, 120_000)).resolves.toEqual([
      feature("spans-chunks", 99_000, 101_000),
    ]);
    await loadGenomeBrowserFeatures(track, 0, 200_000);
    expect(requested).toEqual(["0-200000"]);
  });

  it("refuses a truncated feature answer with a zoom-in message", async () => {
    server.use(
      http.get("/api/genome-browser/features", () =>
        HttpResponse.json({ features: [], truncated: true }),
      ),
    );
    await expect(
      loadGenomeBrowserFeatures({ genomeId: "1.1", annotation: "RefSeq", refName: "A" }, 0, 10),
    ).rejects.toThrow("More than 10,000 RefSeq features in A:1..100000; zoom in to see them.");
  });

  it("assembles sequence from cached 20 kb chunks", async () => {
    const requested: string[] = [];
    server.use(
      http.get("/api/genome-browser/sequence", ({ request }) => {
        const params = new URL(request.url).searchParams;
        const start = Number(params.get("start"));
        const end = Math.min(Number(params.get("end")), 45_000);
        requested.push(`${String(start)}-${String(end)}`);
        return HttpResponse.json({ start, end, seq: "a".repeat(end - start) });
      }),
    );
    const sequence = { genomeId: "1.1", refName: "A" };
    await expect(loadGenomeBrowserSequence(sequence, 19_990, 20_010)).resolves.toBe(
      "a".repeat(20),
    );
    await expect(loadGenomeBrowserSequence(sequence, 44_990, 46_000)).resolves.toBe(
      "a".repeat(10),
    );
    expect(requested).toEqual(["0-40000", "40000-45000"]);
    // Both ranges are cached now: reading them again sends nothing.
    await expect(loadGenomeBrowserSequence(sequence, 19_990, 20_010)).resolves.toBe(
      "a".repeat(20),
    );
    await expect(loadGenomeBrowserSequence(sequence, 44_990, 46_000)).resolves.toBe(
      "a".repeat(10),
    );
    expect(requested).toEqual(["0-40000", "40000-45000"]);
  });

  it("drops every cached read when the caches are cleared", async () => {
    const reads = { regions: 0, features: 0, sequence: 0 };
    server.use(
      http.get("/api/genome-browser/regions", () => {
        reads.regions += 1;
        return HttpResponse.json({ regions: [] });
      }),
      http.get("/api/genome-browser/features", () => {
        reads.features += 1;
        return HttpResponse.json({ features: [], truncated: false });
      }),
      http.get("/api/genome-browser/sequence", () => {
        reads.sequence += 1;
        return HttpResponse.json({ start: 0, end: 20_000, seq: "a".repeat(20_000) });
      }),
    );
    const track = { genomeId: "1.1", annotation: "PATRIC" as const, refName: "A" };
    const readAll = async () => {
      await loadGenomeBrowserRegions("1.1");
      await loadGenomeBrowserFeatures(track, 0, 10);
      await loadGenomeBrowserSequence({ genomeId: "1.1", refName: "A" }, 0, 10);
    };

    await readAll();
    await readAll();
    expect(reads).toEqual({ regions: 1, features: 1, sequence: 1 });

    clearGenomeBrowserCaches();
    await readAll();
    expect(reads).toEqual({ regions: 2, features: 2, sequence: 2 });
  });
});
