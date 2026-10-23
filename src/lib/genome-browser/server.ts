/**
 * The Genome Browser's server-side contract with the Data API: request
 * parsing, the three RQL clauses, row mapping, and the bounded contig cache.
 * Reachable only from `/api/genome-browser/[operation]`. Its bounds are
 * separate from the generic gateway's 200-row page and export ceiling, the
 * same split `taxonomy-tree.ts` documents.
 *
 * Clauses are appended verbatim (they do not pass `validateRql`); every value
 * in them is a validated genome id, a validated integer, an annotation from
 * the allowlist, or a `refName` that `refNamePattern` has kept free of
 * whitespace, RQL delimiters, wildcards and quotes and that is then passed
 * through `escapeRqlValue`.
 */
import { createHash } from "node:crypto";
import { DataApiError, type ServerDataRepository } from "@/lib/data-api/repository";
import { DataApiValidationError } from "@/lib/data-api/resources";
import { isGenomeId } from "@/lib/genome-view/schema";
import { escapeRqlValue } from "@/lib/views/rql";
import { BoundedCache } from "./bounded-cache";
import {
  asInteger,
  genomeBrowserAnnotations,
  isGenomeBrowserAnnotation,
  maxFeatureRows,
  maxFeatureSpan,
  maxRegions,
  maxSequenceSpan,
  type GenomeBrowserAnnotation,
  type GenomeBrowserFeature,
  type GenomeBrowserFeaturesResult,
  type GenomeBrowserRegionsResult,
  type GenomeBrowserSequenceResult,
} from "./contract";

export interface GenomeBrowserSpanQuery {
  genomeId: string;
  refName: string;
  start: number;
  end: number;
}

export interface GenomeBrowserFeaturesQuery extends GenomeBrowserSpanQuery {
  annotation: GenomeBrowserAnnotation;
}

/**
 * No whitespace, RQL/query delimiters or quotes, and no `*` or `%`. `*` is a
 * live wildcard in an RQL `eq` (`refName=*` would match every contig), and the
 * Data API percent-decodes values, so `%2A` would be one too and `%29` would
 * smuggle a `)`. Real accessions never contain any of them.
 */
const refNamePattern = /^[^\s(),&=*%"'\\]{1,200}$/;

function requiredParam(params: URLSearchParams, name: string): string {
  const value = params.get(name);
  if (value === null || value === "") {
    throw new DataApiValidationError(`${name} is required.`);
  }
  return value;
}

function parseGenomeId(params: URLSearchParams): string {
  const value = requiredParam(params, "genomeId");
  if (!isGenomeId(value)) {
    throw new DataApiValidationError(
      "genomeId must be a genome id such as 83332.12.",
    );
  }
  return value;
}

function parseRefName(params: URLSearchParams): string {
  const value = requiredParam(params, "refName");
  if (!refNamePattern.test(value)) {
    throw new DataApiValidationError(
      "refName must be a sequence accession of at most 200 characters, without whitespace or any of ( ) , & = * % \" ' \\.",
    );
  }
  return value;
}

function parseCoordinate(params: URLSearchParams, name: string): number {
  const value = requiredParam(params, name);
  if (!/^\d{1,10}$/.test(value)) {
    throw new DataApiValidationError(`${name} must be a non-negative integer.`);
  }
  return Number(value);
}

function parseSpan(
  params: URLSearchParams,
  maxSpan: number,
): GenomeBrowserSpanQuery {
  const genomeId = parseGenomeId(params);
  const refName = parseRefName(params);
  const start = parseCoordinate(params, "start");
  const end = parseCoordinate(params, "end");
  if (end <= start) {
    throw new DataApiValidationError("end must be greater than start.");
  }
  if (end - start > maxSpan) {
    throw new DataApiValidationError(
      `A request may span at most ${maxSpan.toLocaleString("en-US")} bp.`,
    );
  }
  return { genomeId, refName, start, end };
}

export function parseRegionsQuery(params: URLSearchParams): {
  genomeId: string;
} {
  return { genomeId: parseGenomeId(params) };
}

export function parseFeaturesQuery(
  params: URLSearchParams,
): GenomeBrowserFeaturesQuery {
  const annotation = requiredParam(params, "annotation");
  if (!isGenomeBrowserAnnotation(annotation)) {
    throw new DataApiValidationError(
      `annotation must be one of ${genomeBrowserAnnotations.join(", ")}.`,
    );
  }
  return { ...parseSpan(params, maxFeatureSpan), annotation };
}

export function parseSequenceQuery(
  params: URLSearchParams,
): GenomeBrowserSpanQuery {
  return parseSpan(params, maxSequenceSpan);
}

const featureBrowserFields = [
  "feature_id",
  "patric_id",
  "refseq_locus_tag",
  "alt_locus_tag",
  "gene",
  "product",
  "feature_type",
  "start",
  "end",
  "strand",
  "segments",
  "protein_id",
  "na_length",
  "aa_length",
] as const;

export function regionsClause(genomeId: string): string {
  return `eq(genome_id,${genomeId})&select(sequence_id,accession,length)&sort(-length,+accession)`;
}

/**
 * Features overlapping the 0-based half-open `[start, end)`. A feature at
 * 1-based `[fs, fe]` occupies `[fs - 1, fe)`, so it overlaps when
 * `fs <= end` and `fe >= start + 1`. `source` features (one per RefSeq
 * chromosome, spanning all of it) are left out.
 */
export function featuresClause(query: GenomeBrowserFeaturesQuery): string {
  const predicates = [
    `eq(genome_id,${query.genomeId})`,
    `eq(accession,${escapeRqlValue(query.refName)})`,
    `eq(annotation,${query.annotation})`,
    "ne(feature_type,source)",
    `le(start,${String(query.end)})`,
    `ge(end,${String(query.start + 1)})`,
  ];
  return `and(${predicates.join(",")})&select(${featureBrowserFields.join(",")})&sort(+start,+feature_id)`;
}

export function sequenceClause(genomeId: string, refName: string): string {
  return `and(eq(genome_id,${genomeId}),eq(accession,${escapeRqlValue(refName)}))&select(sequence_id,accession,sequence)`;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function strandOf(value: unknown): -1 | 0 | 1 {
  if (value === "+") return 1;
  if (value === "-") return -1;
  return 0;
}

/** `segments` is `["9610..10707"]`, or one entry per part of a joined feature. */
export function parseSegments(value: unknown): [number, number][] {
  const items: unknown[] = Array.isArray(value) ? value : [value];
  return items.flatMap((item): [number, number][] => {
    const match =
      typeof item === "string" ? /^(\d+)\.\.(\d+)$/.exec(item.trim()) : null;
    const start = Number(match?.[1]);
    const end = Number(match?.[2]);
    return start >= 1 && end >= start ? [[start, end]] : [];
  });
}

/**
 * One Data API row as a JBrowse feature. Named as legacy labelled it
 * (`patric_id,gene`), falling back to the RefSeq locus tag and the id.
 */
export function toGenomeBrowserFeature(
  row: Record<string, unknown>,
  refName: string,
): GenomeBrowserFeature | null {
  const featureId = text(row.feature_id);
  const start = asInteger(row.start);
  const end = asInteger(row.end);
  if (featureId === undefined || start === undefined || end === undefined) {
    return null;
  }
  if (start < 1 || end < start) return null;
  const strand = strandOf(row.strand);
  const type = text(row.feature_type) ?? "feature";
  const patricId = text(row.patric_id);
  const gene = text(row.gene);
  const refseqLocusTag = text(row.refseq_locus_tag);
  const feature: GenomeBrowserFeature = {
    uniqueId: featureId,
    refName,
    start: start - 1,
    end,
    strand,
    type,
    name: patricId ?? gene ?? refseqLocusTag ?? featureId,
    feature_id: featureId,
  };
  const optional = {
    patric_id: patricId,
    refseq_locus_tag: refseqLocusTag,
    alt_locus_tag: text(row.alt_locus_tag),
    gene,
    product: text(row.product),
    protein_id: text(row.protein_id),
    na_length: asInteger(row.na_length),
    aa_length: asInteger(row.aa_length),
  };
  for (const [key, value] of Object.entries(optional)) {
    if (value !== undefined) Object.assign(feature, { [key]: value });
  }
  const segments = parseSegments(row.segments);
  if (segments.length > 1) {
    feature.subfeatures = segments.map(([segmentStart, segmentEnd]) => ({
      refName,
      start: segmentStart - 1,
      end: segmentEnd,
      strand,
      type,
    }));
  }
  return feature;
}

export async function readRegions(
  repository: ServerDataRepository,
  genomeId: string,
  signal?: AbortSignal,
): Promise<GenomeBrowserRegionsResult> {
  const { rows } = await repository.rangedRows(
    "genome_sequence",
    regionsClause(genomeId),
    0,
    maxRegions + 1,
    signal,
  );
  if (rows.length > maxRegions) {
    throw new DataApiError(
      `Genome ${genomeId} has more than ${maxRegions.toLocaleString("en-US")} sequences, more than the Genome Browser can open.`,
      422,
      "too_many_sequences",
    );
  }
  return {
    regions: rows.flatMap((row) => {
      const refName = text(row.accession);
      const length = asInteger(row.length);
      return refName && length !== undefined && length > 0
        ? [{ refName, start: 0, end: length }]
        : [];
    }),
  };
}

export async function readFeatures(
  repository: ServerDataRepository,
  query: GenomeBrowserFeaturesQuery,
  signal?: AbortSignal,
): Promise<GenomeBrowserFeaturesResult> {
  const { rows } = await repository.rangedRows(
    "genome_feature",
    featuresClause(query),
    0,
    maxFeatureRows + 1,
    signal,
  );
  return {
    features: rows.slice(0, maxFeatureRows).flatMap((row) => {
      const feature = toGenomeBrowserFeature(row, query.refName);
      return feature ? [feature] : [];
    }),
    truncated: rows.length > maxFeatureRows,
  };
}

/**
 * The sequence cache's scope for one caller: a SHA-256 digest of the session
 * token, or `anonymous` without one. Never the user id: `bvbrc_user_id` is a
 * plain cookie that nothing ties to `bvbrc_token` (`readIdentity` in
 * `src/lib/auth/server/session.ts`), and a cache hit answers without the Data
 * API ever seeing the caller's token, so a user-id key would hand a cached
 * private contig to any token that claims its owner's id. Keyed by the token, a
 * hit needs the exact token the upstream accepted; a rotated token only starts
 * cold. Digested so the raw token is never a key (and never in a log of one).
 */
export function sequenceCacheScope(token: string | undefined): string {
  return token
    ? createHash("sha256").update(token).digest("base64url")
    : "anonymous";
}

/**
 * Longest contig `sequence` will slice: the whole weight of the production
 * cache, so every contig it answers from can stay cached. A longer one would be
 * read whole (megabytes) again for every 100 kb slice the browser asks for.
 */
const maxContigLength = 64_000_000;

export interface SequenceCacheOptions {
  /** Characters held in total, and so the longest contig that can be held. */
  maxChars: number;
  ttlMs: number;
  /** Distinct whole-contig loads in flight at once, across all callers. */
  maxLoads: number;
  /** Test seam for the clock. */
  now?: () => number;
}

/**
 * Whole contig sequences, weighed by length, with concurrent reads of one
 * contig sharing a single upstream request. Keys carry the caller's token
 * digest (`sequenceCacheScope`), so a private genome's sequence answers only a
 * caller holding the token it was read with.
 *
 * Two bounds keep a miss from becoming a memory or upstream flood, since every
 * miss reads a whole contig: at most `maxLoads` distinct contigs load at once
 * (a read waiting on a load already in flight takes no slot of its own; one
 * past the cap is refused with a 503 rather than queued), and a contig found
 * longer than `maxChars` is remembered by length, so `readSequence` refuses its
 * next slices without reading it whole again.
 */
export class SequenceCache {
  readonly maxChars: number;
  private readonly sequences: BoundedCache<string>;
  private readonly tooLong: BoundedCache<number>;
  private readonly pending = new Map<string, Promise<string | null>>();

  constructor(private readonly options: SequenceCacheOptions) {
    this.maxChars = options.maxChars;
    this.sequences = new BoundedCache<string>({
      maxWeight: options.maxChars,
      weigh: (sequence) => sequence.length,
      ttlMs: options.ttlMs,
      now: options.now,
    });
    this.tooLong = new BoundedCache<number>({
      maxWeight: 1_000,
      ttlMs: options.ttlMs,
      now: options.now,
    });
  }

  get(key: string, load: () => Promise<string | null>): Promise<string | null> {
    const cached = this.sequences.get(key);
    if (cached !== undefined) return Promise.resolve(cached);
    const inFlight = this.pending.get(key);
    if (inFlight) return inFlight;
    if (this.pending.size >= this.options.maxLoads) {
      return Promise.reject(
        new DataApiError(
          "The Genome Browser's sequence service is busy reading other sequences. Please try again shortly.",
          503,
          "server_busy",
        ),
      );
    }
    const loading = load()
      .then((sequence) => {
        if (sequence !== null) {
          if (sequence.length > this.maxChars) {
            this.tooLong.set(key, sequence.length);
          } else {
            this.sequences.set(key, sequence);
          }
        }
        return sequence;
      })
      .finally(() => {
        // A `clear()` while this load was in flight may have let a newer load
        // of the same key in; that one is not this load's to forget.
        if (this.pending.get(key) === loading) this.pending.delete(key);
      });
    this.pending.set(key, loading);
    return loading;
  }

  /** The length of a contig a load found longer than `maxChars`, if any. */
  tooLongLength(key: string): number | undefined {
    return this.tooLong.get(key);
  }

  clear(): void {
    this.sequences.clear();
    this.tooLong.clear();
    this.pending.clear();
  }
}

/**
 * Process-local, like the rate limiter: 64 M characters (one byte each in V8)
 * hold a dozen bacterial chromosomes; ten minutes outlasts a browsing session
 * on one genome. Four loads at once keep at most four whole contigs being read
 * beside what the cache holds.
 */
export const genomeBrowserSequenceCache = new SequenceCache({
  maxChars: maxContigLength,
  ttlMs: 10 * 60_000,
  maxLoads: 4,
});

/**
 * Not given the request's signal: the read may be shared with other waiting
 * requests (`SequenceCache`), and one caller leaving must not fail the rest.
 * The Data API budget still bounds it, and the cache's `maxLoads` bounds how
 * many run at once.
 */
async function readWholeSequence(
  repository: ServerDataRepository,
  genomeId: string,
  refName: string,
): Promise<string | null> {
  const { rows } = await repository.rangedRows(
    "genome_sequence",
    sequenceClause(genomeId, refName),
    0,
    1,
  );
  const sequence = rows[0]?.sequence;
  return typeof sequence === "string" ? sequence : null;
}

function sequenceTooLong(
  query: GenomeBrowserSpanQuery,
  length: number,
  limit: number,
): DataApiError {
  return new DataApiError(
    `Sequence ${query.refName} of genome ${query.genomeId} is ${length.toLocaleString("en-US")} bp long, more than the ${limit.toLocaleString("en-US")} bp the Genome Browser can open.`,
    422,
    "sequence_too_long",
  );
}

export async function readSequence(
  repository: ServerDataRepository,
  query: GenomeBrowserSpanQuery,
  options: { cache: SequenceCache | null; scope: string },
): Promise<GenomeBrowserSequenceResult> {
  const key = `${options.scope}|${query.genomeId}|${query.refName}`;
  // Checked after the first whole read, before slicing: the Data API reports
  // no length without the sequence, and a regions read per slice would cost a
  // request each. The refusal is then remembered, so later slices cost none.
  const limit = options.cache?.maxChars ?? maxContigLength;
  const knownLength = options.cache?.tooLongLength(key);
  if (knownLength !== undefined) {
    throw sequenceTooLong(query, knownLength, limit);
  }
  const load = () =>
    readWholeSequence(repository, query.genomeId, query.refName);
  const sequence = options.cache
    ? await options.cache.get(key, load)
    : await load();
  if (sequence === null) {
    throw new DataApiError(
      `Genome ${query.genomeId} has no sequence ${query.refName}.`,
      404,
      "not_found",
    );
  }
  if (sequence.length > limit) {
    throw sequenceTooLong(query, sequence.length, limit);
  }
  const end = Math.min(query.end, sequence.length);
  const start = Math.min(query.start, end);
  return { start, end, seq: sequence.slice(start, end) };
}
