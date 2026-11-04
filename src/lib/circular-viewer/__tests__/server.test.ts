vi.mock("server-only", () => ({}));

import { describe, expect, it, vi } from "vitest";
import type { ServerDataRepository } from "@/lib/data-api/repository";
import { maxSelectedRows } from "@/lib/data-api/validation";
import { maxContigs, maxTrackFeatures } from "../contract";
import {
  contigLengthsClause,
  contigSequencesClause,
  contigsClause,
  customTrackFilter,
  featurePresetFilters,
  featureTrackClause,
  gcResult,
  parseCustomQuery,
  parseTrackQuery,
  patricIdFeaturesClause,
  readContigs,
  readGc,
  readSpecialtyTrack,
  specialtyGenesClause,
  toCircularFeature,
} from "../server";

/** The `patric_id`s an `in(patric_id,(…))` clause names, decoded and unquoted. */
function patricIdsIn(clause: string): string[] {
  const list = /in\(patric_id,\(([^)]*)\)\)/.exec(clause)?.[1] ?? "";
  return list === "" ? [] : list.split(",").map((value) => decodeURIComponent(value).replace(/^"|"$/g, ""));
}

function fakeRepository(answers: {
  ranged?: Record<string, Record<string, unknown>[]>;
  selected?: (ids: string[]) => Record<string, unknown>[];
  /** `genome_feature`'s answer to a ranged read by `patric_id`. */
  byPatricId?: (patricIds: string[]) => Record<string, unknown>[];
  /** Answers every ranged read in full, as an upstream that ignored `Range` would. */
  ignoreRange?: boolean;
}) {
  // Pages by the range it is asked for, as the Data API does: `end` is exclusive.
  const rangedRows = vi.fn((resource: string, clause: string, start: number, end: number) => {
    // A read past ten windows is a paging loop: fail it rather than hang the run.
    if (start >= 10 * maxTrackFeatures) {
      return Promise.reject(new Error(`Read past ten windows, at row ${String(start)}.`));
    }
    const rows =
      resource === "genome_feature" && clause.includes("in(patric_id,")
        ? (answers.byPatricId?.(patricIdsIn(clause)) ?? [])
        : (answers.ranged?.[resource] ?? []);
    return Promise.resolve({ rows: answers.ignoreRange ? rows : rows.slice(start, end), headers: new Headers() });
  });
  const execute = vi.fn((_resource: string, request: { ids: string[] }) =>
    Promise.resolve({ rows: answers.selected?.(request.ids) ?? [] }),
  );
  return {
    repository: { rangedRows, execute } as unknown as ServerDataRepository,
    rangedRows,
    execute,
  };
}

const row = (featureId: string, start: number) => ({
  feature_id: featureId,
  accession: "NC_000962",
  start,
  end: start + 99,
  strand: "+",
  feature_type: "CDS",
  patric_id: `fig|83332.12.peg.${String(start)}`,
});

const patricId = (index: number) => `fig|1.1.peg.${String(index)}`;

/** `genome_feature`'s feature for each `patric_id`, placed by the id's number. */
const featuresByPatricId = (ids: string[]) =>
  ids.map((id) => ({ ...row(`F-${id}`, Number(id.split(".").pop()) + 1), patric_id: id }));

const featureReads = (rangedRows: ReturnType<typeof fakeRepository>["rangedRows"]) =>
  rangedRows.mock.calls.filter(([resource]) => resource === "genome_feature");

describe("circular viewer clauses", () => {
  it("reads a preset track as legacy addFeatureTrack did, quoting the + strand", () => {
    expect(featureTrackClause("83332.12", featurePresetFilters["cds-forward"])).toBe(
      "and(eq(genome_id,83332.12),ne(feature_type,source),and(eq(annotation,PATRIC),eq(feature_type,CDS),eq(strand,%22%2B%22)))" +
        "&select(feature_id,patric_id,accession,start,end,strand,feature_type,product,gene,refseq_locus_tag,protein_id,na_length,aa_length)" +
        "&sort(+accession,+start)",
    );
    expect(featurePresetFilters["non-cds"]).toBe(
      "and(eq(annotation,PATRIC),ne(feature_type,CDS))",
    );
  });

  it("names a specialty-gene property as a quoted phrase, sorted by gene", () => {
    expect(specialtyGenesClause("83332.12", "Antibiotic Resistance")).toBe(
      "and(eq(genome_id,83332.12),eq(property,%22Antibiotic%20Resistance%22))&select(id,feature_id,patric_id)&sort(+patric_id,+id)",
    );
  });

  it("names patric_ids quoted and percent-encoded", () => {
    expect(patricIdFeaturesClause("1428.1609", ["fig|1428.1609.peg.1122", "fig|1428.1609.peg.1661"])).toBe(
      "and(eq(genome_id,1428.1609),in(patric_id,(%22fig%7C1428.1609.peg.1122%22,%22fig%7C1428.1609.peg.1661%22)))" +
        "&select(feature_id,patric_id,accession,start,end,strand,feature_type,product,gene,refseq_locus_tag,protein_id,na_length,aa_length)",
    );
  });

  it("builds a custom track from type, strand and a Solr-style keyword", () => {
    expect(
      customTrackFilter({ type: "Miscellaneous", strand: "reverse", keyword: "transposon OR transposase" }),
    ).toBe(
      "and(eq(annotation,PATRIC),not(in(feature_type,(CDS,*RNA,source))),eq(strand,%22-%22),or(keyword(transposon),keyword(transposase)))",
    );
    expect(customTrackFilter({ type: "RNA", strand: "both", keyword: "ribosomal" })).toBe(
      "and(eq(annotation,PATRIC),eq(feature_type,*RNA),keyword(ribosomal))",
    );
  });

  it("reads sequences by accession, as legacy did", () => {
    expect(contigsClause("83332.12")).toBe(
      "eq(genome_id,83332.12)&select(sequence_id,accession,length,gc_content,topology,sequence_type)&sort(+accession)",
    );
  });
});

describe("circular viewer request parsing", () => {
  const params = (query: string) => new URLSearchParams(query);

  it("accepts a known preset and rejects others", () => {
    expect(parseTrackQuery(params("genomeId=83332.12&preset=amr"))).toEqual({
      genomeId: "83332.12",
      preset: "amr",
    });
    expect(() => parseTrackQuery(params("genomeId=83332.12&preset=essential"))).toThrow(
      "preset must be one of cds-forward, cds-reverse, non-cds, amr, vf, transporter, drug-target.",
    );
    expect(() => parseTrackQuery(params("genomeId=coli&preset=amr"))).toThrow(
      "genomeId must be a genome id such as 83332.12.",
    );
  });

  it("requires a keyword with a searchable word, and word strands", () => {
    expect(
      parseCustomQuery(params("genomeId=1.1&type=CDS&strand=forward&keyword=+secretion+")),
    ).toEqual({ genomeId: "1.1", type: "CDS", strand: "forward", keyword: "secretion" });
    expect(() => parseCustomQuery(params("genomeId=1.1&type=CDS&strand=both&keyword=%22%22"))).toThrow(
      "keyword must contain a word to search for.",
    );
    expect(() => parseCustomQuery(params("genomeId=1.1&type=CDS&strand=%2B&keyword=x"))).toThrow(
      "strand must be one of both, forward, reverse.",
    );
  });
});

describe("circular viewer reads", () => {
  it("maps rows and drops unreadable ones", () => {
    expect(toCircularFeature(row("F1", 10))).toEqual({
      featureId: "F1",
      accession: "NC_000962",
      start: 10,
      end: 109,
      strand: "+",
      featureType: "CDS",
      patricId: "fig|83332.12.peg.10",
    });
    expect(toCircularFeature({ feature_id: "F2", accession: "A", start: 0, end: 5 })).toBeNull();
  });

  it("marks more than 1,000 sequences as truncated", async () => {
    const rows = Array.from({ length: maxContigs + 1 }, (_, index) => ({
      sequence_id: `s${String(index)}`,
      accession: `A${String(index)}`,
      length: 100,
    }));
    const { repository, rangedRows } = fakeRepository({ ranged: { genome_sequence: rows } });
    const result = await readContigs(repository, "1.1");
    expect(result.truncated).toBe(true);
    expect(result.contigs).toHaveLength(maxContigs);
    expect(rangedRows).toHaveBeenCalledWith("genome_sequence", contigsClause("1.1"), 0, maxContigs + 1, undefined);
  });

  it("reads each specialty gene's feature once, 500 ids per request", async () => {
    const spRows = Array.from({ length: 501 }, (_, index) => ({ id: `r${String(index)}`, feature_id: `F${String(index)}` }));
    // A second source listing the first gene again.
    spRows.push({ id: "dup", feature_id: "F0" });
    const { repository, execute } = fakeRepository({
      ranged: { sp_gene: spRows },
      selected: (ids) => ids.map((id, index) => row(id, 1000 - index)),
    });
    const result = await readSpecialtyTrack(repository, "1.1", "Virulence Factor");
    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute.mock.calls.map(([, request]) => request.ids.length)).toEqual([500, 1]);
    expect(result.features).toHaveLength(501);
    expect(result.features[0].start).toBeLessThanOrEqual(result.features[1].start);
    expect(result.truncated).toBe(false);
  });

  it("pages sp_gene past a full window whose rows name fewer genes than the limit", async () => {
    // Two sources list each gene: 25,001 rows name 12,501 genes.
    const spRows = Array.from({ length: maxTrackFeatures + 1 }, (_, index) => {
      const gene = Math.floor(index / 2);
      return { id: `r${String(index)}`, patric_id: patricId(gene), feature_id: `F${String(gene)}` };
    });
    const { repository, rangedRows } = fakeRepository({
      ranged: { sp_gene: spRows },
      selected: (ids) => ids.map((id, index) => row(id, 1000 - index)),
    });
    const result = await readSpecialtyTrack(repository, "1.1", "Antibiotic Resistance");
    expect(rangedRows.mock.calls.map(([resource, , start, end]) => [resource, start, end])).toEqual([
      ["sp_gene", 0, maxTrackFeatures],
      ["sp_gene", maxTrackFeatures, 2 * maxTrackFeatures],
    ]);
    expect(result.features).toHaveLength(12_501);
    expect(result.truncated).toBe(false);
  });

  it("keeps the first 25,000 genes of more, and reads no window past them", async () => {
    const spRows = Array.from({ length: 2 * maxTrackFeatures + 1 }, (_, index) => ({
      id: `r${String(index)}`,
      patric_id: patricId(index),
      feature_id: `F${String(index)}`,
    }));
    const { repository, rangedRows, execute } = fakeRepository({
      ranged: { sp_gene: spRows },
      selected: (ids) => ids.map((id, index) => row(id, 1000 - index)),
    });
    const result = await readSpecialtyTrack(repository, "1.1", "Virulence Factor");
    expect(rangedRows.mock.calls.map(([, , start, end]) => [start, end])).toEqual([
      [0, maxTrackFeatures],
      [maxTrackFeatures, 2 * maxTrackFeatures],
    ]);
    const readIds = execute.mock.calls.flatMap(([, request]) => request.ids);
    expect(readIds).toHaveLength(maxTrackFeatures);
    expect(readIds.at(-1)).toBe(`F${String(maxTrackFeatures - 1)}`);
    expect(result.features).toHaveLength(maxTrackFeatures);
    expect(result.truncated).toBe(true);
  });

  it("stops paging sp_gene at a window that adds no gene, even when the upstream ignores the range", async () => {
    // Every read answers the same 25,000 rows, naming 12,500 genes.
    const spRows = Array.from({ length: maxTrackFeatures }, (_, index) => {
      const gene = Math.floor(index / 2);
      return { id: `r${String(index)}`, patric_id: patricId(gene), feature_id: `F${String(gene)}` };
    });
    const { repository, rangedRows } = fakeRepository({
      ranged: { sp_gene: spRows },
      selected: (ids) => ids.map((id, index) => row(id, 1000 - index)),
      ignoreRange: true,
    });
    const result = await readSpecialtyTrack(repository, "1.1", "Virulence Factor");
    expect(rangedRows).toHaveBeenCalledTimes(2);
    expect(result.features).toHaveLength(12_500);
    expect(result.truncated).toBe(false);
  });

  it("draws a gene sp_gene lists only by patric_id, reading 100 ids per request", async () => {
    // CARD and NDARO rows name the gene by patric_id alone.
    const spRows = Array.from({ length: 101 }, (_, index) => ({ id: `card${String(index)}`, patric_id: patricId(index) }));
    const { repository, rangedRows, execute } = fakeRepository({
      ranged: { sp_gene: spRows },
      byPatricId: featuresByPatricId,
    });
    const result = await readSpecialtyTrack(repository, "1.1", "Antibiotic Resistance");
    expect(execute).not.toHaveBeenCalled();
    expect(featureReads(rangedRows).map(([, clause, start, end]) => [patricIdsIn(clause).length, start, end])).toEqual([
      [100, 0, maxSelectedRows],
      [1, 0, maxSelectedRows],
    ]);
    expect(featureReads(rangedRows)[1][1]).toBe(
      "and(eq(genome_id,1.1),in(patric_id,(%22fig%7C1.1.peg.100%22)))" +
        "&select(feature_id,patric_id,accession,start,end,strand,feature_type,product,gene,refseq_locus_tag,protein_id,na_length,aa_length)",
    );
    expect(result.features).toHaveLength(101);
    expect(result.features[0]).toMatchObject({ featureId: "F-fig|1.1.peg.0", patricId: "fig|1.1.peg.0", start: 1 });
    expect(result.truncated).toBe(false);
  });

  it("keeps every feature a patric_id read answers", async () => {
    const { repository } = fakeRepository({
      ranged: { sp_gene: [{ id: "a", patric_id: patricId(1) }] },
      byPatricId: ([id]) => [
        { ...row("F1a", 10), patric_id: id },
        { ...row("F1b", 20), patric_id: id },
      ],
    });
    const result = await readSpecialtyTrack(repository, "1.1", "Antibiotic Resistance");
    expect(result.features.map(({ featureId }) => featureId)).toEqual(["F1a", "F1b"]);
  });

  it("reads a gene listed both with and without its feature_id once", async () => {
    const { repository, rangedRows, execute } = fakeRepository({
      ranged: {
        sp_gene: [
          // CARD's row without the feature_id comes first, so the gene learns it from the next row.
          { id: "a", patric_id: patricId(1) },
          { id: "b", patric_id: patricId(1), feature_id: "F1" },
          { id: "c", patric_id: patricId(2), feature_id: "F2" },
          { id: "d", patric_id: patricId(2) },
        ],
      },
      selected: (ids) => ids.map((id, index) => row(id, index + 1)),
    });
    const result = await readSpecialtyTrack(repository, "1.1", "Antibiotic Resistance");
    expect(execute.mock.calls.map(([, request]) => request.ids)).toEqual([["F1", "F2"]]);
    expect(featureReads(rangedRows)).toEqual([]);
    expect(result.features.map((feature) => feature.featureId)).toEqual(["F1", "F2"]);
  });

  it("draws a feature once when one row names it by feature_id and another by patric_id", async () => {
    const feature = { ...row("F7", 7), patric_id: patricId(7) };
    const { repository } = fakeRepository({
      ranged: {
        sp_gene: [
          { id: "a", feature_id: "F7" },
          { id: "b", patric_id: patricId(7) },
        ],
      },
      selected: () => [feature],
      byPatricId: () => [feature],
    });
    const result = await readSpecialtyTrack(repository, "1.1", "Antibiotic Resistance");
    expect(result.features.map(({ featureId }) => featureId)).toEqual(["F7"]);
  });

  it("puts only a well-formed patric_id in the clause", async () => {
    const { repository, rangedRows } = fakeRepository({
      ranged: {
        sp_gene: [
          { id: "a", patric_id: patricId(1) },
          { id: "b", patric_id: "fig|1.1.peg.2)),or(eq(genome_id,*)" },
          { id: "c", patric_id: "fig|1.1.peg.3 " },
        ],
      },
      byPatricId: featuresByPatricId,
    });
    const result = await readSpecialtyTrack(repository, "1.1", "Antibiotic Resistance");
    expect(featureReads(rangedRows).map(([, clause]) => clause)).toEqual([
      patricIdFeaturesClause("1.1", [patricId(1)]),
    ]);
    expect(result.features.map(({ patricId: id }) => id)).toEqual([patricId(1)]);
  });

  it("fails a specialty track whose feature read answers without a rows array, rather than drawing it empty", async () => {
    const { repository, execute } = fakeRepository({ ranged: { sp_gene: [{ id: "a", feature_id: "F1" }] } });
    execute.mockResolvedValueOnce({ row: null } as never);
    await expect(readSpecialtyTrack(repository, "1.1", "Transporter")).rejects.toMatchObject({
      status: 502,
      code: "malformed_response",
    });
  });

  it("draws a specialty track empty when its feature read answers an empty rows array", async () => {
    const { repository } = fakeRepository({ ranged: { sp_gene: [{ id: "a", feature_id: "F1" }] } });
    expect(await readSpecialtyTrack(repository, "1.1", "Drug Target")).toEqual({ features: [], truncated: false });
  });

  it("refuses a genome over the GC limit from its lengths, before reading any sequence", async () => {
    const rangedRows = vi.fn(() =>
      Promise.resolve({ rows: [{ sequence_id: "s1", accession: "A", length: 5 }, { sequence_id: "s2", accession: "B", length: 4 }], headers: new Headers() }),
    );
    const repository = { rangedRows } as unknown as ServerDataRepository;
    await expect(readGc(repository, "1.1", undefined, 8)).rejects.toMatchObject({
      status: 422,
      code: "genome_too_long",
      message: "Genome 1.1 is 9 bp long, more than the 8 bp the Circular Viewer's GC tracks read.",
    });
    expect(rangedRows).toHaveBeenCalledTimes(1);
    expect(rangedRows).toHaveBeenCalledWith("genome_sequence", contigLengthsClause("1.1"), 0, maxContigs, undefined);
  });

  it("reads the sequences once their lengths fit the GC limit", async () => {
    const rangedRows = vi.fn((_resource: string, clause: string) =>
      Promise.resolve({
        rows:
          clause === contigLengthsClause("1.1")
            ? [{ sequence_id: "s1", accession: "A", length: 4 }]
            : [{ sequence_id: "s1", accession: "A", sequence: "GGCC" }],
        headers: new Headers(),
      }),
    );
    const repository = { rangedRows } as unknown as ServerDataRepository;
    expect(await readGc(repository, "1.1", undefined, 8)).toEqual({
      windowSize: 20,
      contigs: [{ accession: "A", length: 4, gc: [1], skew: [0] }],
    });
    expect(rangedRows.mock.calls.map(([, clause]) => clause)).toEqual([
      contigLengthsClause("1.1"),
      contigSequencesClause("1.1"),
    ]);
  });

  it.each([
    ["no accession", { sequence_id: "s1", length: 5 }],
    ["a non-integer length", { sequence_id: "s1", accession: "A", length: 5.5 }],
    ["a negative length", { sequence_id: "s1", accession: "A", length: -3 }],
  ])("rejects a sequence row with %s, naming the genome and sequence_id", async (_name, bad) => {
    const { repository } = fakeRepository({ ranged: { genome_sequence: [bad] } });
    await expect(readContigs(repository, "1.1")).rejects.toMatchObject({
      status: 502,
      code: "malformed_response",
      message: expect.stringMatching(/1\.1.*s1/) as string,
    });
  });

  it("skips a sequence of length 0 rather than rejecting it", async () => {
    const { repository } = fakeRepository({
      ranged: {
        genome_sequence: [
          { sequence_id: "s0", accession: "E", length: 0 },
          { sequence_id: "s1", accession: "A", length: 5 },
        ],
      },
    });
    const result = await readContigs(repository, "1.1");
    expect(result.contigs.map(({ accession }) => accession)).toEqual(["A"]);
  });

  it("rejects a GC read whose lengths lack one, after the one lengths read", async () => {
    const { repository, rangedRows } = fakeRepository({
      ranged: { genome_sequence: [{ sequence_id: "s1", accession: "A" }] },
    });
    await expect(readGc(repository, "1.1")).rejects.toMatchObject({
      status: 502,
      code: "malformed_response",
      message: expect.stringMatching(/1\.1.*s1/) as string,
    });
    expect(rangedRows).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["no accession", { sequence_id: "s1", sequence: "GGCC" }],
    ["a non-string sequence", { sequence_id: "s1", accession: "A", sequence: null }],
  ])("rejects a GC sequence row with %s", async (_name, bad) => {
    const rangedRows = vi.fn((_resource: string, clause: string) =>
      Promise.resolve({
        rows: clause === contigLengthsClause("1.1") ? [{ sequence_id: "s1", accession: "A", length: 4 }] : [bad],
        headers: new Headers(),
      }),
    );
    const repository = { rangedRows } as unknown as ServerDataRepository;
    await expect(readGc(repository, "1.1")).rejects.toMatchObject({
      status: 502,
      code: "malformed_response",
      message: expect.stringMatching(/1\.1.*s1/) as string,
    });
  });

  it("leaves a length-0 row's empty sequence out of the GC contigs", async () => {
    const rangedRows = vi.fn((_resource: string, clause: string) =>
      Promise.resolve({
        rows:
          clause === contigLengthsClause("1.1")
            ? [{ sequence_id: "s0", accession: "E", length: 0 }, { sequence_id: "s1", accession: "A", length: 4 }]
            : [{ sequence_id: "s0", accession: "E", sequence: "" }, { sequence_id: "s1", accession: "A", sequence: "GGCC" }],
        headers: new Headers(),
      }),
    );
    const repository = { rangedRows } as unknown as ServerDataRepository;
    const result = await readGc(repository, "1.1");
    expect(result.contigs.map(({ accession }) => accession)).toEqual(["A"]);
  });

  it("rejects an empty sequence on a row whose length is not 0", async () => {
    const rangedRows = vi.fn((_resource: string, clause: string) =>
      Promise.resolve({
        rows:
          clause === contigLengthsClause("1.1")
            ? [{ sequence_id: "s1", accession: "A", length: 4 }]
            : [{ sequence_id: "s1", accession: "A", sequence: "" }],
        headers: new Headers(),
      }),
    );
    await expect(readGc({ rangedRows } as unknown as ServerDataRepository, "1.1")).rejects.toMatchObject({
      status: 502,
      code: "malformed_response",
      message: expect.stringMatching(/1\.1.*s1.*empty sequence/) as string,
    });
  });

  it("names what a bad length and a bad sequence were", async () => {
    const { repository } = fakeRepository({ ranged: { genome_sequence: [{ sequence_id: "s1", accession: "A", length: 5.5 }] } });
    await expect(readContigs(repository, "1.1")).rejects.toThrow(/s1.*length 5\.5 is not a whole number of 0 or more/);
    const missing = fakeRepository({ ranged: { genome_sequence: [{ sequence_id: "s1", accession: "A" }] } });
    await expect(readContigs(missing.repository, "1.1")).rejects.toThrow(/s1.*length is missing/);
    const numeric = vi.fn((_resource: string, clause: string) =>
      Promise.resolve({
        rows: clause === contigLengthsClause("1.1") ? [{ sequence_id: "s1", accession: "A", length: 4 }] : [{ sequence_id: "s1", accession: "A", sequence: 7 }],
        headers: new Headers(),
      }),
    );
    await expect(readGc({ rangedRows: numeric } as unknown as ServerDataRepository, "1.1")).rejects.toThrow(/s1.*sequence of type number/);
  });

  describe("GC read cap", () => {
    /** A repository whose sequence reads wait for `release`, so reads can be held in flight. */
    function heldRepository() {
      const { promise: gate, resolve: release } = Promise.withResolvers<undefined>();
      const rangedRows = vi.fn(async (_resource: string, clause: string) => {
        if (clause === contigLengthsClause("1.1")) {
          return { rows: [{ sequence_id: "s1", accession: "A", length: 4 }], headers: new Headers() };
        }
        await gate;
        return { rows: [{ sequence_id: "s1", accession: "A", sequence: "GGCC" }], headers: new Headers() };
      });
      const sequenceReads = () => rangedRows.mock.calls.filter(([, clause]) => clause === contigSequencesClause("1.1")).length;
      return { repository: { rangedRows } as unknown as ServerDataRepository, release, sequenceReads };
    }

    it("refuses a fifth concurrent read with 503 before reading sequences, and serves again after release", async () => {
      const held = heldRepository();
      const reads = Array.from({ length: 4 }, () => readGc(held.repository, "1.1"));
      try {
        await vi.waitFor(() => {
          expect(held.sequenceReads()).toBe(4);
        });

        await expect(readGc(held.repository, "1.1")).rejects.toMatchObject({ status: 503, code: "server_busy" });
        expect(held.sequenceReads()).toBe(4);
      } finally {
        // Frees the module-level slots even when an assertion above fails.
        held.release(undefined);
        await Promise.allSettled(reads);
      }
      const after = heldRepository();
      after.release(undefined);
      await expect(readGc(after.repository, "1.1")).resolves.toMatchObject({ windowSize: 20 });
    });

    it("frees the slot of a read that fails", async () => {
      const failing = {
        rangedRows: vi.fn((_resource: string, clause: string) =>
          clause === contigLengthsClause("1.1")
            ? Promise.resolve({ rows: [{ sequence_id: "s1", accession: "A", length: 4 }], headers: new Headers() })
            : Promise.reject(new Error("upstream down")),
        ),
      } as unknown as ServerDataRepository;
      for (let attempt = 0; attempt < 6; attempt += 1) {
        await expect(readGc(failing, "1.1")).rejects.toThrow("upstream down");
      }
    });
  });

  it("computes GC windows with the genome-wide window size, and refuses an oversized genome", () => {
    expect(gcResult("1.1", [{ accession: "A", sequence: "GGCC" }])).toEqual({
      windowSize: 20,
      contigs: [{ accession: "A", length: 4, gc: [1], skew: [0] }],
    });
    expect(() => gcResult("1.1", [{ accession: "A", sequence: "GGCCAATT" }], 4)).toThrow(
      "Genome 1.1 is 8 bp long, more than the 4 bp the Circular Viewer's GC tracks read.",
    );
  });
});
