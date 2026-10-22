import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { DataApiValidationError } from "@/lib/data-api/resources";
import { ServerDataRepository } from "@/lib/data-api/repository";
import {
  featuresClause,
  parseFeaturesQuery,
  parseRegionsQuery,
  parseSegments,
  parseSequenceQuery,
  readFeatures,
  readRegions,
  readSequence,
  regionsClause,
  SequenceCache,
  sequenceCacheScope,
  sequenceClause,
  toGenomeBrowserFeature,
} from "../server";

const repository = () =>
  new ServerDataRepository({ baseUrl: "https://data.test" });

function params(query: Record<string, string>) {
  return new URLSearchParams(query);
}

/** Answers every `genome_sequence` read with contig `A` as `sequence`, counting the reads. */
function serveSequence(sequence: string) {
  const upstream = { reads: 0 };
  server.use(
    http.get("https://data.test/genome_sequence/", () => {
      upstream.reads += 1;
      return HttpResponse.json([{ sequence_id: "s1", accession: "A", sequence }]);
    }),
  );
  return upstream;
}

const newCache = (options: { maxChars?: number; maxLoads?: number } = {}) =>
  new SequenceCache({
    maxChars: options.maxChars ?? 100,
    ttlMs: 60_000,
    maxLoads: options.maxLoads ?? 4,
  });

/** Reads `[start, end)` of genome 1.1's contig `A`. */
const readSlice = (cache: SequenceCache, start: number, end: number, scope = "user-1") =>
  readSequence(repository(), { genomeId: "1.1", refName: "A", start, end }, { cache, scope });

describe("genome browser query parsing", () => {
  const span = { genomeId: "470.36849", refName: "470.36849.con.0001", start: "0", end: "100000" };

  it("parses a features request", () => {
    expect(parseFeaturesQuery(params({ ...span, annotation: "PATRIC" }))).toEqual({
      genomeId: "470.36849",
      refName: "470.36849.con.0001",
      annotation: "PATRIC",
      start: 0,
      end: 100_000,
    });
  });

  it.each([
    [{ ...span, genomeId: "470" }, "genomeId"],
    [{ ...span, refName: "a,b" }, "refName"],
    [{ ...span, start: "-1" }, "start"],
    [{ ...span, start: "10", end: "10" }, "end must be greater than start"],
    [{ ...span, end: "1000001" }, "at most 1,000,000 bp"],
    [{ ...span, annotation: "Other" }, "annotation"],
  ])("rejects %o", (query, message) => {
    const run = () => parseFeaturesQuery(params({ annotation: "PATRIC", ...query }));
    expect(run).toThrow(DataApiValidationError);
    expect(run).toThrow(message);
  });

  it.each([
    ["*", "an RQL wildcard"],
    ["%29", "a percent-encoded delimiter"],
    ['a"b', "a double quote"],
    ["a'b", "a single quote"],
    ["a\\b", "a backslash"],
  ])("rejects the refName %s (%s)", (refName) => {
    const features = () =>
      parseFeaturesQuery(params({ ...span, refName, annotation: "PATRIC" }));
    const sequence = () => parseSequenceQuery(params({ ...span, refName }));
    expect(features).toThrow(DataApiValidationError);
    expect(features).toThrow("refName");
    expect(sequence).toThrow(DataApiValidationError);
    expect(sequence).toThrow("refName");
  });

  it("bounds a sequence request at 100 kb", () => {
    expect(() => parseSequenceQuery(params({ ...span, end: "100001" }))).toThrow(
      "at most 100,000 bp",
    );
    expect(parseSequenceQuery(params(span)).end).toBe(100_000);
  });

  it("requires a genome id for regions", () => {
    expect(() => parseRegionsQuery(params({}))).toThrow("genomeId is required.");
  });
});

describe("genome browser RQL", () => {
  it("lists a genome's sequences longest first", () => {
    expect(regionsClause("470.36849")).toBe(
      "eq(genome_id,470.36849)&select(sequence_id,accession,length)&sort(-length,+accession)",
    );
  });

  it("asks for the features overlapping a 0-based half-open range", () => {
    expect(
      featuresClause({ genomeId: "1328357.3", refName: "ATGO01000001", annotation: "PATRIC", start: 9609, end: 10707 }),
    ).toBe(
      "and(eq(genome_id,1328357.3),eq(accession,ATGO01000001),eq(annotation,PATRIC),ne(feature_type,source),le(start,10707),ge(end,9610))" +
        "&select(feature_id,patric_id,refseq_locus_tag,alt_locus_tag,gene,product,feature_type,start,end,strand,segments,protein_id,na_length,aa_length)" +
        "&sort(+start,+feature_id)",
    );
  });

  it("escapes the accession", () => {
    expect(sequenceClause("1.2", "a(b)")).toBe(
      "and(eq(genome_id,1.2),eq(accession,a%28b%29))&select(sequence_id,accession,sequence)",
    );
  });
});

describe("toGenomeBrowserFeature", () => {
  const row = {
    feature_id: "PATRIC.1328357.3.ATGO01000001.CDS.9610.10707.rev",
    patric_id: "fig|1328357.3.peg.9",
    feature_type: "CDS",
    start: 9610,
    end: 10707,
    strand: "-",
    product: "Transcriptional regulator",
    aa_length: 365,
    segments: ["9610..10707"],
  };

  it("converts to JBrowse's 0-based half-open feature", () => {
    expect(toGenomeBrowserFeature(row, "ATGO01000001")).toEqual({
      uniqueId: row.feature_id,
      refName: "ATGO01000001",
      start: 9609,
      end: 10707,
      strand: -1,
      type: "CDS",
      name: "fig|1328357.3.peg.9",
      feature_id: row.feature_id,
      patric_id: "fig|1328357.3.peg.9",
      product: "Transcriptional regulator",
      aa_length: 365,
    });
  });

  it("names a RefSeq feature by its locus tag", () => {
    expect(
      toGenomeBrowserFeature(
        { feature_id: "RefSeq.1", refseq_locus_tag: "Rv0001", start: 1, end: 9, strand: "+" },
        "NC_000962",
      )?.name,
    ).toBe("Rv0001");
  });

  it("splits a joined feature into subfeatures", () => {
    expect(
      toGenomeBrowserFeature({ ...row, segments: ["1..10", "20..30"] }, "A")?.subfeatures,
    ).toEqual([
      { refName: "A", start: 0, end: 10, strand: -1, type: "CDS" },
      { refName: "A", start: 19, end: 30, strand: -1, type: "CDS" },
    ]);
  });

  it("drops a row without usable coordinates", () => {
    expect(toGenomeBrowserFeature({ feature_id: "x", start: 0, end: 5 }, "A")).toBeNull();
    expect(toGenomeBrowserFeature({ start: 1, end: 5 }, "A")).toBeNull();
  });

  it("parses segment strings", () => {
    expect(parseSegments("5..9")).toEqual([[5, 9]]);
    expect(parseSegments(["x", "3..1"])).toEqual([]);
  });
});

describe("genome browser reads", () => {
  it("returns a genome's regions", async () => {
    server.use(
      http.get("https://data.test/genome_sequence/", ({ request }) => {
        expect(decodeURIComponent(new URL(request.url).search)).toContain(
          "eq(genome_id,470.36849)",
        );
        return HttpResponse.json([
          { sequence_id: "s1", accession: "470.36849.con.0001", length: 305802 },
          { sequence_id: "s2", accession: "470.36849.con.0002", length: 304205 },
        ]);
      }),
    );
    await expect(readRegions(repository(), "470.36849")).resolves.toEqual({
      regions: [
        { refName: "470.36849.con.0001", start: 0, end: 305802 },
        { refName: "470.36849.con.0002", start: 0, end: 304205 },
      ],
    });
  });

  it("reports truncation past the row limit", async () => {
    server.use(
      http.get("https://data.test/genome_feature/", ({ request }) => {
        expect(request.headers.get("Range")).toBe("items=0-10001");
        return HttpResponse.json(
          Array.from({ length: 10_001 }, (_, index) => ({
            feature_id: `f${String(index)}`,
            start: index + 1,
            end: index + 2,
          })),
        );
      }),
    );
    const result = await readFeatures(repository(), {
      genomeId: "1.1",
      refName: "A",
      annotation: "PATRIC",
      start: 0,
      end: 1_000_000,
    });
    expect(result.truncated).toBe(true);
    expect(result.features).toHaveLength(10_000);
  });

  it("slices a cached sequence and reads it once", async () => {
    const upstream = serveSequence("acgtacgtac");
    const cache = newCache();
    await expect(readSlice(cache, 2, 6)).resolves.toEqual({ start: 2, end: 6, seq: "gtac" });
    await expect(readSlice(cache, 8, 20)).resolves.toEqual({ start: 8, end: 10, seq: "ac" });
    expect(upstream.reads).toBe(1);
  });

  it("keeps one caller's cached sequence from another caller", async () => {
    const upstream = serveSequence("acgt");
    const cache = newCache();
    await readSlice(cache, 0, 4, "user-1");
    await readSlice(cache, 0, 4, "anonymous");
    expect(upstream.reads).toBe(2);
  });

  it("answers 404 for a sequence the genome does not have", async () => {
    server.use(
      http.get("https://data.test/genome_sequence/", () => HttpResponse.json([])),
    );
    await expect(
      readSequence(repository(), { genomeId: "1.1", refName: "B", start: 0, end: 4 }, { cache: null, scope: "anonymous" }),
    ).rejects.toMatchObject({ status: 404, message: "Genome 1.1 has no sequence B." });
  });
});

/** A promise and the functions that settle it, for holding a load open. */
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

describe("genome browser sequence cache", () => {
  it("shares one upstream request between concurrent reads of one contig", async () => {
    const upstream = serveSequence("acgtacgtac");
    const cache = newCache({ maxLoads: 1 });
    // One load slot: the second and third reads must wait on the first one's
    // load rather than claim a slot of their own.
    await expect(
      Promise.all([readSlice(cache, 0, 2), readSlice(cache, 2, 4), readSlice(cache, 4, 6)]),
    ).resolves.toEqual([
      { start: 0, end: 2, seq: "ac" },
      { start: 2, end: 4, seq: "gt" },
      { start: 4, end: 6, seq: "ac" },
    ]);
    expect(upstream.reads).toBe(1);
  });

  it("forgets a failed load, so the next read retries it", async () => {
    const cache = newCache();
    await expect(
      cache.get("k", () => Promise.reject(new Error("upstream down"))),
    ).rejects.toThrow("upstream down");
    await expect(cache.get("k", () => Promise.resolve("acgt"))).resolves.toBe("acgt");
    // The retry's sequence is cached.
    await expect(cache.get("k", () => Promise.resolve("other"))).resolves.toBe("acgt");
  });

  it("refuses a load past the concurrent-load cap with a 503, and admits it once a slot frees", async () => {
    const cache = newCache({ maxLoads: 2 });
    const first = deferred<string | null>();
    const second = deferred<string | null>();
    const a = cache.get("a", () => first.promise);
    const b = cache.get("b", () => second.promise);
    // The same contig again shares the load in flight: no third slot.
    const aAgain = cache.get("a", () => Promise.reject(new Error("not called")));

    await expect(cache.get("c", () => Promise.resolve("cccc"))).rejects.toMatchObject({
      status: 503,
      code: "server_busy",
      message: "The Genome Browser's sequence service is busy reading other sequences. Please try again shortly.",
    });

    first.resolve("aaaa");
    await expect(Promise.all([a, aAgain])).resolves.toEqual(["aaaa", "aaaa"]);
    await expect(cache.get("c", () => Promise.resolve("cccc"))).resolves.toBe("cccc");
    second.reject(new Error("upstream down"));
    await expect(b).rejects.toThrow("upstream down");
  });

  it("refuses a contig too long to cache with a 422, without reading it again per slice", async () => {
    const upstream = serveSequence("acgtacgtac");
    const cache = newCache({ maxChars: 8 });
    const refusal = {
      status: 422,
      code: "sequence_too_long",
      message: "Sequence A of genome 1.1 is 10 bp long, more than the 8 bp the Genome Browser can open.",
    };
    await expect(readSlice(cache, 0, 4)).rejects.toMatchObject(refusal);
    await expect(readSlice(cache, 4, 8)).rejects.toMatchObject(refusal);
    expect(upstream.reads).toBe(1);
  });

  it("scopes a cached contig by a digest of the caller's token", () => {
    const scope = sequenceCacheScope("un=user@patricbrc.org|sig=secret");
    expect(scope).toBe(sequenceCacheScope("un=user@patricbrc.org|sig=secret"));
    expect(scope).not.toBe(sequenceCacheScope("un=user@patricbrc.org|sig=other"));
    expect(scope).not.toContain("user@patricbrc.org");
    expect(scope).not.toContain("secret");
    expect(sequenceCacheScope(undefined)).toBe("anonymous");
  });
});
